package alerts

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"pulse/internal/auth"
	"pulse/internal/httpx"
	"pulse/internal/incidents"
)

// Handler manages alert HTTP endpoints.
type Handler struct {
	dispatcher *Dispatcher
}

// NewHandler creates a new alert Handler.
func NewHandler(d *Dispatcher) *Handler {
	return &Handler{dispatcher: d}
}

// TestAlert handles POST /api/alerts/test
func (h *Handler) TestAlert(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUser(r.Context())
	if !ok || user == nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req TestAlertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body", err.Error())
		return
	}

	req.Channel.Type = strings.ToLower(strings.TrimSpace(req.Channel.Type))
	req.Channel.Target = strings.TrimSpace(req.Channel.Target)

	if req.Channel.Type != "discord" && req.Channel.Type != "slack" && req.Channel.Type != "telegram" {
		httpx.Error(w, http.StatusBadRequest, "invalid channel type", "supported types: 'discord', 'slack', 'telegram'")
		return
	}

	if req.Channel.Target == "" {
		httpx.Error(w, http.StatusBadRequest, "missing channel target", "target webhook URL or chat ID is required")
		return
	}

	monitorName := strings.TrimSpace(req.MonitorName)
	if monitorName == "" {
		monitorName = "Sample Monitor"
	}

	payload := &Payload{
		Type:        incidents.EventType("TEST"),
		MonitorName: monitorName,
		TargetURL:   "https://pulse.dev",
		Cause:       "Test notification triggered from Pulse dashboard",
		Timestamp:   time.Now().UTC(),
	}

	if err := h.dispatcher.SendDirect(r.Context(), req.Channel, payload); err != nil {
		httpx.JSON(w, http.StatusBadRequest, TestAlertResponse{
			OK:    false,
			Error: err.Error(),
		})
		return
	}

	httpx.JSON(w, http.StatusOK, TestAlertResponse{
		OK:      true,
		Message: "Test notification delivered successfully!",
	})
}
