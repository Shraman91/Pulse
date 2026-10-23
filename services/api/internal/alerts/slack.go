package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"pulse/internal/incidents"
)

type SlackWebhook struct {
	Text   string       `json:"text"`
	Blocks []SlackBlock `json:"blocks,omitempty"`
}

type SlackBlock struct {
	Type     string         `json:"type"`
	Text     *SlackText     `json:"text,omitempty"`
	Fields   []SlackText    `json:"fields,omitempty"`
	Elements []SlackElement `json:"elements,omitempty"`
}

type SlackText struct {
	Type  string `json:"type"` // "plain_text" or "mrkdwn"
	Text  string `json:"text"`
	Emoji bool   `json:"emoji,omitempty"`
}

type SlackElement struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// BuildSlackPayload formats a normalized Payload into a Slack Block Kit payload.
func BuildSlackPayload(p *Payload) *SlackWebhook {
	target := p.TargetURL
	if target == "" {
		target = "Cron Heartbeat"
	}

	var headerText string
	var fallbackText string
	var sectionFields []SlackText

	switch p.Type {
	case incidents.EventDown:
		headerText = fmt.Sprintf("🚨 [DOWN] %s", p.MonitorName)
		fallbackText = fmt.Sprintf("Outage Detected: %s is DOWN. Cause: %s", p.MonitorName, p.Cause)
		sectionFields = []SlackText{
			{Type: "mrkdwn", Text: fmt.Sprintf("*Target:*\n%s", target)},
			{Type: "mrkdwn", Text: fmt.Sprintf("*Cause:*\n%s", p.Cause)},
			{Type: "mrkdwn", Text: fmt.Sprintf("*Timestamp:*\n%s", p.Timestamp.UTC().Format("2006-01-02 15:04:05 UTC"))},
			{Type: "mrkdwn", Text: "*Status:*\nOutage Confirmed"},
		}

	case incidents.EventRecovery:
		headerText = fmt.Sprintf("✅ [RECOVERED] %s", p.MonitorName)
		durationStr := formatDuration(p.Duration)
		fallbackText = fmt.Sprintf("Service Recovered: %s is back UP after %s", p.MonitorName, durationStr)
		sectionFields = []SlackText{
			{Type: "mrkdwn", Text: fmt.Sprintf("*Target:*\n%s", target)},
			{Type: "mrkdwn", Text: fmt.Sprintf("*Downtime Duration:*\n%s", durationStr)},
			{Type: "mrkdwn", Text: fmt.Sprintf("*Recovered At:*\n%s", p.Timestamp.UTC().Format("2006-01-02 15:04:05 UTC"))},
			{Type: "mrkdwn", Text: "*Status:*\nHealthy"},
		}

	default: // TEST
		headerText = fmt.Sprintf("🔔 [TEST] Pulse Alert: %s", p.MonitorName)
		fallbackText = fmt.Sprintf("Test alert received from Pulse for %s", p.MonitorName)
		sectionFields = []SlackText{
			{Type: "mrkdwn", Text: fmt.Sprintf("*Target:*\n%s", target)},
			{Type: "mrkdwn", Text: "*Integration:*\nSlack Webhook Verified"},
			{Type: "mrkdwn", Text: fmt.Sprintf("*Sent At:*\n%s", p.Timestamp.UTC().Format("2006-01-02 15:04:05 UTC"))},
		}
	}

	blocks := []SlackBlock{
		{
			Type: "header",
			Text: &SlackText{
				Type:  "plain_text",
				Text:  headerText,
				Emoji: true,
			},
		},
		{
			Type:   "section",
			Fields: sectionFields,
		},
		{
			Type: "context",
			Elements: []SlackElement{
				{
					Type: "mrkdwn",
					Text: "Pulse Monitoring Service • Reliable Uptime & Cron Heartbeats",
				},
			},
		},
	}

	return &SlackWebhook{
		Text:   fallbackText,
		Blocks: blocks,
	}
}

// SendSlack dispatches the notification to a Slack webhook with retry logic.
func SendSlack(ctx context.Context, client *http.Client, webhookURL string, payload *Payload, retryCfg RetryConfig) error {
	msg := BuildSlackPayload(payload)
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal slack payload: %w", err)
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
