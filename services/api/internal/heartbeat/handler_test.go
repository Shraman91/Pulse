package heartbeat

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"pulse/internal/incidents"
	"pulse/internal/store"
)

func TestHeartbeatPingHandler(t *testing.T) {
	st := store.NewMemoryStore()

	var dispatchedEvent *incidents.AlertEvent
	alertHandler := func(ctx context.Context, event *incidents.AlertEvent) {
		dispatchedEvent = event
	}

	sm := incidents.NewStateMachine(st, incidents.RealClock{}, alertHandler)
	h := NewHandler(st, sm)

	mux := http.NewServeMux()
	mux.HandleFunc("/ping/{token}", h.Ping)

	// Seed a test heartbeat monitor
	now := time.Now().UTC()
	monitor := &store.Monitor{
		ID:               "mon_hb_1",
		OwnerUID:         "user_hb",
		Name:             "Nightly DB Backup",
		Type:             store.MonitorTypeHeartbeat,
		State:            store.StateUnknown,
		PingToken:        "secret_token_123",
		ExpectedEverySec: 3600,
		GraceSec:         300,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	_ = st.CreateMonitor(context.Background(), monitor)

	t.Run("invalid token returns 404", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/ping/non_existent_token", nil)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Fatalf("expected 404 for invalid token, got %d", rec.Code)
		}
	})

	t.Run("valid ping updates LastPingAt and sets state up", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/ping/secret_token_123", nil)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 for valid ping, got %d (body: %s)", rec.Code, rec.Body.String())
		}

		var res map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &res)
		if res["ok"] != true || res["monitorId"] != "mon_hb_1" {
			t.Errorf("unexpected ping response: %v", res)
		}

		// Verify state in store
		updated, _ := st.GetMonitor(context.Background(), "mon_hb_1")
		if updated.State != store.StateUp {
			t.Errorf("expected state 'up', got '%s'", updated.State)
		}
		if updated.LastPingAt == nil {
			t.Fatal("expected LastPingAt to be populated")
		}
	})

	t.Run("ping when monitor is paused acknowledges without incident resolution", func(t *testing.T) {
		pausedMon := &store.Monitor{
			ID:               "mon_hb_paused",
			OwnerUID:         "user_hb",
			Name:             "Paused Backup",
			Type:             store.MonitorTypeHeartbeat,
			State:            store.StateDown,
			PingToken:        "token_paused",
			Paused:           true,
			ExpectedEverySec: 3600,
			GraceSec:         300,
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		_ = st.CreateMonitor(context.Background(), pausedMon)

		req := httptest.NewRequest(http.MethodGet, "/ping/token_paused", nil)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		var res map[string]any
		_ = json.Unmarshal(rec.Body.Bytes(), &res)
		if res["status"] != "paused" {
			t.Errorf("expected status 'paused', got '%v'", res["status"])
		}
	})

	t.Run("ping when previously DOWN resolves active incident and dispatches UP alert", func(t *testing.T) {
		dispatchedEvent = nil

		downMon := &store.Monitor{
			ID:               "mon_hb_down",
			OwnerUID:         "user_hb",
			Name:             "Failing Job",
			Type:             store.MonitorTypeHeartbeat,
			State:            store.StateDown,
			PingToken:        "token_down",
			ExpectedEverySec: 3600,
			GraceSec:         300,
			CreatedAt:        now.Add(-2 * time.Hour),
			UpdatedAt:        now.Add(-2 * time.Hour),
		}
		_ = st.CreateMonitor(context.Background(), downMon)

		// Create active incident
		inc := &store.Incident{
			ID:          "inc_hb_1",
			MonitorID:   "mon_hb_down",
			MonitorName: "Failing Job",
			OwnerUID:    "user_hb",
			StartedAt:   now.Add(-1 * time.Hour),
			Cause:       "heartbeat missed",
		}
		_ = st.CreateIncident(context.Background(), inc)

		req := httptest.NewRequest(http.MethodGet, "/ping/token_down", nil)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}

		// Verify incident resolved
		activeInc, _ := st.GetActiveIncident(context.Background(), "mon_hb_down")
		if activeInc != nil {
			t.Errorf("expected active incident to be resolved, got %v", activeInc)
		}

		// Verify recovery alert dispatched
		if dispatchedEvent == nil {
			t.Fatal("expected recovery alert to be dispatched")
		}
		if dispatchedEvent.Type != incidents.EventRecovery {
			t.Errorf("expected EventRecovery, got %s", dispatchedEvent.Type)
		}
		if dispatchedEvent.Monitor.ID != "mon_hb_down" {
			t.Errorf("expected monitor mon_hb_down, got %s", dispatchedEvent.Monitor.ID)
		}
	})
}
