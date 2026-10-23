package store

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
)

// MemoryStore provides an in-memory thread-safe implementation of Store.
type MemoryStore struct {
	mu            sync.RWMutex
	monitors      map[string]*Monitor
	incidents     map[string]*Incident
	checkFailures map[string][]*CheckFailure
	rollups       map[string]*Rollup
	statusPages   map[string]*StatusPage
}

// NewMemoryStore initializes an empty in-memory store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		monitors:      make(map[string]*Monitor),
		incidents:     make(map[string]*Incident),
		checkFailures: make(map[string][]*CheckFailure),
		rollups:       make(map[string]*Rollup),
		statusPages:   make(map[string]*StatusPage),
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

	now := time.Now().UTC()
	if m.LeaseUntil != nil && m.LeaseUntil.After(now) {
		return ErrLeaseContested
	}

	m.LeaseUntil = &leaseUntil
	m.NextCheckAt = nextCheckAt
	m.UpdatedAt = now
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
	window := m.ExpectedEverySec + m.GraceSec
	if window < 60 {
		window = 60
	}
	m.NextCheckAt = pingTime.Add(time.Duration(window) * time.Second)
	m.UpdatedAt = time.Now().UTC()
	return nil
}

func (s *MemoryStore) CreateIncident(ctx context.Context, inc *Incident) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	clone := *inc
	s.incidents[inc.ID] = &clone
	return nil
}

func (s *MemoryStore) GetActiveIncident(ctx context.Context, monitorID string) (*Incident, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, inc := range s.incidents {
		if inc.MonitorID == monitorID && inc.ResolvedAt == nil {
			clone := *inc
			return &clone, nil
		}
	}
	return nil, ErrNotFound
}

func (s *MemoryStore) ResolveIncident(ctx context.Context, incidentID string, resolvedAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	inc, exists := s.incidents[incidentID]
	if !exists {
		return ErrNotFound
	}

	inc.ResolvedAt = &resolvedAt
	return nil
}

func (s *MemoryStore) ListIncidentsByOwner(ctx context.Context, ownerUID string, limit int) ([]*Incident, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Incident
	for _, inc := range s.incidents {
		if inc.OwnerUID == ownerUID {
			clone := *inc
			result = append(result, &clone)
		}
	}

	// Sort by startedAt desc
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[i].StartedAt.Before(result[j].StartedAt) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	return result, nil
}

func (s *MemoryStore) ListIncidentsByMonitor(ctx context.Context, monitorID string, limit int) ([]*Incident, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Incident
	for _, inc := range s.incidents {
		if inc.MonitorID == monitorID {
			clone := *inc
			result = append(result, &clone)
		}
	}

	// Sort by startedAt desc
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[i].StartedAt.Before(result[j].StartedAt) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	return result, nil
}

func (s *MemoryStore) RecordCheckFailure(ctx context.Context, check *CheckFailure) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	clone := *check
	s.checkFailures[check.MonitorID] = append(s.checkFailures[check.MonitorID], &clone)
	return nil
}

func (s *MemoryStore) ListCheckFailures(ctx context.Context, monitorID string, limit int) ([]*CheckFailure, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	raw, exists := s.checkFailures[monitorID]
	if !exists {
		return []*CheckFailure{}, nil
	}

	result := make([]*CheckFailure, len(raw))
	for i, c := range raw {
		clone := *c
		result[i] = &clone
	}

	// Sort by ts desc
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[i].TS.Before(result[j].TS) {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	return result, nil
}

func (s *MemoryStore) RecordRollup(ctx context.Context, monitorID string, latencyMs int64, ok bool, dnsMs, connectMs, tlsMs, ttfbMs int64, ts time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	hourTime := time.Date(ts.Year(), ts.Month(), ts.Day(), ts.Hour(), 0, 0, 0, time.UTC)
	hourKey := hourTime.Format("2006010215")
	rollupKey := fmt.Sprintf("%s_%s", monitorID, hourKey)

	r, exists := s.rollups[rollupKey]
	if !exists {
		r = &Rollup{
			ID:        hourKey,
			MonitorID: monitorID,
			Hour:      hourTime,
		}
		s.rollups[rollupKey] = r
	}

	r.Checks++
	if !ok {
		r.Failures++
	}
	r.LatencySumMs += latencyMs
	if latencyMs > r.LatencyMaxMs {
		r.LatencyMaxMs = latencyMs
	}
	r.DNSSumMs += dnsMs
	r.ConnectSumMs += connectMs
	r.TLSSumMs += tlsMs
	r.TTFBSumMs += ttfbMs

	return nil
}

func (s *MemoryStore) GetRollups(ctx context.Context, monitorID string, from time.Time, to time.Time) ([]*Rollup, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*Rollup
	for _, r := range s.rollups {
		if r.MonitorID == monitorID && (r.Hour.Equal(from) || r.Hour.After(from)) && (r.Hour.Equal(to) || r.Hour.Before(to)) {
			clone := *r
			result = append(result, &clone)
		}
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].Hour.Before(result[j].Hour)
	})

	return result, nil
}

func (s *MemoryStore) CreateStatusPage(ctx context.Context, sp *StatusPage) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, existing := range s.statusPages {
		if existing.Slug == sp.Slug {
			return ErrSlugTaken
		}
	}

	clone := *sp
	s.statusPages[sp.ID] = &clone
	return nil
}

func (s *MemoryStore) GetStatusPageBySlug(ctx context.Context, slug string) (*StatusPage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, sp := range s.statusPages {
		if sp.Slug == slug {
			clone := *sp
			return &clone, nil
		}
	}
	return nil, ErrNotFound
}

func (s *MemoryStore) GetStatusPageByID(ctx context.Context, id string) (*StatusPage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sp, exists := s.statusPages[id]
	if !exists {
		return nil, ErrNotFound
	}
	clone := *sp
	return &clone, nil
}

func (s *MemoryStore) ListStatusPagesByOwner(ctx context.Context, ownerUID string) ([]*StatusPage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []*StatusPage
	for _, sp := range s.statusPages {
		if sp.OwnerUID == ownerUID {
			clone := *sp
			result = append(result, &clone)
		}
	}
	return result, nil
}

func (s *MemoryStore) UpdateStatusPage(ctx context.Context, ownerUID string, id string, req *UpdateStatusPageRequest) (*StatusPage, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	sp, exists := s.statusPages[id]
	if !exists {
		return nil, ErrNotFound
	}
	if sp.OwnerUID != ownerUID {
		return nil, ErrUnauthorized
	}

	if req.Slug != nil && *req.Slug != sp.Slug {
		for _, existing := range s.statusPages {
			if existing.ID != id && existing.Slug == *req.Slug {
				return nil, ErrSlugTaken
			}
		}
		sp.Slug = *req.Slug
	}

	if req.Title != nil {
		sp.Title = *req.Title
	}
	if req.Description != nil {
		sp.Description = *req.Description
	}
	if req.IsPublic != nil {
		sp.IsPublic = *req.IsPublic
	}
	if req.MonitorIDs != nil {
		sp.MonitorIDs = *req.MonitorIDs
	}
	sp.UpdatedAt = time.Now().UTC()

	clone := *sp
	return &clone, nil
}

func (s *MemoryStore) DeleteStatusPage(ctx context.Context, ownerUID string, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	sp, exists := s.statusPages[id]
	if !exists {
		return ErrNotFound
	}
	if sp.OwnerUID != ownerUID {
		return ErrUnauthorized
	}

	delete(s.statusPages, id)
	return nil
}

