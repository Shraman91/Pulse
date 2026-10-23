package monitors

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"pulse/internal/auth"
	"pulse/internal/httpx"
	"pulse/internal/store"
)

// Handler manages monitor HTTP endpoints.
type Handler struct {
	store store.Store
}

// NewHandler creates a new monitor Handler.
func NewHandler(s store.Store) *Handler {
	return &Handler{store: s}
}

// CreateMonitorRequest represents the payload to create a new monitor.
type CreateMonitorRequest struct {
	Name             string               `json:"name"`
	Type             store.MonitorType    `json:"type"`
	URL              string               `json:"url"`
	Method           string               `json:"method"`
	IntervalSec      int                  `json:"intervalSec"`
	TimeoutMs        int                  `json:"timeoutMs"`
	ExpectedStatus   int                  `json:"expectedStatus"`
	ExpectedEverySec int                  `json:"expectedEverySec"`
	GraceSec         int                  `json:"graceSec"`
	AlertChannels    []store.AlertChannel `json:"alertChannels"`
}

// Create handles POST /api/monitors
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUser(r.Context())
	if !ok || user == nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req CreateMonitorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || len(req.Name) > 100 {
		httpx.Error(w, http.StatusBadRequest, "invalid name", "name must be between 1 and 100 characters")
		return
	}

	if req.Type == "" {
		req.Type = store.MonitorTypeHTTP
	}

	now := time.Now().UTC()
	monitor := &store.Monitor{
		ID:                  generateID("mon"),
		OwnerUID:            user.UID,
		Name:                req.Name,
		Type:                req.Type,
		State:               store.StateUnknown,
		ConsecutiveFailures: 0,
		NextCheckAt:         now,
		Paused:              false,
		AlertChannels:       req.AlertChannels,
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	if monitor.AlertChannels == nil {
		monitor.AlertChannels = []store.AlertChannel{}
	}

	switch req.Type {
	case store.MonitorTypeHTTP:
		if err := validateHTTPConfig(req, monitor); err != nil {
			httpx.Error(w, http.StatusBadRequest, "invalid HTTP monitor configuration", err.Error())
			return
		}
	case store.MonitorTypeHeartbeat:
		if err := validateHeartbeatConfig(req, monitor); err != nil {
			httpx.Error(w, http.StatusBadRequest, "invalid heartbeat monitor configuration", err.Error())
			return
		}
	default:
		httpx.Error(w, http.StatusBadRequest, "invalid monitor type", "must be 'http' or 'heartbeat'")
		return
	}

	if err := h.store.CreateMonitor(r.Context(), monitor); err != nil {
		if errors.Is(err, store.ErrQuotaExceeded) {
			httpx.Error(w, http.StatusForbidden, "quota exceeded", "maximum limit of 10 monitors reached")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "failed to create monitor", err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, monitor)
}

// List handles GET /api/monitors
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUser(r.Context())
	if !ok || user == nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	monitors, err := h.store.ListMonitorsByOwner(r.Context(), user.UID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to list monitors", err.Error())
		return
	}
	if monitors == nil {
		monitors = []*store.Monitor{}
	}

	httpx.JSON(w, http.StatusOK, monitors)
}

// Get handles GET /api/monitors/{id}
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUser(r.Context())
	if !ok || user == nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := r.PathValue("id")
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "missing monitor ID")
		return
	}

	m, err := h.store.GetMonitor(r.Context(), id)
	if err != nil || m.OwnerUID != user.UID {
		httpx.Error(w, http.StatusNotFound, "monitor not found")
		return
	}

	httpx.JSON(w, http.StatusOK, m)
}

