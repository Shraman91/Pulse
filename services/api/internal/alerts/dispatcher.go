package alerts

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"pulse/internal/incidents"
	"pulse/internal/store"
)

type dispatchJob struct {
	channel store.AlertChannel
	payload *Payload
}

// Dispatcher manages an asynchronous worker pool for resilient alert delivery.
type Dispatcher struct {
	client        *http.Client
	telegramToken string
	retryCfg      RetryConfig
	jobQueue      chan dispatchJob
	wg            sync.WaitGroup
	ctx           context.Context
	cancel        context.CancelFunc
}

// NewDispatcher creates and starts a new background alert dispatcher.
func NewDispatcher(client *http.Client, telegramToken string, workers int, queueSize int, retryCfg RetryConfig) *Dispatcher {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	if workers <= 0 {
		workers = 5
	}
	if queueSize <= 0 {
		queueSize = 500
	}

	ctx, cancel := context.WithCancel(context.Background())
	d := &Dispatcher{
		client:        client,
		telegramToken: telegramToken,
		retryCfg:      retryCfg,
		jobQueue:      make(chan dispatchJob, queueSize),
		ctx:           ctx,
		cancel:        cancel,
	}

	// Start worker pool
	for i := 0; i < workers; i++ {
		d.wg.Add(1)
		go d.workerLoop(i)
	}

	return d
}

// Dispatch satisfies incidents.AlertHandler and enqueues notifications for each configured channel.
func (d *Dispatcher) Dispatch(ctx context.Context, event *incidents.AlertEvent) {
	if event == nil || event.Monitor == nil || len(event.Monitor.AlertChannels) == 0 {
		return
	}

	payload := &Payload{
		Type:        event.Type,
		MonitorID:   event.Monitor.ID,
		MonitorName: event.Monitor.Name,
		TargetURL:   event.Monitor.URL,
		Cause:       event.Cause,
		Duration:    event.Duration,
		Timestamp:   event.Timestamp,
	}

	for _, ch := range event.Monitor.AlertChannels {
		job := dispatchJob{
			channel: ch,
			payload: payload,
		}

		select {
		case d.jobQueue <- job:
		default:
			slog.Warn("alert dispatcher queue saturated, dropping alert job",
				"monitorId", event.Monitor.ID,
				"channelType", ch.Type,
			)
		}
	}
}

// SendDirect synchronously executes alert delivery to a single channel.
// Primarily used for immediate feedback on test notification endpoints.
func (d *Dispatcher) SendDirect(ctx context.Context, ch store.AlertChannel, payload *Payload) error {
	switch ch.Type {
	case "discord":
		return SendDiscord(ctx, d.client, ch.Target, payload, d.retryCfg)
	case "slack":
		return SendSlack(ctx, d.client, ch.Target, payload, d.retryCfg)
	case "telegram":
		return SendTelegram(ctx, d.client, d.telegramToken, ch.Target, payload, d.retryCfg)
	default:
		return fmt.Errorf("unsupported alert channel type: '%s'", ch.Type)
	}
}

func (d *Dispatcher) workerLoop(workerID int) {
	defer d.wg.Done()

	for {
		select {
		case <-d.ctx.Done():
			// Context cancelled, process remaining queued jobs then exit
			for {
				select {
				case job, ok := <-d.jobQueue:
					if !ok {
						return
					}
					d.executeJob(job)
				default:
					return
				}
			}

		case job, ok := <-d.jobQueue:
			if !ok {
				return
			}
			d.executeJob(job)
		}
	}
}

func (d *Dispatcher) executeJob(job dispatchJob) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := d.SendDirect(ctx, job.channel, job.payload); err != nil {
		slog.Error("failed to deliver alert",
			"channelType", job.channel.Type,
			"monitorId", job.payload.MonitorID,
			"error", err,
		)
	} else {
		slog.Info("alert delivered successfully",
			"channelType", job.channel.Type,
			"monitorId", job.payload.MonitorID,
			"eventType", job.payload.Type,
		)
	}
}

// Close gracefully stops the dispatcher, closing the queue and waiting for workers.
func (d *Dispatcher) Close() {
	d.cancel()
	close(d.jobQueue)
	d.wg.Wait()
}
