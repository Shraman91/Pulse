package store

import (
	"context"
	"time"
)

// Store defines the persistence contract for Pulse.
// All database operations are accessed through this interface.
type Store interface {
	// Monitor CRUD
	CreateMonitor(ctx context.Context, m *Monitor) error
	GetMonitor(ctx context.Context, id string) (*Monitor, error)
	ListMonitorsByOwner(ctx context.Context, ownerUID string) ([]*Monitor, error)
	UpdateMonitor(ctx context.Context, ownerUID string, id string, req *UpdateMonitorRequest) (*Monitor, error)
	DeleteMonitor(ctx context.Context, ownerUID string, id string) error
	CountMonitorsByOwner(ctx context.Context, ownerUID string) (int, error)

	// Scheduler & Lease operations
	GetDueMonitors(ctx context.Context, now time.Time, limit int) ([]*Monitor, error)
	AcquireLease(ctx context.Context, id string, leaseUntil time.Time, nextCheckAt time.Time) error
	UpdateMonitorState(ctx context.Context, id string, state MonitorState, consecutiveFailures int, nextCheckAt time.Time) error

	// Heartbeat operations
	GetMonitorByPingToken(ctx context.Context, token string) (*Monitor, error)
	RecordHeartbeatPing(ctx context.Context, id string, pingTime time.Time) error
}
