package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"pulse/internal/incidents"
)

const (
	DiscordColorDown     = 0xED4245 // Red
	DiscordColorRecovery = 0x57F287 // Green
	DiscordColorTest     = 0x5865F2 // Blurple
)

type DiscordWebhook struct {
	Username  string         `json:"username,omitempty"`
	AvatarURL string         `json:"avatar_url,omitempty"`
	Embeds    []DiscordEmbed `json:"embeds"`
}

type DiscordEmbed struct {
	Title       string              `json:"title"`
	Description string              `json:"description,omitempty"`
	Color       int                 `json:"color"`
	Fields      []DiscordEmbedField `json:"fields,omitempty"`
	Footer      *DiscordFooter      `json:"footer,omitempty"`
	Timestamp   string              `json:"timestamp,omitempty"`
}

type DiscordEmbedField struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Inline bool   `json:"inline,omitempty"`
}

type DiscordFooter struct {
	Text string `json:"text"`
}

// BuildDiscordPayload formats a normalized Payload into a Discord Rich Embed.
func BuildDiscordPayload(p *Payload) *DiscordWebhook {
	embed := DiscordEmbed{
		Footer:    &DiscordFooter{Text: "Pulse Monitoring Service"},
		Timestamp: p.Timestamp.Format(time.RFC3339),
	}

	target := p.TargetURL
	if target == "" {
		target = "Cron Heartbeat"
	}

	switch p.Type {
	case incidents.EventDown:
		embed.Title = fmt.Sprintf("🚨 [DOWN] %s", p.MonitorName)
		embed.Color = DiscordColorDown
		embed.Description = "Service check failed and an outage has been confirmed."
		embed.Fields = []DiscordEmbedField{
			{Name: "Target", Value: target, Inline: true},
			{Name: "Cause", Value: p.Cause, Inline: true},
			{Name: "Time", Value: p.Timestamp.UTC().Format("15:04:05 UTC"), Inline: true},
		}

	case incidents.EventRecovery:
		embed.Title = fmt.Sprintf("✅ [RECOVERED] %s", p.MonitorName)
		embed.Color = DiscordColorRecovery
		embed.Description = "Service has recovered and is now responding normally."
		durationStr := formatDuration(p.Duration)
		embed.Fields = []DiscordEmbedField{
			{Name: "Target", Value: target, Inline: true},
			{Name: "Downtime Duration", Value: durationStr, Inline: true},
			{Name: "Time", Value: p.Timestamp.UTC().Format("15:04:05 UTC"), Inline: true},
		}

	default: // TEST
		embed.Title = fmt.Sprintf("🔔 [TEST] Pulse Notification: %s", p.MonitorName)
		embed.Color = DiscordColorTest
		embed.Description = "This is a test notification verifying your Discord webhook integration."
		embed.Fields = []DiscordEmbedField{
			{Name: "Status", Value: "Integration Active", Inline: true},
			{Name: "Target", Value: target, Inline: true},
			{Name: "Sent At", Value: p.Timestamp.UTC().Format("15:04:05 UTC"), Inline: true},
		}
	}

	return &DiscordWebhook{
		Username: "Pulse Alerts",
		Embeds:   []DiscordEmbed{embed},
	}
}

// SendDiscord dispatches the notification to a Discord webhook with retry logic.
func SendDiscord(ctx context.Context, client *http.Client, webhookURL string, payload *Payload, retryCfg RetryConfig) error {
	msg := BuildDiscordPayload(payload)
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal discord payload: %w", err)
	}

	return ExecuteWithRetry(ctx, retryCfg, func(attemptCtx context.Context) (*http.Response, error) {
		req, err := http.NewRequestWithContext(attemptCtx, http.MethodPost, webhookURL, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		return client.Do(req)
	})
}

func formatDuration(d time.Duration) string {
	if d <= 0 {
		return "instant"
	}
	d = d.Round(time.Second)
	m := d / time.Minute
	s := (d % time.Minute) / time.Second
	if m > 0 {
		return fmt.Sprintf("%dm %ds", m, s)
	}
	return fmt.Sprintf("%ds", s)
}
