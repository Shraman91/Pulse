package config

import (
	"os"
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	os.Unsetenv("PORT")
	os.Unsetenv("WORKER_CONCURRENCY")
	os.Unsetenv("CHECK_INTERVAL_SEC")

	cfg := Load()

	if cfg.Port != "8080" {
		t.Errorf("expected default Port 8080, got %s", cfg.Port)
	}
	if cfg.WorkerConcurrency != 20 {
		t.Errorf("expected default WorkerConcurrency 20, got %d", cfg.WorkerConcurrency)
	}
	if cfg.CheckIntervalSec != 10 {
		t.Errorf("expected default CheckIntervalSec 10, got %d", cfg.CheckIntervalSec)
	}
	if cfg.StoreType != "memory" {
		t.Errorf("expected default StoreType memory, got %s", cfg.StoreType)
	}
}

func TestLoadCustomEnv(t *testing.T) {
	os.Setenv("PORT", "9090")
	os.Setenv("WORKER_CONCURRENCY", "40")
	os.Setenv("STORE_TYPE", "firestore")
	defer func() {
		os.Unsetenv("PORT")
		os.Unsetenv("WORKER_CONCURRENCY")
		os.Unsetenv("STORE_TYPE")
	}()

	cfg := Load()

	if cfg.Port != "9090" {
		t.Errorf("expected Port 9090, got %s", cfg.Port)
	}
	if cfg.WorkerConcurrency != 40 {
		t.Errorf("expected WorkerConcurrency 40, got %d", cfg.WorkerConcurrency)
	}
	if cfg.StoreType != "firestore" {
		t.Errorf("expected StoreType firestore, got %s", cfg.StoreType)
	}
}
