package statuspage

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"pulse/internal/auth"
	"pulse/internal/httpx"
	"pulse/internal/store"
)

var slugRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$`)

type Handler struct {
	store store.Store
}

func NewHandler(st store.Store) *Handler {
	return &Handler{store: st}
}

func generateID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}

// GetPublic handles GET /api/status-pages/{slug} (Public, unauthenticated)
func (h *Handler) GetPublic(w http.ResponseWriter, r *http.Request) {
	slug := strings.ToLower(strings.TrimSpace(r.PathValue("slug")))
	if slug == "" {
		httpx.Error(w, http.StatusBadRequest, "slug is required")
		return
	}

	ctx := r.Context()
	sp, err := h.store.GetStatusPageBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "status page not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "failed to load status page")
		return
	}

	if !sp.IsPublic {
		httpx.Error(w, http.StatusNotFound, "status page not found")
		return
	}

	now := time.Now().UTC()
	from30d := now.Add(-30 * 24 * time.Hour)

	var publicMonitors []store.PublicMonitorStatus
	var allIncidents []*store.Incident
	activeMonitorsCount := 0
	downMonitorsCount := 0

	for _, monID := range sp.MonitorIDs {
		mon, err := h.store.GetMonitor(ctx, monID)
		if err != nil {
			continue
		}

		if !mon.Paused {
			activeMonitorsCount++
			if mon.State == store.StateDown {
				downMonitorsCount++
			}
		}

		// Calculate 30-day rollups
		rollups, err := h.store.GetRollups(ctx, mon.ID, from30d, now)
		totalChecks := 0
		totalFailures := 0
		var bars []store.RollupPoint

		if err == nil {
			for _, r := range rollups {
				totalChecks += r.Checks
				totalFailures += r.Failures

				avgLat := int64(0)
				if r.Checks > 0 {
					avgLat = r.LatencySumMs / int64(r.Checks)
				}
				uptime := 100.0
				if r.Checks > 0 {
					uptime = float64(r.Checks-r.Failures) / float64(r.Checks) * 100.0
				}

				bars = append(bars, store.RollupPoint{
					Timestamp:    r.Hour,
					HourLabel:    r.Hour.Format("2006-01-02 15:04"),
					Checks:       r.Checks,
					Failures:     r.Failures,
					UptimePct:    uptime,
					AvgLatencyMs: avgLat,
					MaxLatencyMs: r.LatencyMaxMs,
				})
			}
		}

		uptime30d := 100.0
		if totalChecks > 0 {
			uptime30d = float64(totalChecks-totalFailures) / float64(totalChecks) * 100.0
		}

		publicMonitors = append(publicMonitors, store.PublicMonitorStatus{
			ID:         mon.ID,
			Name:       mon.Name,
			Type:       mon.Type,
			State:      mon.State,
			Uptime30d:  uptime30d,
			UptimeBars: bars,
		})

		// Fetch incidents for monitor
		incs, err := h.store.ListIncidentsByMonitor(ctx, mon.ID, 10)
		if err == nil {
			allIncidents = append(allIncidents, incs...)
		}
	}

	// Compute overall system health
	systemState := "operational"
	if activeMonitorsCount > 0 {
		if downMonitorsCount == activeMonitorsCount {
			systemState = "outage"
		} else if downMonitorsCount > 0 {
			systemState = "degraded"
		}
	}

	// Sort incidents descending by StartedAt, limit to 10
	sort.Slice(allIncidents, func(i, j int) bool {
		return allIncidents[i].StartedAt.After(allIncidents[j].StartedAt)
	})
	if len(allIncidents) > 10 {
		allIncidents = allIncidents[:10]
	}

	var publicIncs []store.PublicIncident
	for _, inc := range allIncidents {
		publicIncs = append(publicIncs, store.PublicIncident{
			ID:          inc.ID,
			MonitorName: inc.MonitorName,
			StartedAt:   inc.StartedAt,
			ResolvedAt:  inc.ResolvedAt,
			Cause:       inc.Cause,
		})
	}

	resp := store.PublicStatusPageResponse{
		Title:       sp.Title,
		Description: sp.Description,
		Slug:        sp.Slug,
		SystemState: systemState,
		Monitors:    publicMonitors,
		Incidents:   publicIncs,
		UpdatedAt:   now,
	}

	httpx.JSON(w, http.StatusOK, resp)
}

// Create handles POST /api/status-pages (Authenticated)
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUser(r.Context())
	if !ok || user == nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req store.CreateStatusPageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" || len(title) > 100 {
		httpx.Error(w, http.StatusBadRequest, "title must be between 1 and 100 characters")
		return
	}

	slug := strings.ToLower(strings.TrimSpace(req.Slug))
	if !slugRegex.MatchString(slug) {
		httpx.Error(w, http.StatusBadRequest, "slug must be 3-50 lowercase alphanumeric characters and hyphens (cannot start or end with a hyphen)")
		return
	}

	ctx := r.Context()

	// Verify all monitor IDs belong to the authenticated user
	for _, monID := range req.MonitorIDs {
		mon, err := h.store.GetMonitor(ctx, monID)
		if err != nil || mon.OwnerUID != user.UID {
			httpx.Error(w, http.StatusBadRequest, "invalid monitor selection: monitor does not exist or belong to user")
			return
		}
	}

	now := time.Now().UTC()
	sp := &store.StatusPage{
		ID:          generateID("sp"),
		OwnerUID:    user.UID,
		Slug:        slug,
		Title:       title,
		Description: strings.TrimSpace(req.Description),
		IsPublic:    req.IsPublic,
		MonitorIDs:  req.MonitorIDs,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := h.store.CreateStatusPage(ctx, sp); err != nil {
		if errors.Is(err, store.ErrSlugTaken) {
			httpx.Error(w, http.StatusConflict, "slug is already taken")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "failed to create status page")
		return
	}

	httpx.JSON(w, http.StatusCreated, sp)
}

// List handles GET /api/status-pages (Authenticated)
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUser(r.Context())
	if !ok || user == nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	list, err := h.store.ListStatusPagesByOwner(r.Context(), user.UID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to list status pages")
		return
	}

	httpx.JSON(w, http.StatusOK, list)
}

// Update handles PATCH /api/status-pages/{id} (Authenticated)
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUser(r.Context())
	if !ok || user == nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := r.PathValue("id")
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "status page id is required")
		return
	}

	var req store.UpdateStatusPageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Slug != nil {
		cleanedSlug := strings.ToLower(strings.TrimSpace(*req.Slug))
		if !slugRegex.MatchString(cleanedSlug) {
			httpx.Error(w, http.StatusBadRequest, "slug must be 3-50 lowercase alphanumeric characters and hyphens")
			return
		}
		req.Slug = &cleanedSlug
	}

	if req.Title != nil {
		cleanedTitle := strings.TrimSpace(*req.Title)
		if cleanedTitle == "" || len(cleanedTitle) > 100 {
			httpx.Error(w, http.StatusBadRequest, "title must be between 1 and 100 characters")
			return
		}
		req.Title = &cleanedTitle
	}

	ctx := r.Context()
	if req.MonitorIDs != nil {
		for _, monID := range *req.MonitorIDs {
			mon, err := h.store.GetMonitor(ctx, monID)
			if err != nil || mon.OwnerUID != user.UID {
				httpx.Error(w, http.StatusBadRequest, "invalid monitor selection")
				return
			}
		}
	}

	sp, err := h.store.UpdateStatusPage(ctx, user.UID, id, &req)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "status page not found")
			return
		}
		if errors.Is(err, store.ErrUnauthorized) {
			httpx.Error(w, http.StatusForbidden, "unauthorized")
			return
		}
		if errors.Is(err, store.ErrSlugTaken) {
			httpx.Error(w, http.StatusConflict, "slug is already taken")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "failed to update status page")
		return
	}

	httpx.JSON(w, http.StatusOK, sp)
}

// Delete handles DELETE /api/status-pages/{id} (Authenticated)
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUser(r.Context())
	if !ok || user == nil {
		httpx.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := r.PathValue("id")
	if id == "" {
		httpx.Error(w, http.StatusBadRequest, "status page id is required")
		return
	}

	if err := h.store.DeleteStatusPage(r.Context(), user.UID, id); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "status page not found")
			return
		}
		if errors.Is(err, store.ErrUnauthorized) {
			httpx.Error(w, http.StatusForbidden, "unauthorized")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "failed to delete status page")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