// Update handles PATCH /api/monitors/{id}
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUser(r.Context())
	if !ok || user == nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := r.PathValue("id")
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "missing monitor ID")
		return
	}

	var req store.UpdateMonitorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	if req.URL != nil {
		parsedURL, err := url.ParseRequestURI(*req.URL)
		if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") || parsedURL.Host == "" {
			httpx.Error(w, http.StatusBadRequest, "invalid url", "url scheme must be http or https")
			return
		}
	}
	if req.IntervalSec != nil && (*req.IntervalSec < 60 || *req.IntervalSec > 86400) {
		httpx.Error(w, http.StatusBadRequest, "invalid intervalSec", "interval must be between 60 and 86400 seconds")
		return
	}
	if req.TimeoutMs != nil && (*req.TimeoutMs < 1000 || *req.TimeoutMs > 30000) {
		httpx.Error(w, http.StatusBadRequest, "invalid timeoutMs", "timeout must be between 1000 and 30000 ms")
		return
	}
	if req.ExpectedStatus != nil && (*req.ExpectedStatus < 100 || *req.ExpectedStatus > 599) {
		httpx.Error(w, http.StatusBadRequest, "invalid expectedStatus", "status code must be between 100 and 599")
		return
	}

	updated, err := h.store.UpdateMonitor(r.Context(), user.UID, id, &req)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, store.ErrUnauthorized) {
			httpx.Error(w, http.StatusNotFound, "monitor not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "failed to update monitor", err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, updated)
}

// Delete handles DELETE /api/monitors/{id}
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUser(r.Context())
	if !ok || user == nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := r.PathValue("id")
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "missing monitor ID")
		return
	}

	if err := h.store.DeleteMonitor(r.Context(), user.UID, id); err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, store.ErrUnauthorized) {
			httpx.Error(w, http.StatusNotFound, "monitor not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "failed to delete monitor", err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{
		"status": "deleted",
		"id":     id,
	})
}

// ListIncidents handles GET /api/incidents
func (h *Handler) ListIncidents(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUser(r.Context())
	if !ok || user == nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	incidents, err := h.store.ListIncidentsByOwner(r.Context(), user.UID, 50)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to list incidents", err.Error())
		return
	}
	if incidents == nil {
		incidents = []*store.Incident{}
	}

	httpx.JSON(w, http.StatusOK, incidents)
}

func validateHTTPConfig(req CreateMonitorRequest, m *store.Monitor) error {
	rawURL := strings.TrimSpace(req.URL)
	if rawURL == "" {
		return errors.New("url is required for HTTP monitors")
	}
	parsedURL, err := url.ParseRequestURI(rawURL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") || parsedURL.Host == "" {
		return errors.New("url scheme must be http or https with valid host")
	}
	m.URL = rawURL

	method := strings.ToUpper(strings.TrimSpace(req.Method))
	if method == "" {
		method = http.MethodGet
	}
	switch method {
	case http.MethodGet, http.MethodPost, http.MethodHead, http.MethodPut, http.MethodPatch, http.MethodDelete:
		m.Method = method
	default:
		return fmt.Errorf("unsupported HTTP method: %s", method)
	}

	if req.IntervalSec == 0 {
		m.IntervalSec = 300 // default 5 minutes
	} else if req.IntervalSec < 60 || req.IntervalSec > 86400 {
		return errors.New("intervalSec must be between 60 and 86400 seconds")
	} else {
		m.IntervalSec = req.IntervalSec
	}

	if req.TimeoutMs == 0 {
		m.TimeoutMs = 10000 // default 10 seconds
	} else if req.TimeoutMs < 1000 || req.TimeoutMs > 30000 {
		return errors.New("timeoutMs must be between 1000 and 30000 ms")
	} else {
		m.TimeoutMs = req.TimeoutMs
	}

	if req.ExpectedStatus == 0 {
		m.ExpectedStatus = http.StatusOK
	} else if req.ExpectedStatus < 100 || req.ExpectedStatus > 599 {
		return errors.New("expectedStatus must be between 100 and 599")
	} else {
		m.ExpectedStatus = req.ExpectedStatus
	}

	return nil
}

func validateHeartbeatConfig(req CreateMonitorRequest, m *store.Monitor) error {
	if req.ExpectedEverySec == 0 {
		m.ExpectedEverySec = 3600 // default 1 hour
	} else if req.ExpectedEverySec < 60 || req.ExpectedEverySec > 604800 {
		return errors.New("expectedEverySec must be between 60 and 604800 seconds (7 days)")
	} else {
		m.ExpectedEverySec = req.ExpectedEverySec
	}

	if req.GraceSec == 0 {
		m.GraceSec = 300 // default 5 minutes
	} else if req.GraceSec < 0 || req.GraceSec > 86400 {
		return errors.New("graceSec must be between 0 and 86400 seconds")
	} else {
		m.GraceSec = req.GraceSec
	}

	m.PingToken = generateSecureToken()
	return nil
}

func generateID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%s_%s", prefix, hex.EncodeToString(b))
}

func generateSecureToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
