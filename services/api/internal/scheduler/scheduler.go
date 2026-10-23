package scheduler

import (
	"context"
	"crypto/rand"
	"errors"
	"log/slog"
	"math/big"
	"sync"
	"time"

	"pulse/internal/checker"
	"pulse/internal/incidents"
	"pulse/internal/store"
)

// CheckCompletedHook is a callback invoked after a monitor check finishes.
type CheckCompletedHook func(m *store.Monitor, res *checker.Result)

// Option configures the Scheduler.
type Option func(*Scheduler)

// WithWorkers sets the number of worker goroutines in the pool.
func WithWorkers(num int) Option {
	return func(s *Scheduler) {
		if num > 0 {
			s.workers = num
		}
	}
}

// WithTickInterval sets how often the scheduler polls for due monitors.
func WithTickInterval(d time.Duration) Option {
	return func(s *Scheduler) {
		if d > 0 {
			s.tickInterval = d
		}
	}
}

// WithLeaseDuration sets the lease lock duration.
func WithLeaseDuration(d time.Duration) Option {
	return func(s *Scheduler) {
		if d > 0 {
			s.leaseDuration = d
		}
	}
}

// WithCheckHook sets a callback invoked after every check.
func WithCheckHook(hook CheckCompletedHook) Option {
	return func(s *Scheduler) {
		s.onCheckCompleted = hook
	}
}

// WithStateMachine sets a custom incident StateMachine.
func WithStateMachine(sm *incidents.StateMachine) Option {
	return func(s *Scheduler) {
		if sm != nil {
			s.stateMachine = sm
		}
	}
}

// Scheduler coordinates the discovery of due monitors, atomic distributed leasing,
// and execution via a fixed worker pool.
type Scheduler struct {
	store            store.Store
	checker          *checker.Checker
	stateMachine     *incidents.StateMachine
	workers          int
	tickInterval     time.Duration
	leaseDuration    time.Duration
	jobChan          chan *store.Monitor
	wg               sync.WaitGroup
	onCheckCompleted CheckCompletedHook
}

// New creates a new Scheduler instance.
func New(st store.Store, chk *checker.Checker, opts ...Option) *Scheduler {
	s := &Scheduler{
		store:         st,
		checker:       chk,
		stateMachine:  incidents.NewStateMachine(st, incidents.RealClock{}, nil),
		workers:       20, // default 20 workers
		tickInterval:  10 * time.Second,
		leaseDuration: 60 * time.Second,
		jobChan:       make(chan *store.Monitor, 200),
	}

	for _, opt := range opts {
		opt(s)
	}

	return s
}

// Start launches the worker pool and begins the periodic scheduler tick loop.
// Blocks until ctx is cancelled, then drains in-flight jobs before returning.
func (s *Scheduler) Start(ctx context.Context) {
	slog.Info("starting scheduler worker pool", "workers", s.workers, "interval", s.tickInterval.String())

	// Spawn worker pool
	for i := 0; i < s.workers; i++ {
		s.wg.Add(1)
		go s.workerLoop(ctx, i)
	}

	ticker := time.NewTicker(s.tickInterval)
	defer ticker.Stop()

	// Initial check on startup
	s.PollDueMonitors(ctx)

	for {
		select {
		case <-ctx.Done():
			slog.Info("scheduler context cancelled, shutting down worker pool...")
			close(s.jobChan)
			s.wg.Wait()
			slog.Info("all scheduler workers exited cleanly")
			return
		case <-ticker.C:
			s.PollDueMonitors(ctx)
		}
	}
}

// PollDueMonitors executes a single discovery and leasing pass.
// Can be called directly by tests or triggered by ticker.
func (s *Scheduler) PollDueMonitors(ctx context.Context) int {
	now := time.Now().UTC()

	// Query monitors where paused == false and nextCheckAt <= now
	due, err := s.store.GetDueMonitors(ctx, now, 100)
	if err != nil {
		slog.Error("failed to query due monitors", "error", err)
		return 0
	}

	leasedCount := 0
	for _, m := range due {
		if ctx.Err() != nil {
			break
		}

		// Calculate lease window and provisional nextCheckAt
		leaseUntil := now.Add(s.leaseDuration)
		tempNextCheck := now.Add(time.Duration(m.IntervalSec) * time.Second)

		// Atomic lease transaction: prevents double-checking across instances
		if err := s.store.AcquireLease(ctx, m.ID, leaseUntil, tempNextCheck); err != nil {
			if errors.Is(err, store.ErrLeaseContested) {
				// Another worker claimed this monitor; skip gracefully
				continue
			}
			slog.Warn("failed to acquire lease for monitor", "id", m.ID, "error", err)
			continue
		}

		leasedCount++

		// Send leased monitor to worker pool channel
		select {
		case s.jobChan <- m:
		case <-ctx.Done():
			return leasedCount
		default:
			// If buffer is saturated, log warning
			slog.Warn("worker pool job buffer full, job queued on next tick", "monitorId", m.ID)
		}
	}

	if leasedCount > 0 {
		slog.Debug("dispatched due monitors", "count", leasedCount)
	}

	return leasedCount
}

func (s *Scheduler) workerLoop(ctx context.Context, workerID int) {
	defer s.wg.Done()

	for m := range s.jobChan {
		s.executeCheck(ctx, m)
	}
}

func (s *Scheduler) executeCheck(ctx context.Context, m *store.Monitor) {
	now := time.Now().UTC()

	var result *checker.Result
	var err error

	if m.Type == store.MonitorTypeHTTP {
		result, err = s.checker.Check(ctx, m)
		if err != nil {
			slog.Error("error running check", "monitorId", m.ID, "error", err)
			return
		}
	} else {
		// Heartbeat monitors are checked via timeout evaluation (Phase 6)
		return
	}

	// Calculate nextCheckAt with +/- 5% random jitter
	nextCheckAt := CalculateNextCheck(now, m.IntervalSec)

	// Process result through anti-flapping state machine (opens/resolves incidents & records failures)
	if _, _, processErr := s.stateMachine.ProcessCheckResult(ctx, m, result, nextCheckAt); processErr != nil {
		slog.Error("failed to process check result", "monitorId", m.ID, "error", processErr)
	}

	// Invoke completion hook if registered
	if s.onCheckCompleted != nil {
		s.onCheckCompleted(m, result)
	}
}

// CalculateNextCheck computes the next execution timestamp with +/- 5% random jitter.
func CalculateNextCheck(now time.Time, intervalSec int) time.Time {
	if intervalSec < 60 {
		intervalSec = 60
	}

	// 5% jitter
	jitterBound := float64(intervalSec) * 0.05
	jitterRange := int64(jitterBound * 2 * 1000) // in milliseconds

	var jitterMs int64
	if jitterRange > 0 {
		n, err := rand.Int(rand.Reader, big.NewInt(jitterRange))
		if err == nil {
			jitterMs = n.Int64() - int64(jitterBound*1000)
		}
	}

	totalDuration := time.Duration(intervalSec)*time.Second + time.Duration(jitterMs)*time.Millisecond
	return now.Add(totalDuration)
}
