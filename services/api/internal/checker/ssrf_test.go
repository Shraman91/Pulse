package checker

import (
	"net"
	"testing"
)

func TestIsBlockedIP(t *testing.T) {
	tests := []struct {
		name    string
		ipStr   string
		blocked bool
	}{
		// IPv4 Loopback
		{"IPv4 Loopback 127.0.0.1", "127.0.0.1", true},
		{"IPv4 Loopback 127.255.255.254", "127.255.255.254", true},

		// IPv4 Private (RFC 1918)
		{"Private 10.0.0.1", "10.0.0.1", true},
		{"Private 10.255.255.255", "10.255.255.255", true},
		{"Private 172.16.0.1", "172.16.0.1", true},
		{"Private 172.31.255.255", "172.31.255.255", true},
		{"Private 192.168.0.1", "192.168.0.1", true},
		{"Private 192.168.254.254", "192.168.254.254", true},

		// Link-Local & Cloud Metadata (RFC 3927)
		{"Link-Local 169.254.0.1", "169.254.0.1", true},
		{"AWS/GCP Metadata 169.254.169.254", "169.254.169.254", true},

		// CGNAT (RFC 6598)
		{"CGNAT 100.64.0.1", "100.64.0.1", true},
		{"CGNAT 100.127.255.255", "100.127.255.255", true},

		// Broadcast & Multicast
		{"This host 0.0.0.0", "0.0.0.0", true},
		{"Broadcast 255.255.255.255", "255.255.255.255", true},
		{"Multicast 224.0.0.1", "224.0.0.1", true},

		// Documentation & Benchmark
		{"Documentation 192.0.2.1", "192.0.2.1", true},
		{"Documentation 198.51.100.1", "198.51.100.1", true},
		{"Documentation 203.0.113.1", "203.0.113.1", true},
		{"Benchmark 198.18.0.1", "198.18.0.1", true},

		// IPv6 Loopback & Unspecified
		{"IPv6 Loopback ::1", "::1", true},
		{"IPv6 Unspecified ::", "::", true},

		// IPv6 Link-Local & Unique Local
		{"IPv6 Link-Local fe80::1", "fe80::1", true},
		{"IPv6 Unique Local fc00::1", "fc00::1", true},
		{"IPv6 Unique Local fd00::1", "fd00::1", true},

		// IPv4-mapped IPv6
		{"IPv4-mapped Loopback ::ffff:127.0.0.1", "::ffff:127.0.0.1", true},
		{"IPv4-mapped Private ::ffff:192.168.1.1", "::ffff:192.168.1.1", true},

		// Public IP addresses (ALLOWED)
		{"Google Public DNS 8.8.8.8", "8.8.8.8", false},
		{"Google Public DNS 8.8.4.4", "8.8.4.4", false},
		{"Cloudflare DNS 1.1.1.1", "1.1.1.1", false},
		{"Quad9 DNS 9.9.9.9", "9.9.9.9", false},
		{"Public IPv6 2606:4700:4700::1111", "2606:4700:4700::1111", false},
		{"Public IPv6 2001:4860:4860::8888", "2001:4860:4860::8888", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ip := net.ParseIP(tt.ipStr)
			if ip == nil {
				t.Fatalf("failed to parse IP: %s", tt.ipStr)
			}
			got := IsBlockedIP(ip)
			if got != tt.blocked {
				t.Errorf("IsBlockedIP(%s) = %v, expected %v", tt.ipStr, got, tt.blocked)
			}
		})
	}
}
