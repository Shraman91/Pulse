package store

import (
	"context"
	"sync"
	"time"
)

// MemoryStore provides an in-memory thread-safe implementation of Store.
type MemoryStore struct {
	mu       sync.RWMutex
	monitors map[string]*Monitor
}

// NewMemoryStore initializes an empty in-memory store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		monitors: make(map[string]*Monitor),
	}
}

func (s *MemoryStore) CreateMonitor(ctx context.Context, m *Monitor) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Enforce 10 monitors per user
	count := 0
	for _, existing := range s.monitors {
		if existing.OwnerUID == m.OwnerUID {
			count++
		}
	}
	if count >= 10 {
		return ErrQuotaExceeded
	}

	clone := *m
	s.monitors[m.ID] = &clone
	return nil
}

func (s *MemoryStore) GetMonitor(ctx context.Context, id string) (*Monitor, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	m, exists := s.monitors[id]
	if !exists {
		return nil, ErrNotFound
	}
	clone := *m
	return &clone, nil
}

func (s *MemoryStore) ListMonitorsByOwner(ctx context.Context, ownerUID string) ([]*Monitor, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Monitor
	for _, m := range s.monitors {
		if m.OwnerUID == ownerUID {
			clone := *m
			result = append(result, &clone)
		}
	}
	return result, nil
}

func (s *MemoryStore) UpdateMonitor(ctx context.Context, ownerUID string, id string, req *UpdateMonitorRequest) (*Monitor, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	m, exists := s.monitors[id]
	if !exists {
		return nil, ErrNotFound
	}
	if m.OwnerUID != ownerUID {
		return nil, ErrUnauthorized
	}

	if req.Name != nil {
		m.Name = *req.Name
	}
	if req.URL != nil {
		m.URL = *req.URL
	}
	if req.Method != nil {
		m.Method = *req.Method
	}
	if req.IntervalSec != nil {
		m.IntervalSec = *req.IntervalSec
	}
	if req.TimeoutMs != nil {
		m.TimeoutMs = *req.TimeoutMs
	}
	if req.ExpectedStatus != nil {
		m.ExpectedStatus = *req.ExpectedStatus
	}
	if req.ExpectedEverySec != nil {
		m.ExpectedEverySec = *req.ExpectedEverySec
	}
	if req.GraceSec != nil {
		m.GraceSec = *req.GraceSec
	}
	if req.Paused != nil {
		m.Paused = *req.Paused
	}
	if req.AlertChannels != nil {
		m.AlertChannels = *req.AlertChannels
	}
	m.UpdatedAt = time.Now().UTC()

	clone := *m
	return &clone, nil
}

func (s *MemoryStore) DeleteMonitor(ctx context.Context, ownerUID string, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	m, exists := s.monitors[id]
	if !exists {
		return ErrNotFound
	}
	if m.OwnerUID != ownerUID {
		return ErrUnauthorized
	}

	delete(s.monitors, id)
	return nil
}

func (s *MemoryStore) CountMonitorsByOwner(ctx context.Context, ownerUID string) (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	count := 0
	for _, m := range s.monitors {
		if m.OwnerUID == ownerUID {
			count++
		}
	}
	return count, nil
}

func (s *MemoryStore) GetDueMonitors(ctx context.Context, now time.Time, limit int) ([]*Monitor, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Monitor
	for _, m := range s.monitors {
		if !m.Paused && (m.NextCheckAt.Before(now) || m.NextCheckAt.Equal(now)) {
			// Check if lease is active
			if m.LeaseUntil != nil && m.LeaseUntil.After(now) {
				continue
			}
			clone := *m
			result = append(result, &clone)
			if limit > 0 && len(result) >= limit {
				break
			}
		}
	}
	return result, nil
}

func (s *MemoryStore) AcquireLease(ctx context.Context, id string, leaseUntil time.Time, nextCheckAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	m, exists := s.monitors[id]
	if !exists {
		return ErrNotFound
	}

	m.LeaseUntil = &leaseUntil
	m.NextCheckAt = nextCheckAt
	m.UpdatedAt = time.Now().UTC()
	return nil
}

func (s *MemoryStore) UpdateMonitorState(ctx context.Context, id string, state MonitorState, consecutiveFailures int, nextCheckAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	m, exists := s.monitors[id]
	if !exists {
		return ErrNotFound
	}

	m.State = state
	m.ConsecutiveFailures = consecutiveFailures
	m.NextCheckAt = nextCheckAt
	m.LeaseUntil = nil
	m.UpdatedAt = time.Now().UTC()
	return nil
}

func (s *MemoryStore) GetMonitorByPingToken(ctx context.Context, token string) (*Monitor, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, m := range s.monitors {
		if m.Type == MonitorTypeHeartbeat && m.PingToken == token {
			clone := *m
			return &clone, nil
		}
	}
	return nil, ErrNotFound
}

func (s *MemoryStore) RecordHeartbeatPing(ctx context.Context, id string, pingTime time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	m, exists := s.monitors[id]
	if !exists {
		return ErrNotFound
	}

	m.LastPingAt = &pingTime
	m.ConsecutiveFailures = 0
	m.State = StateUp
	m.UpdatedAt = time.Now().UTC()
	return nil
}
