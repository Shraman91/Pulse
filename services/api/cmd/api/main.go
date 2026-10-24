package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"pulse/internal/alerts"
	"pulse/internal/auth"
	"pulse/internal/checker"
	"pulse/internal/config"
	"pulse/internal/heartbeat"
	"pulse/internal/httpx"
	"pulse/internal/incidents"
	"pulse/internal/monitors"
	"pulse/internal/scheduler"
	"pulse/internal/statuspage"
	"pulse/internal/store"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg := config.Load()
	slog.Info("starting Pulse API service", "port", cfg.Port, "store", cfg.StoreType, "env", cfg.Environment)

	// Persistence store setup
	var st store.Store
	if cfg.StoreType == "memory" {
		st = store.NewMemoryStore()
		slog.Info("using in-memory store adapter")
	} else {
		// Production/emulator store adapter fallback to memory in dev if credentials not yet configured
		st = store.NewMemoryStore()
		slog.Info("store initialized", "type", cfg.StoreType)
	}

	// Auth verifier
	verifier := &auth.DevVerifier{}
	authMw := auth.Middleware(verifier)

	// Handler initialization
	alertsDispatcher := alerts.NewDispatcher(nil, cfg.TelegramBotToken, 2, 50, alerts.DefaultRetryConfig)
	defer alertsDispatcher.Close()
	alertsHandler := alerts.NewHandler(alertsDispatcher)

	stateMachine := incidents.NewStateMachine(st, incidents.RealClock{}, alertsDispatcher.Dispatch)
	monitorsHandler := monitors.NewHandler(st)
	heartbeatHandler := heartbeat.NewHandler(st, stateMachine)
	statusPageHandler := statuspage.NewHandler(st)

	rootCtx, cancelRoot := context.WithCancel(context.Background())
	defer cancelRoot()

	// Start embedded scheduler so checks execute against the store
	if os.Getenv("DISABLE_EMBEDDED_WORKER") != "true" {
		chk := checker.NewChecker()
		sched := scheduler.New(st, chk,
			scheduler.WithWorkers(cfg.WorkerConcurrency),
			scheduler.WithTickInterval(time.Duration(cfg.CheckIntervalSec)*time.Second),
			scheduler.WithStateMachine(stateMachine),
		)
		slog.Info("starting embedded scheduler worker pool",
			"workers", cfg.WorkerConcurrency,
			"interval_sec", cfg.CheckIntervalSec,
		)
		go sched.Start(rootCtx)
	}

	mux := http.NewServeMux()

	// Public routes
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"status":  "ok",
			"service": "pulse-api",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})
	mux.HandleFunc("/ping/{token}", heartbeatHandler.Ping)
	mux.HandleFunc("GET /api/status-pages/{slug}", statusPageHandler.GetPublic)

	// Protected monitor CRUD & incident routes
	mux.Handle("POST /api/monitors", authMw(http.HandlerFunc(monitorsHandler.Create)))
	mux.Handle("GET /api/monitors", authMw(http.HandlerFunc(monitorsHandler.List)))
	mux.Handle("GET /api/monitors/{id}", authMw(http.HandlerFunc(monitorsHandler.Get)))
	mux.Handle("PATCH /api/monitors/{id}", authMw(http.HandlerFunc(monitorsHandler.Update)))
	mux.Handle("DELETE /api/monitors/{id}", authMw(http.HandlerFunc(monitorsHandler.Delete)))
	mux.Handle("GET /api/monitors/{id}/stats", authMw(http.HandlerFunc(monitorsHandler.Stats)))
	mux.Handle("GET /api/incidents", authMw(http.HandlerFunc(monitorsHandler.ListIncidents)))
	mux.Handle("POST /api/alerts/test", authMw(http.HandlerFunc(alertsHandler.TestAlert)))

	// Protected status page CRUD routes
	mux.Handle("GET /api/status-pages", authMw(http.HandlerFunc(statusPageHandler.List)))
	mux.Handle("POST /api/status-pages", authMw(http.HandlerFunc(statusPageHandler.Create)))
	mux.Handle("PATCH /api/status-pages/{id}", authMw(http.HandlerFunc(statusPageHandler.Update)))
	mux.Handle("DELETE /api/status-pages/{id}", authMw(http.HandlerFunc(statusPageHandler.Delete)))

	handler := httpx.WithCORS(cfg.AllowedOrigins, mux)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	shutdownErr := make(chan error, 1)
	go func() {
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			shutdownErr <- err
		}
	}()

	slog.Info("Pulse API listening", "addr", server.Addr)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-shutdownErr:
		slog.Error("server fatal error", "error", err)
	case sig := <-quit:
		slog.Info("shutting down server gracefully", "signal", sig.String())
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			slog.Error("graceful shutdown failed", "error", err)
		} else {
			slog.Info("server exited cleanly")
		}
	}
}
