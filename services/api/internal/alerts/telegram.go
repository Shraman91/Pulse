package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"net/http"
	"strings"

	"pulse/internal/incidents"
)

type TelegramMessage struct {
	ChatID    string `json:"chat_id"`
	Text      string `json:"text"`
	ParseMode string `json:"parse_mode,omitempty"`
}

// ParseTelegramTarget parses the target string into (botToken, chatID).
// Supported formats:
// 1. "<botToken>:<chatID>" (e.g., "123456:ABC-DEF:98765432")
// 2. "<chatID>" (relies on defaultToken fallback)
func ParseTelegramTarget(target, defaultToken string) (string, string, error) {
	target = strings.TrimSpace(target)
	if target == "" {
		return "", "", errors.New("empty telegram target")
	}

	// Check if target contains custom token:chat_id
	// Bot token usually contains a colon (e.g. 123456789:AAHdqT...) followed by another colon or separator for chat ID
	// Let's support "token/chatId" or "token:chatId" where token is the prefix before the last colon/slash
	if idx := strings.LastIndex(target, ":"); idx > 0 {
		tokenPart := target[:idx]
		chatIDPart := target[idx+1:]
		if tokenPart != "" && chatIDPart != "" {
			return tokenPart, chatIDPart, nil
		}
	} else if idx := strings.LastIndex(target, "/"); idx > 0 {
		tokenPart := target[:idx]
		chatIDPart := target[idx+1:]
		if tokenPart != "" && chatIDPart != "" {
			return tokenPart, chatIDPart, nil
		}
	}

	if defaultToken != "" {
		return defaultToken, target, nil
	}

	return "", "", errors.New("missing telegram bot token: specify '<botToken>:<chatID>' or configure TELEGRAM_BOT_TOKEN")
}

// BuildTelegramText formats an alert Payload into HTML for Telegram Bot API.
func BuildTelegramText(p *Payload) string {
	target := p.TargetURL
	if target == "" {
		target = "Cron Heartbeat"
	}

	escapedName := html.EscapeString(p.MonitorName)
	escapedTarget := html.EscapeString(target)
	timeStr := html.EscapeString(p.Timestamp.UTC().Format("2006-01-02 15:04:05 UTC"))

	switch p.Type {
	case incidents.EventDown:
		escapedCause := html.EscapeString(p.Cause)
		return fmt.Sprintf("<b>🚨 [DOWN] %s</b>\n\n"+
			"<b>Target:</b> <code>%s</code>\n"+
			"<b>Cause:</b> <code>%s</code>\n"+
			"<b>Time:</b> %s\n\n"+
			"<i>Pulse Monitoring Alert</i>",
			escapedName, escapedTarget, escapedCause, timeStr)

	case incidents.EventRecovery:
		durationStr := html.EscapeString(formatDuration(p.Duration))
		return fmt.Sprintf("<b>✅ [RECOVERED] %s</b>\n\n"+
			"<b>Target:</b> <code>%s</code>\n"+
			"<b>Downtime Duration:</b> <code>%s</code>\n"+
			"<b>Recovered At:</b> %s\n\n"+
			"<i>Pulse Monitoring Alert</i>",
			escapedName, escapedTarget, durationStr, timeStr)

	default: // TEST
		return fmt.Sprintf("<b>🔔 [TEST] Pulse Alert: %s</b>\n\n"+
			"<b>Target:</b> <code>%s</code>\n"+
			"<b>Status:</b> Telegram Webhook Verified\n"+
			"<b>Sent At:</b> %s\n\n"+
			"<i>Pulse Monitoring Alert</i>",
			escapedName, escapedTarget, timeStr)
	}
}

// SendTelegram dispatches the notification to Telegram Bot API with retry logic.
func SendTelegram(ctx context.Context, client *http.Client, defaultToken string, target string, payload *Payload, retryCfg RetryConfig) error {
	botToken, chatID, err := ParseTelegramTarget(target, defaultToken)
	if err != nil {
		return err
	}

	msg := TelegramMessage{
		ChatID:    chatID,
		Text:      BuildTelegramText(payload),
		ParseMode: "HTML",
	}

	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal telegram payload: %w", err)
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)

	return ExecuteWithRetry(ctx, retryCfg, func(attemptCtx context.Context) (*http.Response, error) {
		req, err := http.NewRequestWithContext(attemptCtx, http.MethodPost, apiURL, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		return client.Do(req)
	})
}
