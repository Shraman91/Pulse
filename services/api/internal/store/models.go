package store

import (
	"errors"
	"time"
)

var (
	ErrNotFound       = errors.New("not found")
	ErrUnauthorized   = errors.New("unauthorized access")
	ErrQuotaExceeded  = errors.New("monitor quota limit reached (max 10)")
	ErrInvalidInput   = errors.New("invalid monitor input")
	ErrLeaseContested = errors.New("monitor lease already acquired by another worker")
)

type MonitorType string

const (
	MonitorTypeHTTP      MonitorType = "http"
	MonitorTypeHeartbeat MonitorType = "heartbeat"
)

type MonitorState string

const (
	StateUnknown MonitorState = "unknown"
	StateUp      MonitorState = "up"
	StateDown    MonitorState = "down"
)

type AlertChannel struct {
	Type   string `json:"type" firestore:"type"`     // "discord", "slack", "telegram"
	Target string `json:"target" firestore:"target"` // webhook URL or chat ID
}

type Monitor struct {
	ID                  string         `json:"id" firestore:"id"`
	OwnerUID            string         `json:"ownerUid" firestore:"ownerUid"`
	Name                string         `json:"name" firestore:"name"`
	Type                MonitorType    `json:"type" firestore:"type"`
	URL                 string         `json:"url,omitempty" firestore:"url,omitempty"`
	Method              string         `json:"method,omitempty" firestore:"method,omitempty"`
	IntervalSec         int            `json:"intervalSec" firestore:"intervalSec"`
	TimeoutMs           int            `json:"timeoutMs" firestore:"timeoutMs"`
	ExpectedStatus      int            `json:"expectedStatus" firestore:"expectedStatus"`
	PingToken           string         `json:"pingToken,omitempty" firestore:"pingToken,omitempty"`
	ExpectedEverySec    int            `json:"expectedEverySec,omitempty" firestore:"expectedEverySec,omitempty"`
	GraceSec            int            `json:"graceSec,omitempty" firestore:"graceSec,omitempty"`
	LastPingAt          *time.Time     `json:"lastPingAt,omitempty" firestore:"lastPingAt,omitempty"`
	State               MonitorState   `json:"state" firestore:"state"`
	ConsecutiveFailures int            `json:"consecutiveFailures" firestore:"consecutiveFailures"`
	NextCheckAt         time.Time      `json:"nextCheckAt" firestore:"nextCheckAt"`
	Paused              bool           `json:"paused" firestore:"paused"`
	LeaseUntil          *time.Time     `json:"leaseUntil,omitempty" firestore:"leaseUntil,omitempty"`
	AlertChannels       []AlertChannel `json:"alertChannels" firestore:"alertChannels"`
	CreatedAt           time.Time      `json:"createdAt" firestore:"createdAt"`
	UpdatedAt           time.Time      `json:"updatedAt" firestore:"updatedAt"`
}

type UpdateMonitorRequest struct {
	Name             *string         `json:"name,omitempty"`
	URL              *string         `json:"url,omitempty"`
	Method           *string         `json:"method,omitempty"`
	IntervalSec      *int            `json:"intervalSec,omitempty"`
	TimeoutMs        *int            `json:"timeoutMs,omitempty"`
	ExpectedStatus   *int            `json:"expectedStatus,omitempty"`
	ExpectedEverySec *int            `json:"expectedEverySec,omitempty"`
	GraceSec         *int            `json:"graceSec,omitempty"`
	Paused           *bool           `json:"paused,omitempty"`
	AlertChannels    *[]AlertChannel `json:"alertChannels,omitempty"`
}

type Incident struct {
	ID              string     `json:"id" firestore:"id"`
	MonitorID       string     `json:"monitorId" firestore:"monitorId"`
	MonitorName     string     `json:"monitorName" firestore:"monitorName"`
	OwnerUID        string     `json:"ownerUid" firestore:"ownerUid"`
	StartedAt       time.Time  `json:"startedAt" firestore:"startedAt"`
	ResolvedAt      *time.Time `json:"resolvedAt,omitempty" firestore:"resolvedAt,omitempty"`
	Cause           string     `json:"cause" firestore:"cause"`
	AlertDispatched bool       `json:"alertDispatched" firestore:"alertDispatched"`
}

type CheckFailure struct {
	ID             string    `json:"id" firestore:"id"`
	MonitorID      string    `json:"monitorId" firestore:"monitorId"`
	TS             time.Time `json:"ts" firestore:"ts"`
	OK             bool      `json:"ok" firestore:"ok"`
	StatusCode     int       `json:"statusCode" firestore:"statusCode"`
	LatencyMs      int64     `json:"latencyMs" firestore:"latencyMs"`
	Error          string    `json:"error" firestore:"error"`
	DNSMs          int64     `json:"dnsMs" firestore:"dnsMs"`
	ConnectMs      int64     `json:"connectMs" firestore:"connectMs"`
	TLSHandshakeMs int64     `json:"tlsMs" firestore:"tlsMs"`
	TTFBMs         int64     `json:"ttfbMs" firestore:"ttfbMs"`
}
