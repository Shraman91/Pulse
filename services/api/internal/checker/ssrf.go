package checker

import (
	"errors"
	"net"
	"syscall"
)

var (
	ErrBlockedAddress = errors.New("blocked target: address resolves to private, loopback, or link-local range")
	ErrInvalidAddress = errors.New("invalid target address")
)

var blockedCIDRs []*net.IPNet

func init() {
	rawCIDRs := []string{
		// IPv4 Loopback & "This" Network
		"127.0.0.0/8",
		"0.0.0.0/8",

		// IPv4 Private (RFC 1918)
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",

		// IPv4 Link-Local & Cloud Metadata (RFC 3927)
		"169.254.0.0/16",

		// IPv4 CGNAT (RFC 6598)
		"100.64.0.0/10",

		// IPv4 Broadcast & Multicast
		"255.255.255.255/32",
		"224.0.0.0/4",

		// IPv4 Documentation & Benchmark (RFC 5737 / RFC 2544)
		"192.0.2.0/24",
		"198.51.100.0/24",
		"203.0.113.0/24",
		"198.18.0.0/15",

		// IPv6 Loopback & Unspecified
		"::1/128",
		"::/128",

		// IPv6 Link-Local (RFC 4291)
		"fe80::/10",

		// IPv6 Unique Local / Private (RFC 4193)
		"fc00::/7",

		// IPv6 Multicast
		"ff00::/8",

		// IPv6 Documentation (RFC 3849)
		"2001:db8::/32",
	}

	for _, cidr := range rawCIDRs {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err == nil {
			blockedCIDRs = append(blockedCIDRs, ipNet)
		}
	}
}

// IsBlockedIP inspects an IP address and returns true if it matches any
// private, loopback, link-local, multicast, or reserved ranges.
func IsBlockedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}

	// If IPv4-mapped IPv6 address (e.g., ::ffff:127.0.0.1), unwrap to IPv4
	if ipv4 := ip.To4(); ipv4 != nil {
		ip = ipv4
	}

	// Fast path check using standard library helpers
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() {
		return true
	}

	// CIDR check for cloud metadata (169.254.169.254), CGNAT, and documentation ranges
	for _, cidr := range blockedCIDRs {
		if cidr.Contains(ip) {
			return true
		}
	}

	return false
}

// NewSSRFDialControl creates a socket Control function for net.Dialer that inspects
// resolved IP addresses prior to opening the TCP connection.
func NewSSRFDialControl(allowPrivate bool) func(network, address string, c syscall.RawConn) error {
	return func(network, address string, c syscall.RawConn) error {
		if allowPrivate {
			return nil
		}

		host, _, err := net.SplitHostPort(address)
		if err != nil {
			return ErrInvalidAddress
		}

		ip := net.ParseIP(host)
		if ip == nil {
			return ErrInvalidAddress
		}

		if IsBlockedIP(ip) {
			return ErrBlockedAddress
		}

		return nil
	}
}
