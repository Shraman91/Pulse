package scheduler

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"pulse/internal/checker"
	"pulse/internal/store"
)

// EvaluateHeartbeat calculates whether a heartbeat monitor has exceeded its deadline.
func EvaluateHeartbeat(m *store.Monitor, now time.Time) (isExpired bool, cause string, nextCheckAt time.Time) {
	if m.Type != store.MonitorTypeHeartbeat {
		return false, "", now
	}

	windowSec := m.ExpectedEverySec + m.GraceSec
	if windowSec < 60 {
		windowSec = 60
	}
	allowedWindow := time.Duration(windowSec) * time.Second

	var baseTime time.Time
	if m.LastPingAt != nil {
		baseTime = *m.LastPingAt
	} else {
		baseTime = m.CreatedAt
	}

	deadline := baseTime.Add(allowedWindow)

	if now.After(deadline) {
		elapsedSec := int(now.Sub(baseTime).Seconds())
		cause = fmt.Sprintf("heartbeat missed: expected ping within %ds (interval: %ds, grace: %ds), elapsed %ds",
			windowSec, m.ExpectedEverySec, m.GraceSec, elapsedSec)

		// Next recheck interval: grace period (minimum 60s)
		recheckSec := m.GraceSec
		if recheckSec < 60 {
			recheckSec = 60
		}
		return true, cause, now.Add(time.Duration(recheckSec) * time.Second)
	}

	// Not expired yet: reschedule to deadline
	return false, "", deadline
}

// checkHeartbeat evaluates an active heartbeat monitor during scheduler execution.
func (s *Scheduler) checkHeartbeat(ctx context.Context, m *store.Monitor, now time.Time) {
	isExpired, cause, nextCheckAt := EvaluateHeartbeat(m, now)

	if isExpired {
		slog.Warn("heartbeat monitor expired", "monitorId", m.ID, "name", m.Name, "cause", cause)

		if _, _, err := s.stateMachine.ProcessHeartbeatTimeout(ctx, m, cause, nextCheckAt); err != nil {
			slog.Error("failed to process heartbeat timeout", "monitorId", m.ID, "error", err)
		}

		_ = s.store.RecordRollup(ctx, m.ID, 0, false, 0, 0, 0, 0, now)

		if s.onCheckCompleted != nil {
			s.onCheckCompleted(m, &checker.Result{
				OK:    false,
				Error: cause,
			})
		}
	} else {
		// Not yet expired, update nextCheckAt to deadline and release lease
		if err := s.store.UpdateMonitorState(ctx, m.ID, m.State, m.ConsecutiveFailures, nextCheckAt); err != nil {
			slog.Error("failed to reschedule heartbeat monitor", "monitorId", m.ID, "error", err)
		}
	}
}
