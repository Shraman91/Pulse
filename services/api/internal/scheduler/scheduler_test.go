package scheduler

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"pulse/internal/checker"
	"pulse/internal/heartbeat"
	"pulse/internal/incidents"
	"pulse/internal/store"
)

func TestSchedulerWith50SeededMonitors(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	}))
	defer ts.Close()

	st := store.NewMemoryStore()
	chk := checker.NewChecker(checker.WithAllowPrivateIPs(true))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	const monitorCount = 50
	now := time.Now().UTC()

	// Seed 50 monitors across 10 users (5 monitors each <= 10 limit)
	for i := 1; i <= monitorCount; i++ {
		userID := fmt.Sprintf("user_%d", (i-1)/5)
		m := &store.Monitor{
			ID:             fmt.Sprintf("mon_%03d", i),
			OwnerUID:       userID,
			Name:           fmt.Sprintf("Service %d", i),
			Type:           store.MonitorTypeHTTP,
			URL:            ts.URL,
			Method:         "GET",
			IntervalSec:    60,
			TimeoutMs:      2000,
			ExpectedStatus: 200,
			State:          store.StateUnknown,
			NextCheckAt:    now.Add(-1 * time.Second), // due
			Paused:         false,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if err := st.CreateMonitor(ctx, m); err != nil {
			t.Fatalf("failed to seed monitor: %v", err)
		}
	}

	var completedCount atomic.Int32
	var wg sync.WaitGroup
	wg.Add(monitorCount)

	sched := New(st, chk,
		WithWorkers(20), // 20 workers
		WithTickInterval(100*time.Millisecond),
		WithCheckHook(func(m *store.Monitor, res *checker.Result) {
			completedCount.Add(1)
			wg.Done()
		}),
	)

	go sched.Start(ctx)

	// Wait for all 50 checks to complete
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// success
	case <-time.After(10 * time.Second):
		t.Fatalf("timed out waiting for 50 checks; completed so far: %d", completedCount.Load())
	}

	cancel()

	if completedCount.Load() != monitorCount {
		t.Errorf("expected %d completed checks, got %d", monitorCount, completedCount.Load())
	}

	// Verify all 50 monitors updated to StateUp and NextCheckAt advanced
	for i := 1; i <= monitorCount; i++ {
		id := fmt.Sprintf("mon_%03d", i)
		m, err := st.GetMonitor(ctx, id)
		if err != nil {
			t.Fatalf("failed to get monitor %s: %v", id, err)
		}
		if m.State != store.StateUp {
			t.Errorf("monitor %s expected state 'up', got '%s'", m.ID, m.State)
		}
		if m.NextCheckAt.Before(now) {
			t.Errorf("monitor %s nextCheckAt was not pushed forward: %v", m.ID, m.NextCheckAt)
		}
	}
}

