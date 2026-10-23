package incidents

import (
	"context"
	"testing"
	"time"

	"pulse/internal/checker"
	"pulse/internal/store"
)

func TestStateMachineFlappingSequence(t *testing.T) {
	ctx := context.Background()
	st := store.NewMemoryStore()

	startTime := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	mockClock := NewMockClock(startTime)

	var recordedAlerts []*AlertEvent
	alertHandler := func(ctx context.Context, event *AlertEvent) {
		recordedAlerts = append(recordedAlerts, event)
	}

	sm := NewStateMachine(st, mockClock, alertHandler)

	m := &store.Monitor{
		ID:                  "mon_flapping",
		OwnerUID:            "user_alice",
		Name:                "Flapping API",
		Type:                store.MonitorTypeHTTP,
		URL:                 "https://api.example.com",
		State:               store.StateUp, // starts UP
		ConsecutiveFailures: 0,
		IntervalSec:         60,
		CreatedAt:           startTime,
		UpdatedAt:           startTime,
	}
	_ = st.CreateMonitor(ctx, m)

	// Flapping sequence: Fail, Fail, OK, Fail, Fail, Fail, OK
	sequence := []struct {
		stepName         string
		ok               bool
		errMsg           string
		timeOffsetSec    int
		expectedState    store.MonitorState
		expectedFailures int
		expectAlert      bool
		expectedAlert    EventType
	}{
		{"1. First Fail (transient)", false, "connection refused", 60, store.StateUp, 1, false, ""},
		{"2. Second Fail (transient)", false, "connection refused", 120, store.StateUp, 2, false, ""},
		{"3. Recovery OK (flapped)", true, "", 180, store.StateUp, 0, false, ""},
		{"4. Fail #1 again", false, "status 503", 240, store.StateUp, 1, false, ""},
		{"5. Fail #2 again", false, "status 503", 300, store.StateUp, 2, false, ""},
		{"6. Fail #3 (incident opens)", false, "status 503", 360, store.StateDown, 3, true, EventDown},
		{"7. Recovery OK (incident resolves)", true, "", 480, store.StateUp, 0, true, EventRecovery},
	}

	var incidentStartTime time.Time
	var incidentResolveTime time.Time

	for i, step := range sequence {
		mockClock.Set(startTime.Add(time.Duration(step.timeOffsetSec) * time.Second))
		currentTime := mockClock.Now()

		checkRes := &checker.Result{
			OK:         step.ok,
			StatusCode: 200,
			LatencyMs:  50,
			Error:      step.errMsg,
		}
		if !step.ok {
			checkRes.StatusCode = 500
		}

		nextCheck := currentTime.Add(60 * time.Second)
		updated, event, err := sm.ProcessCheckResult(ctx, m, checkRes, nextCheck)
		if err != nil {
			t.Fatalf("step %d (%s) failed with error: %v", i+1, step.stepName, err)
		}

		// Verify state after step
		if updated.State != step.expectedState {
			t.Errorf("step %d (%s): expected state %s, got %s", i+1, step.stepName, step.expectedState, updated.State)
		}
		if updated.ConsecutiveFailures != step.expectedFailures {
			t.Errorf("step %d (%s): expected consecutive failures %d, got %d", i+1, step.stepName, step.expectedFailures, updated.ConsecutiveFailures)
		}

		// Verify alerts
		if step.expectAlert {
			if event == nil {
				t.Fatalf("step %d (%s): expected alert event, got nil", i+1, step.stepName)
			}
			if event.Type != step.expectedAlert {
				t.Errorf("step %d (%s): expected alert type %s, got %s", i+1, step.stepName, step.expectedAlert, event.Type)
			}
			if step.expectedAlert == EventDown {
				incidentStartTime = currentTime
			}
			if step.expectedAlert == EventRecovery {
				incidentResolveTime = currentTime
			}
		} else {
			if event != nil {
				t.Errorf("step %d (%s): unexpected alert event triggered: %+v", i+1, step.stepName, event)
			}
		}
	}

	// Verify exactly one incident exists
	incidents, err := st.ListIncidentsByMonitor(ctx, m.ID, 10)
	if err != nil {
		t.Fatalf("failed to list incidents: %v", err)
	}

	if len(incidents) != 1 {
		t.Fatalf("expected exactly 1 incident created for flapping sequence, got %d", len(incidents))
	}

	inc := incidents[0]
	if !inc.StartedAt.Equal(incidentStartTime) {
		t.Errorf("expected incident StartedAt %v, got %v", incidentStartTime, inc.StartedAt)
	}
	if inc.ResolvedAt == nil || !inc.ResolvedAt.Equal(incidentResolveTime) {
		t.Errorf("expected incident ResolvedAt %v, got %v", incidentResolveTime, inc.ResolvedAt)
	}

	expectedDuration := incidentResolveTime.Sub(incidentStartTime)
	actualDuration := inc.ResolvedAt.Sub(inc.StartedAt)
	if actualDuration != expectedDuration {
		t.Errorf("expected incident duration %v, got %v", expectedDuration, actualDuration)
	}

	// Verify total alerts: exactly 2 (1 DOWN, 1 UP)
	if len(recordedAlerts) != 2 {
		t.Fatalf("expected exactly 2 recorded alerts, got %d", len(recordedAlerts))
	}
	if recordedAlerts[0].Type != EventDown || recordedAlerts[1].Type != EventRecovery {
		t.Errorf("unexpected alert types: %v, %v", recordedAlerts[0].Type, recordedAlerts[1].Type)
	}

	// Verify failure check documents recorded (Rule 4: failures only)
	failures, err := st.ListCheckFailures(ctx, m.ID, 10)
	if err != nil {
		t.Fatalf("failed to list check failures: %v", err)
	}
	// In the sequence, there were 5 failed checks in total (steps 1, 2, 4, 5, 6)
	if len(failures) != 5 {
		t.Errorf("expected 5 recorded failure check documents, got %d", len(failures))
	}
}

