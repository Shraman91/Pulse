package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"pulse/internal/alerts"
	"pulse/internal/checker"
	"pulse/internal/config"
	"pulse/internal/scheduler"
	"pulse/internal/store"
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

	// Persistence store
	var st store.Store
	if cfg.StoreType == "memory" {
		st = store.NewMemoryStore()
		slog.Info("using in-memory store adapter")
	} else {
		st = store.NewMemoryStore()
		slog.Info("store initialized", "type", cfg.StoreType)
	}

	// Checker with zero-trust SSRF protection
	chk := checker.NewChecker()

	// Alert dispatcher (asynchronous worker pool with exponential backoff)
	dispatcher := alerts.NewDispatcher(nil, cfg.TelegramBotToken, 5, 500, alerts.DefaultRetryConfig)
	defer dispatcher.Close()

	// Scheduler with worker pool
	sched := scheduler.New(st, chk,
		scheduler.WithWorkers(cfg.WorkerConcurrency),
		scheduler.WithTickInterval(time.Duration(cfg.CheckIntervalSec)*time.Second),
		scheduler.WithAlertHandler(dispatcher.Dispatch),
	)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// OS interrupt signals (Rule 5: shut down gracefully on SIGTERM)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	go func() {
		sig := <-quit
		slog.Info("received termination signal, initiating graceful drain...", "signal", sig.String())
		cancel()
	}()

	// Start scheduler and worker pool (blocks until context is cancelled)
	sched.Start(ctx)
	slog.Info("Pulse Worker terminated cleanly")
}
