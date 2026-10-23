package checker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"pulse/internal/store"
)

func TestChecker(t *testing.T) {
	ctx := context.Background()

	t.Run("success check with httptrace timings", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("OK"))
		}))
		defer ts.Close()

		// Enable private IPs to reach local test server
		c := NewChecker(WithAllowPrivateIPs(true))
		m := &store.Monitor{
			ID:             "mon_success",
			URL:            ts.URL,
			Method:         "GET",
			ExpectedStatus: 200,
			TimeoutMs:      3000,
		}

		res, err := c.Check(ctx, m)
		if err != nil {
			t.Fatalf("unexpected checker execution error: %v", err)
		}

		if !res.OK {
			t.Errorf("expected res.OK == true, got false (error: %s)", res.Error)
		}
		if res.StatusCode != 200 {
			t.Errorf("expected StatusCode 200, got %d", res.StatusCode)
		}
		if res.LatencyMs < 0 {
			t.Errorf("expected non-negative latency, got %d", res.LatencyMs)
		}
		if res.TTFBMs < 0 {
			t.Errorf("expected non-negative TTFB, got %d", res.TTFBMs)
		}
	})

	t.Run("wrong status code returns failure", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte("Error"))
		}))
		defer ts.Close()

		c := NewChecker(WithAllowPrivateIPs(true))
		m := &store.Monitor{
			ID:             "mon_wrong_status",
			URL:            ts.URL,
			ExpectedStatus: 200,
			TimeoutMs:      3000,
		}

		res, err := c.Check(ctx, m)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if res.OK {
			t.Errorf("expected res.OK == false for 500 status")
		}
		if res.StatusCode != 500 {
			t.Errorf("expected StatusCode 500, got %d", res.StatusCode)
		}
		if !strings.Contains(res.Error, "expected status 200, got 500") {
			t.Errorf("unexpected error message: %s", res.Error)
		}
	})

	t.Run("timeout triggers context deadline exceeded", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Sleep longer than monitor timeout
			time.Sleep(300 * time.Millisecond)
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		c := NewChecker(WithAllowPrivateIPs(true))
		m := &store.Monitor{
			ID:             "mon_timeout",
			URL:            ts.URL,
			ExpectedStatus: 200,
			TimeoutMs:      50, // 50ms timeout
		}

		res, err := c.Check(ctx, m)
		if err != nil {
			t.Fatalf("unexpected check error: %v", err)
		}

		if res.OK {
			t.Errorf("expected res.OK == false on timeout")
		}
		if !strings.Contains(strings.ToLower(res.Error), "timeout") {
			t.Errorf("expected error to mention timeout, got: %s", res.Error)
		}
	})

	t.Run("connection refused for unreachable port", func(t *testing.T) {
		// Use a local port that is not listening
		c := NewChecker(WithAllowPrivateIPs(true))
		m := &store.Monitor{
			ID:             "mon_conn_refused",
			URL:            "http://127.0.0.1:49991",
			ExpectedStatus: 200,
			TimeoutMs:      1000,
		}

		res, err := c.Check(ctx, m)
		if err != nil {
			t.Fatalf("unexpected check error: %v", err)
		}

		if res.OK {
			t.Errorf("expected res.OK == false for connection refused")
		}
		if !strings.Contains(strings.ToLower(res.Error), "connection refused") && !strings.Contains(strings.ToLower(res.Error), "connect") {
			t.Errorf("expected error mentioning connection refused, got: %s", res.Error)
		}
	})

	t.Run("tls failure on untrusted self-signed certificate", func(t *testing.T) {
		// NewTLSServer creates a server with an untrusted self-signed cert
		ts := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))
		defer ts.Close()

		// Standard checker does not trust test CA -> TLS verification must fail
		c := NewChecker(WithAllowPrivateIPs(true))
		m := &store.Monitor{
			ID:             "mon_tls_fail",
			URL:            ts.URL,
			ExpectedStatus: 200,
			TimeoutMs:      3000,
		}

		res, err := c.Check(ctx, m)
		if err != nil {
			t.Fatalf("unexpected check error: %v", err)
		}

		if res.OK {
			t.Errorf("expected res.OK == false for untrusted certificate")
		}
		if !strings.Contains(strings.ToLower(res.Error), "tls") && !strings.Contains(strings.ToLower(res.Error), "certificate") {
			t.Errorf("expected error mentioning TLS or certificate failure, got: %s", res.Error)
		}
	})

	t.Run("blocked private and loopback addresses by SSRF guard", func(t *testing.T) {
		// Default checker has allowPrivateIPs = false
		c := NewChecker() // strict SSRF protection

		blockedTargets := []string{
			"http://127.0.0.1:8080/health",
			"http://127.0.0.2:9000",
			"http://10.0.0.5/api",
			"http://172.16.1.1",
			"http://192.168.1.1/admin",
			"http://169.254.169.254/latest/meta-data",
			"http://[::1]:8080",
			"http://[fe80::1]:80",
			"http://[fc00::1]:80",
		}

		for _, target := range blockedTargets {
			t.Run(target, func(t *testing.T) {
				m := &store.Monitor{
					ID:             "mon_ssrf",
					URL:            target,
					ExpectedStatus: 200,
					TimeoutMs:      1000,
				}

				res, err := c.Check(ctx, m)
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}

				if res.OK {
					t.Errorf("expected res.OK == false for blocked target %s", target)
				}
				if !strings.Contains(res.Error, "blocked address") && !strings.Contains(res.Error, "SSRF guard") {
					t.Errorf("expected SSRF block message for %s, got: %s", target, res.Error)
				}
			})
		}
	})
}
