package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"pulse/internal/httpx"
)

var (
	ErrInvalidToken = errors.New("invalid or expired token")
	ErrMissingToken = errors.New("missing authorization token")
)

type contextKey string

const userContextKey contextKey = "pulse.auth.user"

// User represents an authenticated Firebase user.
type User struct {
	UID   string `json:"uid"`
	Email string `json:"email"`
}

// GetUser retrieves the authenticated user from request context.
func GetUser(ctx context.Context) (*User, bool) {
	u, ok := ctx.Value(userContextKey).(*User)
	return u, ok && u != nil
}

// WithUser returns a new context containing the authenticated user.
func WithUser(ctx context.Context, u *User) context.Context {
	return context.WithValue(ctx, userContextKey, u)
}

// Verifier defines the interface for verifying auth tokens.
type Verifier interface {
	VerifyIDToken(ctx context.Context, token string) (*User, error)
}

// DevVerifier provides local & testing token verification.
// Supported formats:
// - "mock-<uid>" -> User{UID: "<uid>", Email: "<uid>@example.com"}
// - "dev:<uid>:<email>" -> User{UID: "<uid>", Email: "<email>"}
type DevVerifier struct{}

func (v *DevVerifier) VerifyIDToken(ctx context.Context, token string) (*User, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, ErrMissingToken
	}

	if strings.HasPrefix(token, "dev:") {
		parts := strings.Split(token, ":")
		if len(parts) >= 3 && parts[1] != "" {
			return &User{UID: parts[1], Email: parts[2]}, nil
		}
		if len(parts) >= 2 && parts[1] != "" {
			return &User{UID: parts[1], Email: fmt.Sprintf("%s@example.com", parts[1])}, nil
		}
	}

	if strings.HasPrefix(token, "mock-") {
		uid := strings.TrimPrefix(token, "mock-")
		if uid != "" {
			return &User{
				UID:   uid,
				Email: fmt.Sprintf("%s@example.com", uid),
			}, nil
		}
	}

	// Any non-empty string in dev mode without colon/mock can also be treated as a direct UID
	if len(token) > 2 && !strings.Contains(token, " ") {
		return &User{
			UID:   token,
			Email: fmt.Sprintf("%s@pulse.dev", token),
		}, nil
	}

	return nil, ErrInvalidToken
}

// Middleware creates an HTTP middleware enforcing Firebase authentication.
func Middleware(verifier Verifier) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				httpx.Error(w, http.StatusUnauthorized, "unauthorized", "missing Authorization header")
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				httpx.Error(w, http.StatusUnauthorized, "unauthorized", "invalid Authorization format, expected Bearer <token>")
				return
			}

			token := strings.TrimSpace(parts[1])
			if token == "" {
				httpx.Error(w, http.StatusUnauthorized, "unauthorized", "empty token")
				return
			}

			user, err := verifier.VerifyIDToken(r.Context(), token)
			if err != nil {
				httpx.Error(w, http.StatusUnauthorized, "unauthorized", "invalid or expired token")
				return
			}

			ctx := WithUser(r.Context(), user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
