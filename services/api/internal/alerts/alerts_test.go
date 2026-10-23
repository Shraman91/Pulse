package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"pulse/internal/auth"
	"pulse/internal/incidents"
	"pulse/internal/store"
)

func TestDiscordAlert(t *testing.T) {
	var receivedBody DiscordWebhook
	var receivedContentType string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedContentType = r.Header.Get("Content-Type")
		bodyBytes, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(bodyBytes, &receivedBody)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	payload := &Payload{
		Type:        incidents.EventDown,
		MonitorID:   "mon_1",
		MonitorName: "API Gateway",
		TargetURL:   "https://api.example.com",
		Cause:       "connection refused",
		Timestamp:   time.Now().UTC(),
	}

	client := server.Client()
	fastRetry := RetryConfig{MaxAttempts: 1, BaseDelay: 10 * time.Millisecond}

	err := SendDiscord(context.Background(), client, server.URL, payload, fastRetry)
	if err != nil {
		t.Fatalf("expected SendDiscord to succeed, got %v", err)
	}

	if receivedContentType != "application/json" {
		t.Errorf("expected application/json, got %s", receivedContentType)
	}
	if len(receivedBody.Embeds) != 1 {
		t.Fatalf("expected 1 embed, got %d", len(receivedBody.Embeds))
	}
	embed := receivedBody.Embeds[0]
	if embed.Color != DiscordColorDown {
		t.Errorf("expected color %d, got %d", DiscordColorDown, embed.Color)
	}
	if embed.Title != "🚨 [DOWN] API Gateway" {
		t.Errorf("unexpected embed title: %s", embed.Title)
	}

	// Test Recovery payload
	payload.Type = incidents.EventRecovery
	payload.Duration = 125 * time.Second // 2m 5s
	err = SendDiscord(context.Background(), client, server.URL, payload, fastRetry)
	if err != nil {
		t.Fatalf("expected SendDiscord recovery to succeed, got %v", err)
	}
	embed = receivedBody.Embeds[0]
	if embed.Color != DiscordColorRecovery {
		t.Errorf("expected color %d, got %d", DiscordColorRecovery, embed.Color)
	}
	if embed.Title != "✅ [RECOVERED] API Gateway" {
		t.Errorf("unexpected embed title: %s", embed.Title)
	}
}

func TestSlackAlert(t *testing.T) {
	var receivedBody SlackWebhook

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		bodyBytes, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(bodyBytes, &receivedBody)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	payload := &Payload{
		Type:        incidents.EventDown,
		MonitorID:   "mon_2",
		MonitorName: "Auth Service",
		TargetURL:   "https://auth.example.com",
		Cause:       "HTTP 502",
		Timestamp:   time.Now().UTC(),
	}

	client := server.Client()
	fastRetry := RetryConfig{MaxAttempts: 1, BaseDelay: 10 * time.Millisecond}

	err := SendSlack(context.Background(), client, server.URL, payload, fastRetry)
	if err != nil {
		t.Fatalf("expected SendSlack to succeed, got %v", err)
	}

	if len(receivedBody.Blocks) < 2 {
		t.Fatalf("expected at least 2 blocks, got %d", len(receivedBody.Blocks))
	}
	if receivedBody.Blocks[0].Text.Text != "🚨 [DOWN] Auth Service" {
		t.Errorf("unexpected header block: %s", receivedBody.Blocks[0].Text.Text)
	}
}

func TestTelegramAlert(t *testing.T) {
	var receivedBody TelegramMessage
	var requestPath string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestPath = r.URL.Path
		bodyBytes, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(bodyBytes, &receivedBody)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	payload := &Payload{
		Type:        incidents.EventDown,
		MonitorID:   "mon_3",
		MonitorName: "Database Check",
		TargetURL:   "https://db.example.com",
		Cause:       "timeout after 10000ms",
		Timestamp:   time.Now().UTC(),
	}

	client := server.Client()
	fastRetry := RetryConfig{MaxAttempts: 1, BaseDelay: 10 * time.Millisecond}

	// Test Target with botToken:chatID
	token, chatID, err := ParseTelegramTarget("123456:bot_secret:987654", "")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if token != "123456:bot_secret" || chatID != "987654" {
		t.Errorf("unexpected parse result: token=%s, chatID=%s", token, chatID)
	}

	// Test Target with chatID and default token
	token, chatID, err = ParseTelegramTarget("-100987654", "default_token_xyz")
	if err != nil {
		t.Fatalf("unexpected parse error: %v", err)
	}
	if token != "default_token_xyz" || chatID != "-100987654" {
		t.Errorf("unexpected parse result: token=%s, chatID=%s", token, chatID)
	}

	// Test invalid target with no default token
	_, _, err = ParseTelegramTarget("-100987654", "")
	if err == nil {
		t.Fatal("expected error when no bot token provided")
	}

	// Execute SendTelegram against local server via redirect trick or direct URL
	// We'll test ExecuteWithRetry with telegram message body
	msg := TelegramMessage{
		ChatID:    "987654",
		Text:      BuildTelegramText(payload),
		ParseMode: "HTML",
	}
	body, _ := json.Marshal(msg)
	err = ExecuteWithRetry(context.Background(), fastRetry, func(attemptCtx context.Context) (*http.Response, error) {
		req, _ := http.NewRequestWithContext(attemptCtx, http.MethodPost, server.URL+"/botToken/sendMessage", bytes.NewReader(body))
		return client.Do(req)
	})
	if err != nil {
		t.Fatalf("expected telegram execution to succeed, got %v", err)
	}
	if requestPath != "/botToken/sendMessage" {
		t.Errorf("unexpected request path: %s", requestPath)
	}
	if receivedBody.ChatID != "987654" {
		t.Errorf("expected chat id 987654, got %s", receivedBody.ChatID)
	}
}

