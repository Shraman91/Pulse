package store

import (
	"errors"
	"time"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrUnauthorized  = errors.New("unauthorized access")
	ErrQuotaExceeded = errors.New("monitor quota limit reached (max 10)")
	ErrInvalidInput  = errors.New("invalid monitor input")
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
