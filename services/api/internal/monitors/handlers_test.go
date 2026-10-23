package monitors

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"pulse/internal/auth"
	"pulse/internal/store"
)

func TestMonitorHandlers(t *testing.T) {
	st := store.NewMemoryStore()
	h := NewHandler(st)
	verifier := &auth.DevVerifier{}
	mw := auth.Middleware(verifier)

	// Wrap handlers with router and auth
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/monitors", h.Create)
	mux.HandleFunc("GET /api/monitors", h.List)
	mux.HandleFunc("GET /api/monitors/{id}", h.Get)
	mux.HandleFunc("PATCH /api/monitors/{id}", h.Update)
	mux.HandleFunc("DELETE /api/monitors/{id}", h.Delete)
	mux.HandleFunc("GET /api/monitors/{id}/stats", h.Stats)
	mux.HandleFunc("GET /api/incidents", h.ListIncidents)

	server := mw(mux)

	t.Run("unauthenticated request returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/monitors", nil)
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("create valid HTTP monitor returns 201", func(t *testing.T) {
		body := CreateMonitorRequest{
			Name:        "API Health",
			Type:        store.MonitorTypeHTTP,
			URL:         "https://example.com/healthz",
			IntervalSec: 60,
			TimeoutMs:   5000,
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest(http.MethodPost, "/api/monitors", bytes.NewReader(jsonBody))
		req.Header.Set("Authorization", "Bearer dev:user_1:user1@pulse.dev")
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, req)

		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
		}

		var created store.Monitor
		_ = json.Unmarshal(rec.Body.Bytes(), &created)
		if created.Name != "API Health" || created.OwnerUID != "user_1" {
			t.Errorf("unexpected created monitor: %+v", created)
		}
		if created.IntervalSec != 60 || created.TimeoutMs != 5000 {
			t.Errorf("unexpected interval/timeout: %d, %d", created.IntervalSec, created.TimeoutMs)
		}
	})

	t.Run("create monitor invalid URL returns 400", func(t *testing.T) {
		body := CreateMonitorRequest{
			Name: "Invalid URL",
			Type: store.MonitorTypeHTTP,
			URL:  "ftp://example.com",
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest(http.MethodPost, "/api/monitors", bytes.NewReader(jsonBody))
		req.Header.Set("Authorization", "Bearer dev:user_1:user1@pulse.dev")
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400 for ftp url, got %d", rec.Code)
		}
	})

	t.Run("create monitor invalid interval returns 400", func(t *testing.T) {
		body := CreateMonitorRequest{
			Name:        "Too Fast",
			Type:        store.MonitorTypeHTTP,
			URL:         "https://example.com",
			IntervalSec: 30, // below 60 minimum
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest(http.MethodPost, "/api/monitors", bytes.NewReader(jsonBody))
		req.Header.Set("Authorization", "Bearer dev:user_1:user1@pulse.dev")
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, req)

		if rec.Code != http.StatusBadRequest {
			t.Errorf("expected 400 for interval < 60, got %d", rec.Code)
		}
	})

	t.Run("create heartbeat monitor generates ping token", func(t *testing.T) {
		body := CreateMonitorRequest{
			Name:             "Daily Backup Cron",
			Type:             store.MonitorTypeHeartbeat,
			ExpectedEverySec: 86400,
			GraceSec:         1800,
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest(http.MethodPost, "/api/monitors", bytes.NewReader(jsonBody))
		req.Header.Set("Authorization", "Bearer dev:user_1:user1@pulse.dev")
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, req)

		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
		}

		var created store.Monitor
		_ = json.Unmarshal(rec.Body.Bytes(), &created)
		if created.PingToken == "" {
			t.Errorf("expected non-empty ping token for heartbeat monitor")
		}
	})

	t.Run("enforces 10-monitor quota limit", func(t *testing.T) {
		// user_quota already has 0, let's create 10
		for i := 1; i <= 10; i++ {
			body := CreateMonitorRequest{
				Name: fmt.Sprintf("Monitor %d", i),
				Type: store.MonitorTypeHTTP,
				URL:  "https://example.com",
			}
			jsonBody, _ := json.Marshal(body)

			req := httptest.NewRequest(http.MethodPost, "/api/monitors", bytes.NewReader(jsonBody))
			req.Header.Set("Authorization", "Bearer dev:user_quota:quota@pulse.dev")
			rec := httptest.NewRecorder()
			server.ServeHTTP(rec, req)

			if rec.Code != http.StatusCreated {
				t.Fatalf("expected monitor %d to be created, got %d", i, rec.Code)
			}
		}

		// 11th should return 403 Forbidden
		body := CreateMonitorRequest{
			Name: "Monitor 11",
			Type: store.MonitorTypeHTTP,
			URL:  "https://example.com",
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest(http.MethodPost, "/api/monitors", bytes.NewReader(jsonBody))
		req.Header.Set("Authorization", "Bearer dev:user_quota:quota@pulse.dev")
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Errorf("expected 403 for 11th monitor, got %d", rec.Code)
		}
	})

	t.Run("patch pause and delete isolation", func(t *testing.T) {
		// User 1 creates monitor
		body := CreateMonitorRequest{
			Name: "To be modified",
			Type: store.MonitorTypeHTTP,
			URL:  "https://example.com",
		}
		jsonBody, _ := json.Marshal(body)

		req := httptest.NewRequest(http.MethodPost, "/api/monitors", bytes.NewReader(jsonBody))
		req.Header.Set("Authorization", "Bearer dev:owner_user:owner@pulse.dev")
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, req)

		var created store.Monitor
		_ = json.Unmarshal(rec.Body.Bytes(), &created)

		// User 2 tries to GET monitor -> 404
		reqGet := httptest.NewRequest(http.MethodGet, "/api/monitors/"+created.ID, nil)
		reqGet.Header.Set("Authorization", "Bearer dev:attacker:attacker@pulse.dev")
		recGet := httptest.NewRecorder()
		server.ServeHTTP(recGet, reqGet)
		if recGet.Code != http.StatusNotFound {
			t.Errorf("expected 404 for non-owner GET, got %d", recGet.Code)
		}

		// User 1 pauses monitor
		pause := true
		patchBody, _ := json.Marshal(store.UpdateMonitorRequest{Paused: &pause})
		reqPatch := httptest.NewRequest(http.MethodPatch, "/api/monitors/"+created.ID, bytes.NewReader(patchBody))
		reqPatch.Header.Set("Authorization", "Bearer dev:owner_user:owner@pulse.dev")
		recPatch := httptest.NewRecorder()
		server.ServeHTTP(recPatch, reqPatch)
		if recPatch.Code != http.StatusOK {
			t.Fatalf("expected 200 for PATCH, got %d", recPatch.Code)
		}

		var updated store.Monitor
		_ = json.Unmarshal(recPatch.Body.Bytes(), &updated)
		if !updated.Paused {
			t.Errorf("expected Paused=true after PATCH")
		}

		// User 1 deletes monitor
		reqDel := httptest.NewRequest(http.MethodDelete, "/api/monitors/"+created.ID, nil)
		reqDel.Header.Set("Authorization", "Bearer dev:owner_user:owner@pulse.dev")
		recDel := httptest.NewRecorder()
		server.ServeHTTP(recDel, reqDel)
		if recDel.Code != http.StatusOK {
			t.Fatalf("expected 200 for DELETE, got %d", recDel.Code)
		}
	})

	t.Run("list incidents returns incidents for authenticated user", func(t *testing.T) {
		// Seed incident
		inc := &store.Incident{
			ID:          "inc_test_1",
			MonitorID:   "mon_100",
			MonitorName: "Test Target",
			OwnerUID:    "user_inc",
			Cause:       "connection refused",
		}
		_ = st.CreateIncident(context.Background(), inc)

		req := httptest.NewRequest(http.MethodGet, "/api/incidents", nil)
		req.Header.Set("Authorization", "Bearer dev:user_inc:user@pulse.dev")
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 for GET /api/incidents, got %d", rec.Code)
		}

		var incidents []*store.Incident
		_ = json.Unmarshal(rec.Body.Bytes(), &incidents)
		if len(incidents) != 1 || incidents[0].ID != "inc_test_1" {
			t.Errorf("expected 1 incident returned, got %v", incidents)
		}
	})

	t.Run("stats endpoint returns computed rollups and uptime percentage", func(t *testing.T) {
		now := time.Now().UTC()
		m := &store.Monitor{
			ID:          "mon_stats_1",
			OwnerUID:    "user_stats",
			Name:        "API Endpoint",
			Type:        store.MonitorTypeHTTP,
			URL:         "https://example.com",
			Method:      "GET",
			IntervalSec: 60,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		_ = st.CreateMonitor(context.Background(), m)

		// Seed 2 hourly rollups:
		// Hour 1: 150ms latency, OK
		_ = st.RecordRollup(context.Background(), "mon_stats_1", 150, true, 20, 30, 40, 60, now.Add(-1*time.Hour))
		// Hour 2: 200ms latency, failed
		_ = st.RecordRollup(context.Background(), "mon_stats_1", 200, false, 25, 35, 45, 95, now)

		req := httptest.NewRequest(http.MethodGet, "/api/monitors/mon_stats_1/stats?range=24h", nil)
		req.Header.Set("Authorization", "Bearer dev:user_stats:user@pulse.dev")
		rec := httptest.NewRecorder()
		server.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 for GET /api/monitors/{id}/stats, got %d (body: %s)", rec.Code, rec.Body.String())
		}

		var stats store.MonitorStats
		if err := json.Unmarshal(rec.Body.Bytes(), &stats); err != nil {
			t.Fatalf("failed to decode stats: %v", err)
		}

		if stats.MonitorID != "mon_stats_1" {
			t.Errorf("expected monitor ID mon_stats_1, got %s", stats.MonitorID)
		}
		if stats.TotalChecks != 2 {
			t.Errorf("expected 2 total checks, got %d", stats.TotalChecks)
		}
		if stats.TotalFailures != 1 {
			t.Errorf("expected 1 failure, got %d", stats.TotalFailures)
		}
		if stats.UptimePct != 50.0 {
			t.Errorf("expected 50%% uptime, got %f", stats.UptimePct)
		}
		if len(stats.Points) != 2 {
			t.Errorf("expected 2 points, got %d", len(stats.Points))
		}
	})
}
