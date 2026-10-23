package alerts

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"math/rand"
	"net/http"
	"time"
)

// RetryConfig controls the exponential backoff parameters.
type RetryConfig struct {
	MaxAttempts int
	BaseDelay   time.Duration
}

// DefaultRetryConfig provides sensible defaults (3 attempts, 150ms initial backoff).
var DefaultRetryConfig = RetryConfig{
	MaxAttempts: 3,
	BaseDelay:   150 * time.Millisecond,
}

// ExecuteWithRetry invokes sendFn with exponential backoff and jitter.
// - 2xx responses are treated as success.
// - 429 and 5xx responses or network errors trigger retries up to MaxAttempts.
// - 4xx responses (other than 429) fail immediately without wasteful retries.
func ExecuteWithRetry(ctx context.Context, cfg RetryConfig, sendFn func(attemptCtx context.Context) (*http.Response, error)) error {
	if cfg.MaxAttempts <= 0 {
		cfg.MaxAttempts = 3
	}
	if cfg.BaseDelay <= 0 {
		cfg.BaseDelay = 150 * time.Millisecond
	}

	var lastErr error

	for attempt := 1; attempt <= cfg.MaxAttempts; attempt++ {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		resp, err := sendFn(ctx)
		if err != nil {
			lastErr = err
			slog.Warn("alert delivery network error", "attempt", attempt, "max", cfg.MaxAttempts, "error", err)
		} else {
			// Read body snippet for error diagnostics if needed
			bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
			resp.Body.Close()

			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				return nil
			}

			// Permanent client errors (4xx except 429) should not retry
			if resp.StatusCode >= 400 && resp.StatusCode < 500 && resp.StatusCode != http.StatusTooManyRequests {
				errMsg := string(bodyBytes)
				if errMsg == "" {
					errMsg = http.StatusText(resp.StatusCode)
				}
				return fmt.Errorf("alert delivery client error: %d - %s", resp.StatusCode, errMsg)
			}

			// 429 or 5xx: retryable
			lastErr = fmt.Errorf("alert delivery server error: %d (response: %s)", resp.StatusCode, string(bodyBytes))
			slog.Warn("alert delivery server error, retrying", "attempt", attempt, "status", resp.StatusCode)
		}

		if attempt < cfg.MaxAttempts {
			// Exponential backoff: base * 2^(attempt-1) + jitter
			backoff := cfg.BaseDelay * (1 << (attempt - 1))
			jitter := time.Duration(rand.Int63n(int64(backoff) / 2))
			sleepDuration := backoff + jitter

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(sleepDuration):
			}
		}
	}

	return fmt.Errorf("alert delivery failed after %d attempts: %w", cfg.MaxAttempts, lastErr)
}