func TestRetryMechanism(t *testing.T) {
	t.Run("succeeds on 2nd attempt after 500 error", func(t *testing.T) {
		var attempts int32
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			att := atomic.AddInt32(&attempts, 1)
			if att == 1 {
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte("temporary glitch"))
				return
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		cfg := RetryConfig{MaxAttempts: 3, BaseDelay: 10 * time.Millisecond}
		err := ExecuteWithRetry(context.Background(), cfg, func(ctx context.Context) (*http.Response, error) {
			req, _ := http.NewRequestWithContext(ctx, http.MethodPost, server.URL, nil)
			return server.Client().Do(req)
		})

		if err != nil {
			t.Fatalf("expected retry to succeed on 2nd attempt, got %v", err)
		}
		if atomic.LoadInt32(&attempts) != 2 {
			t.Errorf("expected 2 attempts, got %d", atomic.LoadInt32(&attempts))
		}
	})

	t.Run("fatal 404 client error stops without retrying", func(t *testing.T) {
		var attempts int32
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			atomic.AddInt32(&attempts, 1)
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte("Webhook Not Found"))
		}))
		defer server.Close()

		cfg := RetryConfig{MaxAttempts: 3, BaseDelay: 10 * time.Millisecond}
		err := ExecuteWithRetry(context.Background(), cfg, func(ctx context.Context) (*http.Response, error) {
			req, _ := http.NewRequestWithContext(ctx, http.MethodPost, server.URL, nil)
			return server.Client().Do(req)
		})

		if err == nil {
			t.Fatal("expected error for 404, got nil")
		}
		if atomic.LoadInt32(&attempts) != 1 {
			t.Errorf("expected exactly 1 attempt for 404, got %d", atomic.LoadInt32(&attempts))
		}
	})
}

func TestDispatcherAsyncAndShutdown(t *testing.T) {
	var deliveredCount int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&deliveredCount, 1)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	retryCfg := RetryConfig{MaxAttempts: 1, BaseDelay: 10 * time.Millisecond}
	dispatcher := NewDispatcher(server.Client(), "", 3, 50, retryCfg)

	event := &incidents.AlertEvent{
		Type: incidents.EventDown,
		Monitor: &store.Monitor{
			ID:   "mon_async",
			Name: "Async Target",
			URL:  "https://async.example.com",
			AlertChannels: []store.AlertChannel{
				{Type: "discord", Target: server.URL},
				{Type: "slack", Target: server.URL},
			},
		},
		Cause:     "timeout",
		Timestamp: time.Now().UTC(),
	}

	dispatcher.Dispatch(context.Background(), event)

	// Close dispatcher and ensure all jobs drained
	dispatcher.Close()

	if atomic.LoadInt32(&deliveredCount) != 2 {
		t.Errorf("expected 2 delivered alerts across channels, got %d", atomic.LoadInt32(&deliveredCount))
	}
}

func TestAlertHTTPHandler(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	retryCfg := RetryConfig{MaxAttempts: 1, BaseDelay: 10 * time.Millisecond}
	dispatcher := NewDispatcher(server.Client(), "", 1, 10, retryCfg)
	defer dispatcher.Close()

	handler := NewHandler(dispatcher)
	verifier := &auth.DevVerifier{}
	mw := auth.Middleware(verifier)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/alerts/test", handler.TestAlert)
	app := mw(mux)

	t.Run("unauthenticated request returns 401", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/alerts/test", nil)
		rec := httptest.NewRecorder()
		app.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", rec.Code)
		}
	})

	t.Run("valid test alert returns 200", func(t *testing.T) {
		payload := TestAlertRequest{
			Channel: store.AlertChannel{
				Type:   "discord",
				Target: server.URL,
			},
			MonitorName: "Test Webhook Endpoint",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/api/alerts/test", bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer dev:user_123:user@pulse.dev")
		rec := httptest.NewRecorder()
		app.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d (body: %s)", rec.Code, rec.Body.String())
		}

		var res TestAlertResponse
		_ = json.Unmarshal(rec.Body.Bytes(), &res)
		if !res.OK {
			t.Errorf("expected OK=true, got %v", res.OK)
		}
	})
}
