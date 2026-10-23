package checker

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptrace"
	"strings"
	"time"

	"pulse/internal/store"
)

// Result records the telemetry and outcome of an HTTP check.
type Result struct {
	OK             bool      `json:"ok"`
	StatusCode     int       `json:"statusCode"`
	LatencyMs      int64     `json:"latencyMs"`
	DNSMs          int64     `json:"dnsMs"`
	ConnectMs      int64     `json:"connectMs"`
	TLSHandshakeMs int64     `json:"tlsMs"`
	TTFBMs         int64     `json:"ttfbMs"`
	Error          string    `json:"error,omitempty"`
	Timestamp      time.Time `json:"timestamp"`
}

// Option allows configuring the Checker.
type Option func(*Checker)

// WithAllowPrivateIPs controls whether SSRF protection allows private/loopback IPs.
// Should only be enabled in unit tests targeting httptest.Server.
func WithAllowPrivateIPs(allow bool) Option {
	return func(c *Checker) {
		c.allowPrivateIPs = allow
	}
}

// WithCustomTransport allows injecting a custom RoundTripper for specialized testing.
func WithCustomTransport(rt http.RoundTripper) Option {
	return func(c *Checker) {
		c.customTransport = rt
	}
}

// Checker executes network health checks against monitored endpoints.
type Checker struct {
	allowPrivateIPs bool
	customTransport http.RoundTripper
	userAgent       string
}

// NewChecker instantiates a new Checker with SSRF-safe dialer by default.
func NewChecker(opts ...Option) *Checker {
	c := &Checker{
		allowPrivateIPs: false,
		userAgent:       "Pulse-Uptime-Monitor/1.0 (+https://pulse.dev)",
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// Check runs an HTTP health check for the given monitor, capturing httptrace metrics.
func (c *Checker) Check(ctx context.Context, m *store.Monitor) (*Result, error) {
	result := &Result{
		Timestamp: time.Now().UTC(),
	}

	timeoutMs := m.TimeoutMs
	if timeoutMs <= 0 {
		timeoutMs = 10000 // default 10 seconds
	}

	// Rule 5: Every check uses a context with the monitor's timeout
	checkCtx, cancel := context.WithTimeout(ctx, time.Duration(timeoutMs)*time.Millisecond)
	defer cancel()

	var (
		dnsStart, dnsDone             time.Time
		connectStart, connectDone     time.Time
		tlsStart, tlsDone             time.Time
		firstByteTime                 time.Time
	)

	trace := &httptrace.ClientTrace{
		DNSStart: func(info httptrace.DNSStartInfo) {
			dnsStart = time.Now()
		},
		DNSDone: func(info httptrace.DNSDoneInfo) {
			dnsDone = time.Now()
		},
		ConnectStart: func(network, addr string) {
			if connectStart.IsZero() {
				connectStart = time.Now()
			}
		},
		ConnectDone: func(network, addr string, err error) {
			if connectDone.IsZero() {
				connectDone = time.Now()
			}
		},
		TLSHandshakeStart: func() {
			tlsStart = time.Now()
		},
		TLSHandshakeDone: func(state tls.ConnectionState, err error) {
			tlsDone = time.Now()
		},
		GotFirstResponseByte: func() {
			firstByteTime = time.Now()
		},
	}

	client := c.buildHTTPClient()

	method := m.Method
	if method == "" {
		method = http.MethodGet
	}

	req, err := http.NewRequestWithContext(httptrace.WithClientTrace(checkCtx, trace), method, m.URL, nil)
	if err != nil {
		result.OK = false
		result.Error = fmt.Sprintf("invalid request: %v", err)
		return result, nil
	}
	req.Header.Set("User-Agent", c.userAgent)

	start := time.Now()
	resp, err := client.Do(req)
	latency := time.Since(start)

	result.LatencyMs = latency.Milliseconds()

	// Compute detailed timing breakdowns
	if !dnsStart.IsZero() && !dnsDone.IsZero() {
		result.DNSMs = dnsDone.Sub(dnsStart).Milliseconds()
	}
	if !connectStart.IsZero() && !connectDone.IsZero() {
		result.ConnectMs = connectDone.Sub(connectStart).Milliseconds()
	}
	if !tlsStart.IsZero() && !tlsDone.IsZero() {
		result.TLSHandshakeMs = tlsDone.Sub(tlsStart).Milliseconds()
	}
	if !firstByteTime.IsZero() {
		result.TTFBMs = firstByteTime.Sub(start).Milliseconds()
	}

	if err != nil {
		result.OK = false
		result.Error = sanitizeError(err, checkCtx)
		return result, nil
	}
	defer resp.Body.Close()

	// Drain up to 1MB of response body to complete TTFB and keep-alive
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1024*1024))

	result.StatusCode = resp.StatusCode

	expectedStatus := m.ExpectedStatus
	if expectedStatus == 0 {
		expectedStatus = http.StatusOK
	}

	if resp.StatusCode == expectedStatus {
		result.OK = true
	} else {
		result.OK = false
		result.Error = fmt.Sprintf("expected status %d, got %d", expectedStatus, resp.StatusCode)
	}

	return result, nil
}

func (c *Checker) buildHTTPClient() *http.Client {
	if c.customTransport != nil {
		return &http.Client{
			Transport: c.customTransport,
			// Do not follow more than 5 redirects automatically
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 5 {
					return errors.New("stopped after 5 redirects")
				}
				return nil
			},
		}
	}

	dialer := &net.Dialer{
		Timeout:   10 * time.Second,
		KeepAlive: 30 * time.Second,
		Control:   NewSSRFDialControl(c.allowPrivateIPs),
	}

	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	return &http.Client{
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("stopped after 5 redirects")
			}
			return nil
		},
	}
}

func sanitizeError(err error, ctx context.Context) string {
	if err == nil {
		return ""
	}

	if errors.Is(ctx.Err(), context.DeadlineExceeded) || strings.Contains(err.Error(), "context deadline exceeded") {
		return "timeout: check exceeded configured timeout"
	}

	if errors.Is(err, ErrBlockedAddress) || strings.Contains(err.Error(), "blocked target") {
		return "blocked address: target resolved to private or link-local range (SSRF guard)"
	}

	if strings.Contains(err.Error(), "certificate") || strings.Contains(err.Error(), "tls") {
		return fmt.Sprintf("tls error: %v", err)
	}

	if strings.Contains(err.Error(), "connection refused") || strings.Contains(err.Error(), "connectex") {
		return "connection refused: target server is not accepting connections"
	}

	return err.Error()
}
