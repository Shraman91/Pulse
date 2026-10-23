package incidents

import (
	"sync"
	"time"
)

// Clock provides an interface for time operations, enabling deterministic testing.
type Clock interface {
	Now() time.Time
}

// RealClock uses the system's UTC clock.
type RealClock struct{}

func (RealClock) Now() time.Time {
	return time.Now().UTC()
}

// MockClock provides a thread-safe synthetic clock that can be stepped or set.
type MockClock struct {
	mu  sync.RWMutex
	now time.Time
}

// NewMockClock creates a mock clock initialized to the given time.
func NewMockClock(t time.Time) *MockClock {
	return &MockClock{now: t.UTC()}
}

func (m *MockClock) Now() time.Time {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.now
}

func (m *MockClock) Advance(d time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.now = m.now.Add(d)
}

func (m *MockClock) Set(t time.Time) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.now = t.UTC()
}
