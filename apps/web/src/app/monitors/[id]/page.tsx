"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Globe,
  Radio,
  Play,
  Pause,
  Trash2,
  Edit3,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import {
  api,
  Monitor,
  MonitorStats,
  Incident,
  UpdateMonitorPayload,
} from "@/lib/api";
import { UptimeDots } from "@/components/fx/UptimeDots";
import { Skeleton, CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { MonitorForm } from "@/components/monitors/MonitorForm";

function MonitorDetailContent() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const router = useRouter();
  const { token, loading: authLoading } = useAuth();

  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [range, setRange] = useState<"24h" | "7d" | "30d">("30d");
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPing, setCopiedPing] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Fetch monitor metadata & incidents
  const loadMonitorData = useCallback(async () => {
    if (!token || !id) return;
    try {
      setLoading(true);
      setError(null);
      const [monData, allIncidents] = await Promise.all([
        api.getMonitor(token, id),
        api.getIncidents(token).catch(() => []),
      ]);
      setMonitor(monData);
      setIncidents(allIncidents.filter((inc) => inc.monitorId === id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load monitor";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  // Fetch stats for current range
  const loadStats = useCallback(async () => {
    if (!token || !id) return;
    try {
      setStatsLoading(true);
      const statsData = await api.getMonitorStats(token, id, range);
      setStats(statsData);
    } catch {
      // stats may be empty for new monitor
    } finally {
      setStatsLoading(false);
    }
  }, [token, id, range]);

  useEffect(() => {
    if (token) {
      loadMonitorData();
    }
  }, [token, loadMonitorData]);

  useEffect(() => {
    if (token) {
      loadStats();
    }
  }, [token, loadStats]);

  // Handle Pause / Resume toggle
  const handleTogglePause = async () => {
    if (!token || !monitor) return;
    try {
      setUpdating(true);
      const updated = await api.updateMonitor(token, monitor.id, {
        paused: !monitor.paused,
      });
      setMonitor(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to toggle pause");
    } finally {
      setUpdating(false);
    }
  };

  // Handle Delete
  const handleDelete = async () => {
    if (!token || !monitor) return;
    if (!confirm(`Are you sure you want to delete "${monitor.name}"?`)) return;
    try {
      await api.deleteMonitor(token, monitor.id);
      router.push("/monitors");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete monitor");
    }
  };

  // Handle Edit Submit
  const handleEditSubmit = async (payload: UpdateMonitorPayload) => {
    if (!token || !monitor) return;
    try {
      setUpdating(true);
      const updated = await api.updateMonitor(token, monitor.id, payload);
      setMonitor(updated);
      setIsEditModalOpen(false);
    } catch (err: unknown) {
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  // Copy ping token URL
  const pingUrl = monitor?.pingToken
    ? `http://localhost:8080/ping/${monitor.pingToken}`
    : "";

  const handleCopyPingUrl = async () => {
    if (!pingUrl) return;
    try {
      await navigator.clipboard.writeText(pingUrl);
      setCopiedPing(true);
      setTimeout(() => setCopiedPing(false), 2000);
    } catch {
      // ignore
    }
  };

  // Latency chart formatting
  const chartData = (stats?.points || []).map((pt) => ({
    hour: pt.hour.slice(11, 16),
    dns: pt.dnsMs,
    connect: pt.connectMs,
    tls: pt.tlsMs,
    ttfb: pt.ttfbMs,
    total: pt.avgLatencyMs,
    failures: pt.failures,
  }));

  if (authLoading || (loading && !monitor)) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] p-6 sm:p-10 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (error || !monitor) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] p-6 sm:p-10 max-w-5xl mx-auto space-y-6">
        <Link
          href="/monitors"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to monitors</span>
        </Link>
        <div className="p-8 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-sm space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>Could not load monitor</span>
          </div>
          <p className="text-xs">{error || "Monitor not found or removed."}</p>
          <button
            type="button"
            onClick={loadMonitorData}
            className="px-3.5 py-1.5 rounded-lg bg-[var(--bg-panel)] text-xs font-semibold text-[var(--text-primary)] border border-[var(--border-subtle)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] selection:bg-[var(--aubergine-500)] selection:text-[var(--silver-50)] transition-colors duration-200">
      {/* Top Breadcrumb Nav */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/monitors"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-md outline-none"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to monitors</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleTogglePause}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
            >
              {monitor.paused ? (
                <>
                  <Play className="w-3.5 h-3.5 text-[var(--status-up)]" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 text-[var(--status-paused)]" />
                  <span>Pause</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Title Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status indicator */}
            {monitor.paused ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--silver-400)]/20 text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                <span className="w-2 h-2 rounded-full bg-[var(--status-paused)]" />
                <span>Paused</span>
              </span>
            ) : monitor.state === "up" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-[var(--status-up)]" />
                <span>Operational</span>
              </span>
            ) : monitor.state === "down" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-800 dark:text-red-300 border border-red-500/30">
                <span className="w-2 h-2 rounded-full bg-[var(--status-down)]" />
                <span>Failing</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-hint)]" />
                <span>Pending check</span>
              </span>
            )}

            {/* Type badge */}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
              {monitor.type === "http" ? (
                <>
                  <Globe className="w-3 h-3 text-[var(--status-up)]" />
                  <span>HTTP</span>
                </>
              ) : (
                <>
                  <Radio className="w-3 h-3 text-[var(--accent-hint)]" />
                  <span>Heartbeat (Cron)</span>
                </>
              )}
            </span>

            <span className="text-xs font-mono text-[var(--text-secondary)]">
              Checked every {monitor.type === "http" ? `${monitor.intervalSec}s` : `${monitor.expectedEverySec}s`}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            {monitor.name}
          </h1>

          {/* Target URL or Ping Token */}
          {monitor.type === "http" ? (
            <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)]">
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] font-bold text-[var(--text-primary)]">
                {monitor.method || "GET"}
              </span>
              <a
                href={monitor.url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-[var(--text-primary)] underline decoration-[var(--border-subtle)] flex items-center gap-1 truncate"
              >
                <span>{monitor.url}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
                <span>Heartbeat cURL ping URL</span>
                <button
                  type="button"
                  onClick={handleCopyPingUrl}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--aubergine-500)] text-[var(--silver-50)] text-xs hover:bg-[var(--aubergine-700)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
                >
                  {copiedPing ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-300" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-2.5 rounded-lg bg-[var(--bg-page)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)] overflow-x-auto select-all">
                <code>{`curl -fsS --retry 3 "${pingUrl}"`}</code>
              </pre>
            </div>
          )}
        </div>

        {/* 4 Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Card 1: Uptime */}
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-1">
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              30-day uptime
            </span>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {stats?.uptimePct !== undefined
                ? `${stats.uptimePct.toFixed(2)}%`
                : "100.0%"}
            </div>
          </div>

          {/* Card 2: Avg Latency */}
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-1">
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              Avg latency
            </span>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] font-mono">
              {stats?.avgLatencyMs !== undefined && stats.avgLatencyMs > 0
                ? `${stats.avgLatencyMs} ms`
                : "—"}
            </div>
          </div>

          {/* Card 3: Peak Latency */}
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-1">
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              Peak latency
            </span>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] font-mono">
              {stats?.peakLatencyMs !== undefined && stats.peakLatencyMs > 0
                ? `${stats.peakLatencyMs} ms`
                : "—"}
            </div>
          </div>

          {/* Card 4: Total Checks */}
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-1">
            <span className="text-xs text-[var(--text-secondary)] font-mono">
              Total checks
            </span>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] font-mono">
              {stats?.totalChecks !== undefined
                ? stats.totalChecks.toLocaleString()
                : "0"}
            </div>
          </div>
        </div>

        {/* 30-Day UptimeDots Grid */}
        <section aria-labelledby="uptime-grid-title" className="space-y-4">
          <div className="border-b border-[var(--border-subtle)] pb-2 flex items-baseline justify-between">
            <h2 id="uptime-grid-title" className="text-base font-bold tracking-tight text-[var(--text-primary)]">
              Uptime history (30 days)
            </h2>
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              Halftone dot scale
            </span>
          </div>

          <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]">
            <UptimeDots points={stats?.points || []} days={30} />
          </div>
        </section>

        {/* Latency Breakdown Chart */}
        {monitor.type === "http" && (
          <section aria-labelledby="latency-chart-title" className="space-y-4">
            <div className="border-b border-[var(--border-subtle)] pb-2 flex items-center justify-between">
              <div>
                <h2 id="latency-chart-title" className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                  Microsecond latency breakdown
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  DNS lookup, TCP connect, TLS negotiation, and TTFB
                </p>
              </div>

              {/* Range Toggle */}
              <div className="flex rounded-lg p-0.5 bg-[var(--bg-page)] border border-[var(--border-subtle)]">
                {(["24h", "7d", "30d"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors ${
                      range === r
                        ? "bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]">
              {statsLoading ? (
                <div className="h-64 flex items-center justify-center text-xs text-[var(--text-secondary)]">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  <span>Loading telemetry rollups...</span>
                </div>
              ) : chartData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <XAxis
                        dataKey="hour"
                        stroke="var(--silver-600)"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--silver-600)"
                        fontSize={11}
                        tickLine={false}
                        unit="ms"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--aubergine-900)",
                          borderColor: "var(--silver-600)",
                          borderRadius: "8px",
                          color: "var(--silver-50)",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="ttfb"
                        name="TTFB"
                        stackId="1"
                        stroke="#5C2465"
                        fill="#5C2465"
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="tls"
                        name="TLS"
                        stackId="1"
                        stroke="#8A9099"
                        fill="#8A9099"
                        fillOpacity={0.5}
                      />
                      <Area
                        type="monotone"
                        dataKey="connect"
                        name="Connect"
                        stackId="1"
                        stroke="#B4B9C0"
                        fill="#B4B9C0"
                        fillOpacity={0.4}
                      />
                      <Area
                        type="monotone"
                        dataKey="dns"
                        name="DNS"
                        stackId="1"
                        stroke="#F4A913"
                        fill="#F4A913"
                        fillOpacity={0.4}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-center text-xs text-[var(--text-secondary)]">
                  <span>No latency checks recorded for this time range.</span>
                  <span className="text-[11px] mt-1 text-[var(--text-muted)]">
                    Rollups aggregate after each scheduled interval check.
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Incidents Timeline */}
        <section aria-labelledby="incidents-history-title" className="space-y-4">
          <div className="border-b border-[var(--border-subtle)] pb-2 flex items-baseline justify-between">
            <h2 id="incidents-history-title" className="text-base font-bold tracking-tight text-[var(--text-primary)]">
              Recent incidents
            </h2>
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              {incidents.length} recorded
            </span>
          </div>

          {incidents.length > 0 ? (
            <div className="space-y-3">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    {inc.resolvedAt ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--status-up)] shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[var(--status-down)] shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold text-[var(--text-primary)]">
                        {inc.cause || "HTTP check failed"}
                      </div>
                      <div className="text-[11px] font-mono text-[var(--text-secondary)]">
                        Started: {new Date(inc.startedAt).toLocaleString()}
                        {inc.resolvedAt && (
                          <span> • Resolved: {new Date(inc.resolvedAt).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase self-start sm:self-auto ${
                      inc.resolvedAt
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20"
                    }`}
                  >
                    {inc.resolvedAt ? "Resolved" : "Active incident"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-center text-xs text-[var(--text-secondary)] space-y-1">
              <CheckCircle2 className="w-5 h-5 text-[var(--status-up)] mx-auto mb-2" />
              <div className="font-semibold text-[var(--text-primary)]">
                Zero incident history
              </div>
              <p>No downtime or check failures recorded for this monitor.</p>
            </div>
          )}
        </section>
      </main>

      {/* Edit Monitor Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Edit monitor
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Close
              </button>
            </div>
            <MonitorForm
              initialMonitor={monitor}
              token={token || ""}
              submitting={updating}
              onSubmit={handleEditSubmit}
              onCancel={() => setIsEditModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function MonitorDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] p-6 sm:p-10 max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-12 w-3/4" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      }
    >
      <MonitorDetailContent />
    </Suspense>
  );
}
