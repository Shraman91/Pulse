package alerts

import (
	"time"

	"pulse/internal/incidents"
	"pulse/internal/store"
)

// Payload represents the normalized notification details sent to alert channels.
type Payload struct {
	Type        incidents.EventType `json:"type"` // "DOWN", "UP", or "TEST"
	MonitorID   string              `json:"monitorId"`
	MonitorName string              `json:"monitorName"`
	TargetURL   string              `json:"targetUrl,omitempty"`
	Cause       string              `json:"cause,omitempty"`
	Duration    time.Duration       `json:"duration,omitempty"`
	Timestamp   time.Time           `json:"timestamp"`
}

// TestAlertRequest represents the request body for POST /api/alerts/test
type TestAlertRequest struct {
	Channel     store.AlertChannel `json:"channel"`
	MonitorName string             `json:"monitorName,omitempty"`
}

// TestAlertResponse represents the response body for POST /api/alerts/test
type TestAlertResponse struct {
	OK      bool   `json:"ok"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}
