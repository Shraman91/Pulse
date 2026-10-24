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
  Clock,
  Zap,
  Activity,
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
      setIncidents(
        (Array.isArray(allIncidents) ? allIncidents : []).filter(
          (inc) => inc.monitorId === id
        )
      );
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

  const [copiedTarget, setCopiedTarget] = useState(false);
  const handleCopyTarget = async () => {
    if (!monitor?.url) return;
    try {
      await navigator.clipboard.writeText(monitor.url);
      setCopiedTarget(true);
      setTimeout(() => setCopiedTarget(false), 2000);
    } catch {
      // ignore
    }
  };

  // Latency chart formatting
  const chartData = (stats?.points || []).map((pt) => {
    let hour = pt.hourLabel || "";
    if (!hour && pt.hour && typeof pt.hour === "string") {
      hour = pt.hour.length >= 16 ? pt.hour.slice(11, 16) : pt.hour;
    }
    if (!hour && pt.timestamp) {
      const t = String(pt.timestamp);
      hour = t.length >= 16 ? t.slice(11, 16) : t;
    }
    return {
      hour: hour || "00:00",
      dns: pt.dnsMs ?? pt.avgDnsMs ?? 0,
      connect: pt.connectMs ?? pt.avgConnectMs ?? 0,
      tls: pt.tlsMs ?? pt.avgTlsMs ?? 0,
      ttfb: pt.ttfbMs ?? pt.avgTtfbMs ?? 0,
      total: pt.avgLatencyMs ?? 0,
      failures: pt.failures ?? 0,
    };
  });

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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 min-w-0">
        {/* Title Header */}
        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status indicator */}
            {monitor.paused ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--silver-400)]/20 text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                <span className="w-2 h-2 rounded-full bg-[var(--status-paused)]" />
                <span>Paused</span>
              </span>
            ) : monitor.state === "up" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 glow-emerald">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--status-up)]" />
                </span>
                <span>Operational</span>
              </span>
            ) : monitor.state === "down" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30 glow-crimson">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--status-down)]" />
                </span>
                <span>Failing</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-hint)]" />
                <span>Pending check</span>
              </span>
            )}

            {/* Type badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
              {monitor.type === "http" ? (
                <>
                  <Globe className="w-3.5 h-3.5 text-[var(--status-up)]" />
                  <span>HTTP check</span>
                </>
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5 text-[var(--accent-hint)]" />
                  <span>Heartbeat (Cron)</span>
                </>
              )}
            </span>

            <span className="text-xs font-mono text-[var(--text-secondary)] ml-auto sm:ml-0">
              Checked every {monitor.type === "http" ? `${monitor.intervalSec}s` : `${monitor.expectedEverySec}s`}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)] break-words">
            {monitor.name}
          </h1>

          {/* Target URL or Ping Token */}
          {monitor.type === "http" ? (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 text-xs font-mono text-[var(--text-secondary)] min-w-0 max-w-full">
              <span className="px-2 py-0.5 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] font-bold text-[var(--text-primary)] shrink-0">
                {monitor.method || "GET"}
              </span>
              <div className="flex items-center gap-2 min-w-0 max-w-full overflow-hidden p-1.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-subtle)]">
                <a
                  href={monitor.url}
                  target="_blank"
                  rel="noreferrer"
                  title={monitor.url}
                  className="hover:text-[var(--text-primary)] truncate max-w-xs sm:max-w-md lg:max-w-xl transition-colors"
                >
                  {monitor.url}
                </a>
                <button
                  type="button"
                  onClick={handleCopyTarget}
                  title="Copy URL"
                  className="p-1 rounded hover:bg-[var(--bg-page)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shrink-0 transition-colors"
                >
                  {copiedTarget ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <a
                  href={monitor.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Open URL in new tab"
                  className="p-1 rounded hover:bg-[var(--bg-page)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shrink-0 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-2 max-w-full overflow-hidden">
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

        {/* 4 Metric Summary Cards with Protected Tiling */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 min-w-0">
          {/* Card 1: Uptime */}
          <div className="p-5 rounded-2xl glass-panel space-y-2 min-w-0 relative overflow-hidden group">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
              <span>30-day uptime</span>
              <Activity className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono text-[var(--text-primary)] truncate">
              {stats?.uptimePct !== undefined
                ? `${stats.uptimePct.toFixed(2)}%`
                : "100.0%"}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">
              {stats?.totalFailures !== undefined && stats.totalFailures > 0
                ? `${stats.totalFailures} incident checks`
                : "Zero downtime observed"}
            </div>
          </div>

          {/* Card 2: Avg Latency */}
          <div className="p-5 rounded-2xl glass-panel space-y-2 min-w-0 relative overflow-hidden group">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
              <span>Avg latency</span>
              <Zap className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] font-mono truncate">
                {stats?.avgLatencyMs !== undefined && stats.avgLatencyMs > 0
                  ? Math.round(stats.avgLatencyMs)
                  : "—"}
              </span>
              <span className="text-xs font-mono text-[var(--text-secondary)] shrink-0">ms</span>
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">
              Full roundtrip average
            </div>
          </div>

          {/* Card 3: Peak Latency */}
          <div className="p-5 rounded-2xl glass-panel space-y-2 min-w-0 relative overflow-hidden group">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
              <span>Peak latency</span>
              <Clock className="w-4 h-4 text-[var(--accent-hint)] group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--accent-hint)] font-mono truncate">
                {stats?.peakLatencyMs !== undefined && stats.peakLatencyMs > 0
                  ? Math.round(stats.peakLatencyMs)
                  : "—"}
              </span>
              <span className="text-xs font-mono text-[var(--text-secondary)] shrink-0">ms</span>
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">
              Maximum measured spike
            </div>
          </div>

          {/* Card 4: Total Checks */}
          <div className="p-5 rounded-2xl glass-panel space-y-2 min-w-0 relative overflow-hidden group">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
              <span>Total checks</span>
              <CheckCircle2 className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] font-mono truncate">
              {stats?.totalChecks !== undefined
                ? stats.totalChecks.toLocaleString()
                : "0"}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">
              Scheduled executions
            </div>
          </div>
        </div>

        {/* 30-Day UptimeDots Grid */}
        <section aria-labelledby="uptime-grid-title" className="space-y-3 min-w-0">
          <div className="border-b border-[var(--border-subtle)] pb-2 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 id="uptime-grid-title" className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                Uptime history (30 days)
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Continuous availability dot field with halftone radius scaling
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--status-up)]" />
                <span>Operational</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[var(--status-down)]" />
                <span>Incident</span>
              </span>
            </div>
          </div>

          <div className="p-6 rounded-2xl glass-panel overflow-hidden">
            <UptimeDots points={stats?.points || []} days={30} />
          </div>
        </section>

        {/* Latency Breakdown Chart */}
        {monitor.type === "http" && (
          <section aria-labelledby="latency-chart-title" className="space-y-4 min-w-0">
            <div className="border-b border-[var(--border-subtle)] pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 id="latency-chart-title" className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                  Microsecond latency breakdown
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  DNS lookup, TCP connect, TLS negotiation, and TTFB
                </p>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-auto">
                {/* Color Legend */}
                <div className="hidden md:flex items-center gap-2.5 text-[11px] font-mono text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#06B6D4]" /> DNS
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#6366F1]" /> Connect
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#A855F7]" /> TLS
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" /> TTFB
                  </span>
                </div>

                {/* Range Toggle */}
                <div className="flex rounded-lg p-0.5 bg-[var(--bg-page)] border border-[var(--border-subtle)]">
                  {(["24h", "7d", "30d"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRange(r)}
                      className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-colors ${
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
            </div>

            <div className="p-6 rounded-2xl glass-panel overflow-hidden">
              {statsLoading ? (
                <div className="h-64 flex items-center justify-center text-xs text-[var(--text-secondary)]">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2 text-[var(--aubergine-400)]" />
                  <span>Loading telemetry rollups...</span>
                </div>
              ) : chartData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="detailDns" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="detailConnect" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="detailTls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#A855F7" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#A855F7" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="detailTtfb" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
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
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          const d = payload[0]?.payload;
                          return (
                            <div className="p-3.5 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-strong)] shadow-2xl text-xs font-mono space-y-1.5 min-w-[190px]">
                              <div className="font-bold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-1">
                                {label}
                              </div>
                              <div className="flex justify-between text-[#06B6D4]">
                                <span>DNS Lookup:</span>
                                <span className="font-bold">{d.dns} ms</span>
                              </div>
                              <div className="flex justify-between text-[#6366F1]">
                                <span>TCP Connect:</span>
                                <span className="font-bold">{d.connect} ms</span>
                              </div>
                              <div className="flex justify-between text-[#A855F7]">
                                <span>TLS Handshake:</span>
                                <span className="font-bold">{d.tls} ms</span>
                              </div>
                              <div className="flex justify-between text-[#10B981]">
                                <span>TTFB (Server):</span>
                                <span className="font-bold">{d.ttfb} ms</span>
                              </div>
                              <div className="pt-1 border-t border-[var(--border-subtle)] flex justify-between font-bold text-[var(--text-primary)]">
                                <span>Total Latency:</span>
                                <span>{Math.round(d.total)} ms</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="dns"
                        name="DNS"
                        stackId="1"
                        stroke="#06B6D4"
                        fill="url(#detailDns)"
                      />
                      <Area
                        type="monotone"
                        dataKey="connect"
                        name="Connect"
                        stackId="1"
                        stroke="#6366F1"
                        fill="url(#detailConnect)"
                      />
                      <Area
                        type="monotone"
                        dataKey="tls"
                        name="TLS"
                        stackId="1"
                        stroke="#A855F7"
                        fill="url(#detailTls)"
                      />
                      <Area
                        type="monotone"
                        dataKey="ttfb"
                        name="TTFB"
                        stackId="1"
                        stroke="#10B981"
                        fill="url(#detailTtfb)"
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
        <section aria-labelledby="incidents-history-title" className="space-y-4 min-w-0">
          <div className="border-b border-[var(--border-subtle)] pb-2 flex items-baseline justify-between">
            <h2 id="incidents-history-title" className="text-base font-bold tracking-tight text-[var(--text-primary)]">
              Recent incidents
            </h2>
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              {(incidents || []).length} recorded
            </span>
          </div>

          {(incidents || []).length > 0 ? (
            <div className="space-y-3">
              {(incidents || []).map((inc) => (
                <div
                  key={inc.id}
                  className="p-4 rounded-xl glass-panel flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {inc.resolvedAt ? (
                      <CheckCircle2 className="w-4 h-4 text-[var(--status-up)] shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[var(--status-down)] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--text-primary)] truncate">
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
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase self-start sm:self-auto shrink-0 ${
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
            <div className="p-8 rounded-2xl glass-panel text-center text-xs text-[var(--text-secondary)] space-y-1">
              <CheckCircle2 className="w-6 h-6 text-[var(--status-up)] mx-auto mb-2" />
              <div className="font-semibold text-[var(--text-primary)] text-sm">
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
