package statuspage

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"pulse/internal/auth"
	"pulse/internal/store"
)

func TestStatusPageHandlers(t *testing.T) {
	st := store.NewMemoryStore()
	h := NewHandler(st)
	verifier := &auth.DevVerifier{}
	mw := auth.Middleware(verifier)

	// Create test monitor
	now := time.Now().UTC()
	mon := &store.Monitor{
		ID:          "mon_sp_1",
		OwnerUID:    "user_owner",
		Name:        "Core API Gateway",
		Type:        store.MonitorTypeHTTP,
		URL:         "https://api.pulse.dev",
		Method:      "GET",
		IntervalSec: 60,
		State:       store.StateUp,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_ = st.CreateMonitor(context.Background(), mon)

	// Record a couple rollups for mon
	_ = st.RecordRollup(context.Background(), "mon_sp_1", 120, true, 20, 30, 30, 40, now.Add(-1*time.Hour))
	_ = st.RecordRollup(context.Background(), "mon_sp_1", 130, true, 20, 30, 30, 50, now)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/status-pages/{slug}", h.GetPublic)
	mux.Handle("GET /api/status-pages", mw(http.HandlerFunc(h.List)))
	mux.Handle("POST /api/status-pages", mw(http.HandlerFunc(h.Create)))
	mux.Handle("PATCH /api/status-pages/{id}", mw(http.HandlerFunc(h.Update)))
	mux.Handle("DELETE /api/status-pages/{id}", mw(http.HandlerFunc(h.Delete)))

	server := httptest.NewServer(mux)
	defer server.Close()

	t.Run("create status page with valid slug returns 201", func(t *testing.T) {
		body := `{"slug":"production-system","title":"Production Status","description":"Public uptime overview","isPublic":true,"monitorIds":["mon_sp_1"]}`
		req, _ := http.NewRequest(http.MethodPost, server.URL+"/api/status-pages", bytes.NewBufferString(body))
		req.Header.Set("Authorization", "Bearer dev:user_owner:owner@pulse.dev")
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("expected 201 Created, got %d", resp.StatusCode)
		}

		var created store.StatusPage
		_ = json.NewDecoder(resp.Body).Decode(&created)
		if created.Slug != "production-system" {
			t.Errorf("expected slug production-system, got %s", created.Slug)
		}
	})

	t.Run("create status page with duplicate slug returns 409 Conflict", func(t *testing.T) {
		body := `{"slug":"production-system","title":"Duplicate Page","isPublic":true}`
		req, _ := http.NewRequest(http.MethodPost, server.URL+"/api/status-pages", bytes.NewBufferString(body))
		req.Header.Set("Authorization", "Bearer dev:user_other:other@pulse.dev")
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusConflict {
			t.Fatalf("expected 409 Conflict for duplicate slug, got %d", resp.StatusCode)
		}
	})

	t.Run("create status page with invalid slug format returns 400 Bad Request", func(t *testing.T) {
		body := `{"slug":"-invalid--slug-","title":"Invalid Slug Page"}`
		req, _ := http.NewRequest(http.MethodPost, server.URL+"/api/status-pages", bytes.NewBufferString(body))
		req.Header.Set("Authorization", "Bearer dev:user_owner:owner@pulse.dev")
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 Bad Request for invalid slug format, got %d", resp.StatusCode)
		}
	})

	t.Run("public GET /api/status-pages/{slug} unauthenticated returns status and 100% uptime", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, server.URL+"/api/status-pages/production-system", nil)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 OK for public status page, got %d", resp.StatusCode)
		}

		var pub store.PublicStatusPageResponse
		if err := json.NewDecoder(resp.Body).Decode(&pub); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}

		if pub.Slug != "production-system" {
			t.Errorf("expected slug production-system, got %s", pub.Slug)
		}
		if pub.SystemState != "operational" {
			t.Errorf("expected systemState operational, got %s", pub.SystemState)
		}
		if len(pub.Monitors) != 1 {
			t.Fatalf("expected 1 monitor, got %d", len(pub.Monitors))
		}
		if pub.Monitors[0].Uptime30d != 100.0 {
			t.Errorf("expected 100%% uptime, got %f", pub.Monitors[0].Uptime30d)
		}
	})

	t.Run("public GET returns 404 for non-public status page", func(t *testing.T) {
		// Create a private status page
		privateSP := &store.StatusPage{
			ID:        "sp_private_1",
			OwnerUID:  "user_owner",
			Slug:      "internal-metrics",
			Title:     "Internal Metrics",
			IsPublic:  false,
			CreatedAt: now,
			UpdatedAt: now,
		}
		_ = st.CreateStatusPage(context.Background(), privateSP)

		req, _ := http.NewRequest(http.MethodGet, server.URL+"/api/status-pages/internal-metrics", nil)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("expected 404 Not Found for private page, got %d", resp.StatusCode)
		}
	})

	t.Run("public GET returns 404 for non-existent slug", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, server.URL+"/api/status-pages/does-not-exist", nil)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("expected 404 Not Found for non-existent slug, got %d", resp.StatusCode)
		}
	})

	t.Run("systemState reports outage when active monitor is down", func(t *testing.T) {
		// Mark monitor as down
		_ = st.UpdateMonitorState(context.Background(), "mon_sp_1", store.StateDown, 3, now.Add(time.Minute))

		req, _ := http.NewRequest(http.MethodGet, server.URL+"/api/status-pages/production-system", nil)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		defer resp.Body.Close()

		var pub store.PublicStatusPageResponse
		_ = json.NewDecoder(resp.Body).Decode(&pub)

		if pub.SystemState != "outage" {
			t.Errorf("expected systemState outage when sole monitor is down, got %s", pub.SystemState)
		}
	})
}