func TestTwoWorkerProcessesNeverDoubleCheck(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(10 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	// Shared store accessed concurrently by two scheduler instances
	sharedStore := store.NewMemoryStore()
	chk := checker.NewChecker(checker.WithAllowPrivateIPs(true))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	const monitorCount = 50
	now := time.Now().UTC()

	// Seed 50 monitors across 10 users (5 monitors each <= 10 limit)
	for i := 1; i <= monitorCount; i++ {
		userID := fmt.Sprintf("user_concurrency_%d", (i-1)/5)
		m := &store.Monitor{
			ID:             fmt.Sprintf("contested_%03d", i),
			OwnerUID:       userID,
			Name:           fmt.Sprintf("Concurrency Target %d", i),
			Type:           store.MonitorTypeHTTP,
			URL:            ts.URL,
			IntervalSec:    300,
			TimeoutMs:      2000,
			ExpectedStatus: 200,
			State:          store.StateUnknown,
			NextCheckAt:    now.Add(-1 * time.Second), // all due
			Paused:         false,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if err := sharedStore.CreateMonitor(ctx, m); err != nil {
			t.Fatalf("failed to seed concurrency monitor: %v", err)
		}
	}

	// Track execution count per monitor ID
	var executionCounts sync.Map
	var totalChecks atomic.Int32
	var wg sync.WaitGroup
	wg.Add(monitorCount)

	hook := func(m *store.Monitor, res *checker.Result) {
		val, _ := executionCounts.LoadOrStore(m.ID, new(int32))
		counter := val.(*int32)
		atomic.AddInt32(counter, 1)

		totalChecks.Add(1)
		wg.Done()
	}

	// Instance A
	schedA := New(sharedStore, chk,
		WithWorkers(20),
		WithTickInterval(20*time.Millisecond),
		WithCheckHook(hook),
	)

	// Instance B (competing worker)
	schedB := New(sharedStore, chk,
		WithWorkers(20),
		WithTickInterval(20*time.Millisecond),
		WithCheckHook(hook),
	)

	// Launch both schedulers simultaneously
	go schedA.Start(ctx)
	go schedB.Start(ctx)

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatalf("timed out waiting for 50 checks across 2 workers; total so far: %d", totalChecks.Load())
	}

	cancel()

	// Assert NO monitor was checked more than once in this round
	doubleCheckFound := false
	for i := 1; i <= monitorCount; i++ {
		id := fmt.Sprintf("contested_%03d", i)
		val, ok := executionCounts.Load(id)
		if !ok {
			t.Errorf("monitor %s was never checked", id)
			continue
		}
		count := atomic.LoadInt32(val.(*int32))
		if count > 1 {
			t.Errorf("DOUBLE CHECK DETECTED! Monitor %s was checked %d times", id, count)
			doubleCheckFound = true
		}
	}

	if doubleCheckFound {
		t.Fatal("Double-checks occurred between competing worker processes")
	}

	if totalChecks.Load() != monitorCount {
		t.Errorf("expected exactly %d total checks, got %d", monitorCount, totalChecks.Load())
	}
}

func TestGracefulShutdownDrainsInFlightChecks(t *testing.T) {
	inFlightSleep := 150 * time.Millisecond
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(inFlightSleep)
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	st := store.NewMemoryStore()
	chk := checker.NewChecker(checker.WithAllowPrivateIPs(true))

	ctx, cancel := context.WithCancel(context.Background())

	now := time.Now().UTC()
	m := &store.Monitor{
		ID:             "drain_mon",
		OwnerUID:       "user_drain",
		Name:           "Slow Worker Check",
		Type:           store.MonitorTypeHTTP,
		URL:            ts.URL,
		IntervalSec:    60,
		TimeoutMs:      2000,
		ExpectedStatus: 200,
		State:          store.StateUnknown,
		NextCheckAt:    now.Add(-1 * time.Second),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	_ = st.CreateMonitor(ctx, m)

	var checkFinished atomic.Bool
	sched := New(st, chk,
		WithWorkers(5),
		WithTickInterval(10*time.Millisecond),
		WithCheckHook(func(m *store.Monitor, res *checker.Result) {
			checkFinished.Store(true)
		}),
	)

	schedulerDone := make(chan struct{})
	go func() {
		sched.Start(ctx)
		close(schedulerDone)
	}()

	// Allow check to be leased and begin executing
	time.Sleep(30 * time.Millisecond)

	// Simulate SIGTERM / shutdown signal
	cancel()

	// Wait for scheduler to cleanly exit
	select {
	case <-schedulerDone:
		// Scheduler drained and shut down
	case <-time.After(3 * time.Second):
		t.Fatal("scheduler failed to shutdown within timeout")
	}

	// Verify that the in-flight check was NOT aborted, but drained to completion
	if !checkFinished.Load() {
		t.Error("expected in-flight check to drain and finish before shutdown returned")
	}
}

func TestCalculateNextCheckJitter(t *testing.T) {
	now := time.Now().UTC()
	interval := 300 // 5 minutes

	for i := 0; i < 20; i++ {
		next := CalculateNextCheck(now, interval)
		diff := next.Sub(now).Seconds()

		// 300s +/- 5% means 285s to 315s
		if diff < 285 || diff > 315 {
			t.Errorf("jitter exceeded +/- 5%% bound: diff = %f seconds", diff)
		}
	}
}

func TestEvaluateHeartbeat(t *testing.T) {
	now := time.Now().UTC()

	t.Run("heartbeat within window is not expired", func(t *testing.T) {
		lastPing := now.Add(-30 * time.Second)
		m := &store.Monitor{
			Type:             store.MonitorTypeHeartbeat,
			ExpectedEverySec: 60,
			GraceSec:         15,
			LastPingAt:       &lastPing,
		}

		isExpired, _, nextCheck := EvaluateHeartbeat(m, now)
		if isExpired {
			t.Error("expected heartbeat to be active, got expired")
		}
		expectedDeadline := lastPing.Add(75 * time.Second)
		if !nextCheck.Equal(expectedDeadline) {
			t.Errorf("expected deadline %v, got %v", expectedDeadline, nextCheck)
		}
	})

	t.Run("heartbeat past deadline is expired", func(t *testing.T) {
		lastPing := now.Add(-100 * time.Second)
		m := &store.Monitor{
			Type:             store.MonitorTypeHeartbeat,
			ExpectedEverySec: 60,
			GraceSec:         15,
			LastPingAt:       &lastPing,
		}

		isExpired, cause, _ := EvaluateHeartbeat(m, now)
		if !isExpired {
			t.Error("expected heartbeat to be expired, got active")
		}
		if cause == "" {
			t.Error("expected descriptive cause for expired heartbeat")
		}
	})
}

func TestSchedulerHeartbeatWorkflow(t *testing.T) {
	st := store.NewMemoryStore()
	chk := checker.NewChecker(checker.WithAllowPrivateIPs(true))

	var alertsReceived []*incidents.AlertEvent
	var mu sync.Mutex
	alertHandler := func(ctx context.Context, event *incidents.AlertEvent) {
		mu.Lock()
		alertsReceived = append(alertsReceived, event)
		mu.Unlock()
	}

	sm := incidents.NewStateMachine(st, incidents.RealClock{}, alertHandler)
	hbHandler := heartbeat.NewHandler(st, sm)

	sched := New(st, chk,
		WithWorkers(2),
		WithTickInterval(10*time.Millisecond),
		WithStateMachine(sm),
	)

	now := time.Now().UTC()
	lastPing := now.Add(-120 * time.Second)

	// Seed expired heartbeat monitor
	m := &store.Monitor{
		ID:               "mon_cron_backup",
		OwnerUID:         "user_cron",
		Name:             "Database Backup Cron",
		Type:             store.MonitorTypeHeartbeat,
		State:            store.StateUnknown,
		PingToken:        "token_cron_123",
		ExpectedEverySec: 60,
		GraceSec:         10,
		LastPingAt:       &lastPing,
		NextCheckAt:      now.Add(-1 * time.Second), // due for evaluation
		CreatedAt:        lastPing,
		UpdatedAt:        lastPing,
	}
	if err := st.CreateMonitor(context.Background(), m); err != nil {
		t.Fatalf("failed to create monitor: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Scheduler discovers expired heartbeat and transitions to DOWN
	dispatched := sched.PollDueMonitors(ctx)
	if dispatched != 1 {
		t.Fatalf("expected 1 monitor dispatched, got %d", dispatched)
	}

	// Drain worker
	sched.wg.Add(1)
	go func() {
		defer sched.wg.Done()
		mLeased := <-sched.jobChan
		sched.executeCheck(ctx, mLeased)
	}()
	sched.wg.Wait()

	// Verify state is DOWN in store
	updated, err := st.GetMonitor(ctx, "mon_cron_backup")
	if err != nil {
		t.Fatalf("failed to get monitor: %v", err)
	}
	if updated.State != store.StateDown {
		t.Fatalf("expected monitor state 'down', got '%s'", updated.State)
	}

	// Verify active incident created
	activeInc, err := st.GetActiveIncident(ctx, "mon_cron_backup")
	if err != nil || activeInc == nil {
		t.Fatalf("expected active incident to be created, got %v", err)
	}

	// Verify DOWN alert received
	mu.Lock()
	if len(alertsReceived) != 1 || alertsReceived[0].Type != incidents.EventDown {
		t.Fatalf("expected exactly 1 EventDown alert, got %v", alertsReceived)
	}
	mu.Unlock()

	// 2. Cron job recovers by pinging /ping/{token}
	pingMux := http.NewServeMux()
	pingMux.HandleFunc("/ping/{token}", hbHandler.Ping)
	req := httptest.NewRequest(http.MethodGet, "/ping/token_cron_123", nil)
	rec := httptest.NewRecorder()
	pingMux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 from ping endpoint, got %d", rec.Code)
	}

	// Verify monitor state is UP in store
	recovered, _ := st.GetMonitor(ctx, "mon_cron_backup")
	if recovered.State != store.StateUp {
		t.Fatalf("expected monitor state 'up' after ping, got '%s'", recovered.State)
	}

	// Verify active incident is resolved
	activeIncAfterPing, _ := st.GetActiveIncident(ctx, "mon_cron_backup")
	if activeIncAfterPing != nil {
		t.Fatalf("expected active incident to be resolved, got %v", activeIncAfterPing)
	}

	// Verify UP recovery alert dispatched
	mu.Lock()
	if len(alertsReceived) != 2 || alertsReceived[1].Type != incidents.EventRecovery {
		t.Fatalf("expected 2nd alert to be EventRecovery, got %v", alertsReceived)
	}
	mu.Unlock()
}