func TestContinuousOutageDoesNotDuplicateAlerts(t *testing.T) {
	ctx := context.Background()
	st := store.NewMemoryStore()

	startTime := time.Date(2026, 10, 23, 14, 0, 0, 0, time.UTC)
	mockClock := NewMockClock(startTime)

	var alertCount int
	sm := NewStateMachine(st, mockClock, func(ctx context.Context, event *AlertEvent) {
		alertCount++
	})

	m := &store.Monitor{
		ID:        "mon_continuous",
		OwnerUID:  "user_bob",
		Name:      "Major Outage API",
		State:     store.StateUp,
		CreatedAt: startTime,
		UpdatedAt: startTime,
	}
	_ = st.CreateMonitor(ctx, m)

	// 5 continuous failures
	for i := 1; i <= 5; i++ {
		mockClock.Advance(60 * time.Second)
		checkRes := &checker.Result{
			OK:         false,
			StatusCode: 500,
			Error:      "downstream database down",
		}
		_, _, err := sm.ProcessCheckResult(ctx, m, checkRes, mockClock.Now().Add(60*time.Second))
		if err != nil {
			t.Fatalf("failure on iteration %d: %v", i, err)
		}
	}

	// Only 1 alert should be dispatched (on failure #3), and only 1 incident opened
	if alertCount != 1 {
		t.Errorf("expected exactly 1 alert for continuous outage, got %d", alertCount)
	}

	incidents, err := st.ListIncidentsByMonitor(ctx, m.ID, 10)
	if err != nil || len(incidents) != 1 {
		t.Fatalf("expected 1 incident, got %d (err: %v)", len(incidents), err)
	}
	if incidents[0].ResolvedAt != nil {
		t.Errorf("expected incident to still be open/unresolved")
	}
}
