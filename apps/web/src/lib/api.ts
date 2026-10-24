const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface AlertChannel {
  type: "discord" | "slack" | "telegram";
  target: string;
}

export interface Monitor {
  id: string;
  ownerUid: string;
  name: string;
  type: "http" | "heartbeat";
  url?: string;
  method?: string;
  intervalSec: number;
  timeoutMs: number;
  expectedStatus: number;
  pingToken?: string;
  expectedEverySec?: number;
  graceSec?: number;
  lastPingAt?: string | null;
  state: "unknown" | "up" | "down";
  consecutiveFailures: number;
  nextCheckAt: string;
  paused: boolean;
  alertChannels: AlertChannel[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateMonitorPayload {
  name: string;
  type: "http" | "heartbeat";
  url?: string;
  method?: string;
  intervalSec?: number;
  timeoutMs?: number;
  expectedStatus?: number;
  expectedEverySec?: number;
  graceSec?: number;
  alertChannels?: AlertChannel[];
}

export interface UpdateMonitorPayload {
  name?: string;
  url?: string;
  method?: string;
  intervalSec?: number;
  timeoutMs?: number;
  expectedStatus?: number;
  expectedEverySec?: number;
  graceSec?: number;
  paused?: boolean;
  alertChannels?: AlertChannel[];
}

async function fetchWithAuth(url: string, token: string, options: RequestInit = {}) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMessage = `HTTP error ${res.status}`;
    try {
      const data = await res.json();
      errMessage = data.details || data.error || errMessage;
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }

  if (res.status === 204) {
    return null;
  }
  return res.json();
}

export interface Incident {
  id: string;
  monitorId: string;
  monitorName: string;
  ownerUid: string;
  startedAt: string;
  resolvedAt?: string | null;
  cause: string;
  alertDispatched: boolean;
}

export interface RollupPoint {
  hour?: string;
  hourLabel?: string;
  timestamp?: string;
  checks: number;
  failures: number;
  uptimePct?: number;
  avgLatencyMs: number;
  peakLatencyMs?: number;
  maxLatencyMs?: number;
  dnsMs?: number;
  avgDnsMs?: number;
  connectMs?: number;
  avgConnectMs?: number;
  tlsMs?: number;
  avgTlsMs?: number;
  ttfbMs?: number;
  avgTtfbMs?: number;
}

export interface MonitorStats {
  monitorId: string;
  range: string;
  uptimePct: number;
  avgLatencyMs: number;
  peakLatencyMs: number;
  totalChecks: number;
  totalFailures: number;
  points: RollupPoint[];
}

export interface StatusPage {
  id: string;
  ownerUid: string;
  slug: string;
  title: string;
  description: string;
  isPublic: boolean;
  monitorIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicMonitorStatus {
  id: string;
  name: string;
  type: "http" | "heartbeat";
  state: "up" | "down" | "unknown";
  uptime30d: number;
  uptimeBars: RollupPoint[];
}

export interface PublicIncident {
  id: string;
  monitorName: string;
  startedAt: string;
  resolvedAt?: string | null;
  cause: string;
}

export interface PublicStatusPageResponse {
  title: string;
  description: string;
  slug: string;
  systemState: "operational" | "degraded" | "outage";
  monitors: PublicMonitorStatus[];
  incidents: PublicIncident[];
  updatedAt: string;
}

export interface CreateStatusPagePayload {
  slug: string;
  title: string;
  description?: string;
  isPublic: boolean;
  monitorIds: string[];
}

export interface UpdateStatusPagePayload {
  slug?: string;
  title?: string;
  description?: string;
  isPublic?: boolean;
  monitorIds?: string[];
}

export const api = {
  getMonitors: async (token: string): Promise<Monitor[]> => {
    const data = await fetchWithAuth("/api/monitors", token);
    return Array.isArray(data) ? data : [];
  },

  getMonitor: async (token: string, id: string): Promise<Monitor> => {
    return fetchWithAuth(`/api/monitors/${id}`, token);
  },

  createMonitor: async (token: string, payload: CreateMonitorPayload): Promise<Monitor> => {
    return fetchWithAuth("/api/monitors", token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateMonitor: async (token: string, id: string, payload: UpdateMonitorPayload): Promise<Monitor> => {
    return fetchWithAuth(`/api/monitors/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  deleteMonitor: async (token: string, id: string): Promise<void> => {
    return fetchWithAuth(`/api/monitors/${id}`, token, {
      method: "DELETE",
    });
  },

  getIncidents: async (token: string): Promise<Incident[]> => {
    const data = await fetchWithAuth("/api/incidents", token);
    return Array.isArray(data) ? data : [];
  },

  getMonitorStats: async (token: string, id: string, range = "24h"): Promise<MonitorStats> => {
    return fetchWithAuth(`/api/monitors/${id}/stats?range=${encodeURIComponent(range)}`, token);
  },

  testAlertChannel: async (
    token: string,
    channel: AlertChannel,
    monitorName?: string
  ): Promise<{ ok: boolean; message?: string; error?: string }> => {
    return fetchWithAuth("/api/alerts/test", token, {
      method: "POST",
      body: JSON.stringify({ channel, monitorName }),
    });
  },

  // Public status page
  getPublicStatusPage: async (slug: string): Promise<PublicStatusPageResponse> => {
    const res = await fetch(`${API_BASE_URL}/api/status-pages/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      let errMessage = `HTTP error ${res.status}`;
      try {
        const data = await res.json();
        errMessage = data.details || data.error || errMessage;
      } catch {}
      throw new Error(errMessage);
    }
    const pageData = await res.json();
    return {
      ...pageData,
      monitors: Array.isArray(pageData?.monitors) ? pageData.monitors : [],
      incidents: Array.isArray(pageData?.incidents) ? pageData.incidents : [],
    };
  },

  // Authenticated status page management
  getStatusPages: async (token: string): Promise<StatusPage[]> => {
    const data = await fetchWithAuth("/api/status-pages", token);
    return Array.isArray(data) ? data : [];
  },

  createStatusPage: async (token: string, payload: CreateStatusPagePayload): Promise<StatusPage> => {
    return fetchWithAuth("/api/status-pages", token, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateStatusPage: async (token: string, id: string, payload: UpdateStatusPagePayload): Promise<StatusPage> => {
    return fetchWithAuth(`/api/status-pages/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  deleteStatusPage: async (token: string, id: string): Promise<void> => {
    return fetchWithAuth(`/api/status-pages/${id}`, token, {
      method: "DELETE",
    });
  },
};

