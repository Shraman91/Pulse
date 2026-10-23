package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthMiddleware(t *testing.T) {
	verifier := &DevVerifier{}
	mw := Middleware(verifier)

	// Protected handler
	protectedHandler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := GetUser(r.Context())
		if !ok || user == nil {
			http.Error(w, "no user", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(user)
	}))

	t.Run("missing header returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/monitors", nil)
		rec := httptest.NewRecorder()

		protectedHandler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("malformed bearer header returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/monitors", nil)
		req.Header.Set("Authorization", "Basic 12345")
		rec := httptest.NewRecorder()

		protectedHandler.ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("valid mock token returns 200 with user injected", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/monitors", nil)
		req.Header.Set("Authorization", "Bearer dev:alice:alice@pulse.dev")
		rec := httptest.NewRecorder()

		protectedHandler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}

		var u User
		if err := json.Unmarshal(rec.Body.Bytes(), &u); err != nil {
			t.Fatalf("failed to decode user json: %v", err)
		}
		if u.UID != "alice" || u.Email != "alice@pulse.dev" {
			t.Errorf("unexpected user: %+v", u)
		}
	})
}
