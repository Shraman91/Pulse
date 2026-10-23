package incidents

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"time"

	"pulse/internal/checker"
	"pulse/internal/store"
)

const (
	// FailureThreshold defines how many consecutive failures are needed to mark down
	FailureThreshold = 3
)

// EventType defines whether a state transition is a down alert or recovery alert.
type EventType string

const (
	EventDown     EventType = "DOWN"
	EventRecovery EventType = "UP"
)

// AlertEvent captures the details of an actionable state transition.
type AlertEvent struct {
	Type      EventType       `json:"type"`
	Monitor   *store.Monitor  `json:"monitor"`
	Incident  *store.Incident `json:"incident"`
	Duration  time.Duration   `json:"duration,omitempty"` // For recovery events
	Cause     string          `json:"cause,omitempty"`
	Timestamp time.Time       `json:"timestamp"`
}

// AlertHandler receives triggered events for downstream delivery.
type AlertHandler func(ctx context.Context, event *AlertEvent)

// StateMachine coordinates incident lifecycle transitions and anti-flapping guards.
type StateMachine struct {
	store        store.Store
	clock        Clock
	alertHandler AlertHandler
}

// NewStateMachine creates an instance of the incident StateMachine.
func NewStateMachine(st store.Store, clk Clock, handler AlertHandler) *StateMachine {
	if clk == nil {
		clk = RealClock{}
	}
	return &StateMachine{
		store:        st,
		clock:        clk,
		alertHandler: handler,
	}
}

// ProcessCheckResult applies the anti-flapping state transitions following a check:
// - Down transition: Triggered ONLY on 3 consecutive failures. Opens an incident and alerts.
// - Up transition: Triggered on first success if previously down. Resolves incident and alerts.
// - Flapping: 1 or 2 failures do NOT trigger down state or alerts.
func (sm *StateMachine) ProcessCheckResult(
	ctx context.Context,
	m *store.Monitor,
	res *checker.Result,
	nextCheckAt time.Time,
) (*store.Monitor, *AlertEvent, error) {
	now := sm.clock.Now()

	previousState := m.State
	consecutiveFailures := m.ConsecutiveFailures
	newState := previousState

	var alertEvent *AlertEvent

	if res.OK {
		// --- CHECK SUCCEEDED ---
		consecutiveFailures = 0
		newState = store.StateUp

		if previousState == store.StateDown {
			// RECOVERY: Resolve active incident and trigger recovery alert
			activeInc, err := sm.store.GetActiveIncident(ctx, m.ID)
			if err == nil && activeInc != nil {
				if resolveErr := sm.store.ResolveIncident(ctx, activeInc.ID, now); resolveErr != nil {
					slog.Error("failed to resolve incident", "incidentId", activeInc.ID, "error", resolveErr)
				}
				activeInc.ResolvedAt = &now
				duration := now.Sub(activeInc.StartedAt)

				alertEvent = &AlertEvent{
					Type:      EventRecovery,
					Monitor:   m,
					Incident:  activeInc,
					Duration:  duration,
					Timestamp: now,
				}
			}
		}
	} else {
		// --- CHECK FAILED ---
		consecutiveFailures++

		// Rule 4: Cost control - write full check diagnostic document only for failures
		failureDoc := &store.CheckFailure{
			ID:             generateID("chk"),
			MonitorID:      m.ID,
			TS:             now,
			OK:             false,
			StatusCode:     res.StatusCode,
			LatencyMs:      res.LatencyMs,
			Error:          res.Error,
			DNSMs:          res.DNSMs,
			ConnectMs:      res.ConnectMs,
			TLSHandshakeMs: res.TLSHandshakeMs,
			TTFBMs:         res.TTFBMs,
		}
		if recordErr := sm.store.RecordCheckFailure(ctx, failureDoc); recordErr != nil {
			slog.Error("failed to record check failure", "monitorId", m.ID, "error", recordErr)
		}

		// Anti-flapping logic: open incident ONLY when reaching 3 failures while not already down
		if consecutiveFailures >= FailureThreshold && previousState != store.StateDown {
			newState = store.StateDown

			cause := res.Error
			if cause == "" {
				cause = "check failed"
			}

			incident := &store.Incident{
				ID:              generateID("inc"),
				MonitorID:       m.ID,
				MonitorName:     m.Name,
				OwnerUID:        m.OwnerUID,
				StartedAt:       now,
				Cause:           cause,
				AlertDispatched: true,
			}

			if incErr := sm.store.CreateIncident(ctx, incident); incErr != nil {
				slog.Error("failed to create incident", "monitorId", m.ID, "error", incErr)
			}

			alertEvent = &AlertEvent{
				Type:      EventDown,
				Monitor:   m,
				Incident:  incident,
				Cause:     cause,
				Timestamp: now,
			}
		}
		// If consecutiveFailures < 3: state remains unchanged (anti-flapping guard)
	}

	// Persist monitor state update
	if err := sm.store.UpdateMonitorState(ctx, m.ID, newState, consecutiveFailures, nextCheckAt); err != nil {
		return nil, nil, fmt.Errorf("failed to update monitor state: %w", err)
	}

	// Update in-memory copy
	m.State = newState
	m.ConsecutiveFailures = consecutiveFailures
	m.NextCheckAt = nextCheckAt

	// Dispatch alert event if state changed
	if alertEvent != nil && sm.alertHandler != nil {
		sm.alertHandler(ctx, alertEvent)
	}

	return m, alertEvent, nil
}

func generateID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(b))
}
