package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"pulse/internal/config"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg := config.Load()
	slog.Info("starting Pulse Worker service",
		"concurrency", cfg.WorkerConcurrency,
		"check_interval_sec", cfg.CheckIntervalSec,
		"store_type", cfg.StoreType,
		"env", cfg.Environment,
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Capture OS interrupt signals
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	ticker := time.NewTicker(time.Duration(cfg.CheckIntervalSec) * time.Second)
	defer ticker.Stop()

	slog.Info("scheduler loop initialized and ready")

	for {
		select {
		case <-ctx.Done():
			slog.Info("worker context cancelled, exiting scheduler loop")
			return
		case sig := <-quit:
			slog.Info("received shutdown signal", "signal", sig.String())
			cancel()
			// Simulating grace period for active tasks
			slog.Info("waiting for in-flight worker tasks to drain...")
			time.Sleep(500 * time.Millisecond)
			slog.Info("worker service stopped cleanly")
			return
		case t := <-ticker.C:
			slog.Debug("scheduler heartbeat tick", "time", t.UTC().Format(time.RFC3339))
		}
	}
}
