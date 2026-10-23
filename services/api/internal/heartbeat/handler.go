package heartbeat

import (
	"log/slog"
	"net/http"
	"time"

	"pulse/internal/httpx"
	"pulse/internal/incidents"
	"pulse/internal/store"
)

// Handler manages heartbeat ping check-in requests.
type Handler struct {
	store        store.Store
	stateMachine *incidents.StateMachine
}

// NewHandler creates a new heartbeat Handler.
func NewHandler(st store.Store, sm *incidents.StateMachine) *Handler {
	return &Handler{
		store:        st,
		stateMachine: sm,
	}
}

// Ping handles GET, POST, or HEAD requests to /ping/{token}.
func (h *Handler) Ping(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	if token == "" {
		httpx.Error(w, http.StatusBadRequest, "missing ping token")
		return
	}

	ctx := r.Context()
	m, err := h.store.GetMonitorByPingToken(ctx, token)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "invalid ping token", "no monitor found for this token")
		return
	}

	now := time.Now().UTC()

	// If paused, acknowledge without changing health status
	if m.Paused {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok":      true,
			"status":  "paused",
			"message": "monitor is paused",
		})
		return
	}

	// If previously down, resolve incident and dispatch recovery alert
	if m.State == store.StateDown && h.stateMachine != nil {
		if _, _, err := h.stateMachine.ProcessHeartbeatRecovery(ctx, m, now); err != nil {
			slog.Error("failed to process heartbeat recovery", "monitorId", m.ID, "error", err)
		}
	}

	// Atomically record ping timestamp and update state to UP
	if err := h.store.RecordHeartbeatPing(ctx, m.ID, now); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to record ping", err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"monitorId":   m.ID,
		"monitorName": m.Name,
		"lastPingAt":  now.Format(time.RFC3339),
	})
}
