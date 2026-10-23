package store

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestMemoryStoreCRUD(t *testing.T) {
	ctx := context.Background()
	s := NewMemoryStore()

	ownerA := "user_a"
	ownerB := "user_b"

	// Create monitor for User A
	m1 := &Monitor{
		ID:             "mon_1",
		OwnerUID:       ownerA,
		Name:           "Production API",
		Type:           MonitorTypeHTTP,
		URL:            "https://api.example.com/health",
		Method:         "GET",
		IntervalSec:    300,
		TimeoutMs:      5000,
		ExpectedStatus: 200,
		State:          StateUnknown,
		NextCheckAt:    time.Now().UTC(),
		CreatedAt:      time.Now().UTC(),
		UpdatedAt:      time.Now().UTC(),
	}

	if err := s.CreateMonitor(ctx, m1); err != nil {
		t.Fatalf("failed to create monitor: %v", err)
	}

	// Fetch monitor
	fetched, err := s.GetMonitor(ctx, "mon_1")
	if err != nil {
		t.Fatalf("failed to get monitor: %v", err)
	}
	if fetched.Name != "Production API" {
		t.Errorf("expected name 'Production API', got '%s'", fetched.Name)
	}

	// Update monitor
	newName := "Production API v2"
	newPaused := true
	updated, err := s.UpdateMonitor(ctx, ownerA, "mon_1", &UpdateMonitorRequest{
		Name:   &newName,
		Paused: &newPaused,
	})
	if err != nil {
		t.Fatalf("failed to update monitor: %v", err)
	}
	if updated.Name != newName || !updated.Paused {
		t.Errorf("update failed to apply values")
	}

	// User B should NOT be able to update User A's monitor
	_, err = s.UpdateMonitor(ctx, ownerB, "mon_1", &UpdateMonitorRequest{Name: &newName})
	if err != ErrUnauthorized {
		t.Errorf("expected ErrUnauthorized for non-owner update, got %v", err)
	}

	// User B should NOT be able to delete User A's monitor
	if err := s.DeleteMonitor(ctx, ownerB, "mon_1"); err != ErrUnauthorized {
		t.Errorf("expected ErrUnauthorized for non-owner delete, got %v", err)
	}

	// Delete by Owner A
	if err := s.DeleteMonitor(ctx, ownerA, "mon_1"); err != nil {
		t.Fatalf("failed to delete monitor: %v", err)
	}

	// Verify not found
	_, err = s.GetMonitor(ctx, "mon_1")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound after deletion, got %v", err)
	}
}

func TestMemoryStoreQuotaLimit(t *testing.T) {
	ctx := context.Background()
	s := NewMemoryStore()
	owner := "quota_user"

	// Create 10 monitors (allowed)
	for i := 1; i <= 10; i++ {
		m := &Monitor{
			ID:          fmt.Sprintf("m_%d", i),
			OwnerUID:    owner,
			Name:        fmt.Sprintf("Monitor %d", i),
			Type:        MonitorTypeHTTP,
			URL:         "https://example.com",
			IntervalSec: 60,
			CreatedAt:   time.Now().UTC(),
			UpdatedAt:   time.Now().UTC(),
		}
		if err := s.CreateMonitor(ctx, m); err != nil {
			t.Fatalf("expected monitor %d to succeed, got %v", i, err)
		}
	}

	count, err := s.CountMonitorsByOwner(ctx, owner)
	if err != nil || count != 10 {
		t.Fatalf("expected 10 monitors, got %d", count)
	}

	// 11th monitor should fail with ErrQuotaExceeded
	m11 := &Monitor{
		ID:          "m_11",
		OwnerUID:    owner,
		Name:        "Monitor 11",
		Type:        MonitorTypeHTTP,
		URL:         "https://example.com",
		IntervalSec: 60,
	}
	err = s.CreateMonitor(ctx, m11)
	if err != ErrQuotaExceeded {
		t.Errorf("expected ErrQuotaExceeded for 11th monitor, got %v", err)
	}
}

func TestMemoryStoreSchedulerOperations(t *testing.T) {
	ctx := context.Background()
	s := NewMemoryStore()

	now := time.Now().UTC()

	// Due monitor
	mDue := &Monitor{
		ID:          "due_1",
		OwnerUID:    "user_1",
		NextCheckAt: now.Add(-10 * time.Second),
		Paused:      false,
	}
	// Future monitor
	mFuture := &Monitor{
		ID:          "future_1",
		OwnerUID:    "user_1",
		NextCheckAt: now.Add(60 * time.Second),
		Paused:      false,
	}
	// Paused monitor
	mPaused := &Monitor{
		ID:          "paused_1",
		OwnerUID:    "user_1",
		NextCheckAt: now.Add(-10 * time.Second),
		Paused:      true,
	}

	_ = s.CreateMonitor(ctx, mDue)
	_ = s.CreateMonitor(ctx, mFuture)
	_ = s.CreateMonitor(ctx, mPaused)

	due, err := s.GetDueMonitors(ctx, now, 10)
	if err != nil {
		t.Fatalf("failed to get due monitors: %v", err)
	}
	if len(due) != 1 || due[0].ID != "due_1" {
		t.Fatalf("expected 1 due monitor (due_1), got %d", len(due))
	}

	// Acquire lease
	leaseUntil := now.Add(30 * time.Second)
	nextCheck := now.Add(300 * time.Second)
	if err := s.AcquireLease(ctx, "due_1", leaseUntil, nextCheck); err != nil {
		t.Fatalf("failed to acquire lease: %v", err)
	}

	// Query again: should not return due_1 because lease is active
	dueAfterLease, _ := s.GetDueMonitors(ctx, now, 10)
	if len(dueAfterLease) != 0 {
		t.Errorf("expected 0 due monitors while lease active, got %d", len(dueAfterLease))
	}

	// Update state
	if err := s.UpdateMonitorState(ctx, "due_1", StateUp, 0, nextCheck); err != nil {
		t.Fatalf("failed to update monitor state: %v", err)
	}

	m, _ := s.GetMonitor(ctx, "due_1")
	if m.State != StateUp || m.LeaseUntil != nil {
		t.Errorf("expected StateUp and nil lease, got %s, %v", m.State, m.LeaseUntil)
	}
}
