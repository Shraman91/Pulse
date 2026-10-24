package monitors

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"pulse/internal/auth"
	"pulse/internal/httpx"
	"pulse/internal/store"
)

// Stats handles GET /api/monitors/{id}/stats?range=24h|7d|30d
func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
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

	ctx := r.Context()
	m, err := h.store.GetMonitor(ctx, id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			httpx.Error(w, http.StatusNotFound, "monitor not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "failed to get monitor", err.Error())
		return
	}

	if m.OwnerUID != user.UID {
		httpx.Error(w, http.StatusNotFound, "monitor not found")
		return
	}

	rangeParam := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("range")))
	if rangeParam == "" {
		rangeParam = "24h"
	}

	now := time.Now().UTC()
	var from time.Time
	switch rangeParam {
	case "24h":
		from = now.Add(-24 * time.Hour)
	case "7d":
		from = now.Add(-7 * 24 * time.Hour)
	case "30d":
		from = now.Add(-30 * 24 * time.Hour)
	default:
		httpx.Error(w, http.StatusBadRequest, "invalid range", "range must be '24h', '7d', or '30d'")
		return
	}

	rollups, err := h.store.GetRollups(ctx, id, from, now)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to retrieve rollups", err.Error())
		return
	}

	totalChecks := 0
	totalFailures := 0
	var totalLatencySum int64
	var maxLatency int64
	points := make([]store.RollupPoint, len(rollups))

	for i, r := range rollups {
		avgLatency := int64(0)
		avgDNS := int64(0)
		avgConnect := int64(0)
		avgTLS := int64(0)
		avgTTFB := int64(0)
		uptime := 100.0

		if r.Checks > 0 {
			avgLatency = r.LatencySumMs / int64(r.Checks)
			avgDNS = r.DNSSumMs / int64(r.Checks)
			avgConnect = r.ConnectSumMs / int64(r.Checks)
			avgTLS = r.TLSSumMs / int64(r.Checks)
			avgTTFB = r.TTFBSumMs / int64(r.Checks)
			uptime = float64(r.Checks-r.Failures) / float64(r.Checks) * 100.0
		}

		totalChecks += r.Checks
		totalFailures += r.Failures
		totalLatencySum += r.LatencySumMs
		if r.LatencyMaxMs > maxLatency {
			maxLatency = r.LatencyMaxMs
		}

		hourLabel := r.Hour.Format("15:04")
		if rangeParam != "24h" {
			hourLabel = r.Hour.Format("Jan 02 15:04")
		}

		points[i] = store.RollupPoint{
			Timestamp:         r.Hour,
			Hour:              r.Hour.Format(time.RFC3339),
			HourLabel:         hourLabel,
			Checks:            r.Checks,
			Failures:          r.Failures,
			UptimePct:         uptime,
			AvgLatencyMs:      avgLatency,
			MaxLatencyMs:      r.LatencyMaxMs,
			AvgDNSMs:          avgDNS,
			AvgConnectMs:      avgConnect,
			AvgTLSHandshakeMs: avgTLS,
			AvgTTFBMs:         avgTTFB,
			DNSMs:             avgDNS,
			ConnectMs:         avgConnect,
			TLSHandshakeMs:    avgTLS,
			TTFBMs:            avgTTFB,
		}
	}

	overallUptime := 100.0
	var avgLatencyTotal int64
	if totalChecks > 0 {
		overallUptime = float64(totalChecks-totalFailures) / float64(totalChecks) * 100.0
		avgLatencyTotal = totalLatencySum / int64(totalChecks)
	}

	stats := &store.MonitorStats{
		MonitorID:     id,
		Range:         rangeParam,
		TotalChecks:   totalChecks,
		TotalFailures: totalFailures,
		UptimePct:     overallUptime,
		AvgLatencyMs:  avgLatencyTotal,
		MaxLatencyMs:  maxLatency,
		Points:        points,
	}

	httpx.JSON(w, http.StatusOK, stats)
}
