"use client";

import React, { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import {
  X,
  Activity,
  Clock,
  Zap,
  RefreshCw,
  BarChart3,
  ShieldAlert,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Monitor, MonitorStats, api } from "@/lib/api";

function subscribeNoop() {
  return () => {};
}

interface MonitorStatsModalProps {
  monitor: Monitor;
  token: string;
  onClose: () => void;
}

export function MonitorStatsModal({ monitor, token, onClose }: MonitorStatsModalProps) {
  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

  const fetchStats = useCallback(async () => {
    if (!token || !monitor.id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMonitorStats(token, monitor.id, range);
      setStats(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load telemetry data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, monitor.id, range]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Format hour label for charts & bars
  const formatHourLabel = (hourStr?: string, fallbackLabel?: string) => {
    if (fallbackLabel) return fallbackLabel;
    if (!hourStr) return "00:00";
    // Format is "2006-01-02-15"
    const parts = hourStr.split("-");
    if (parts.length >= 4) {
      const month = parts[1];
      const day = parts[2];
      const hour = parts[3];
      if (range === "24h") {
        return `${hour}:00`;
      }
      return `${month}/${day} ${hour}:00`;
    }
    return hourStr.length >= 16 ? hourStr.slice(11, 16) : hourStr;
  };

  const chartData = stats?.points?.map((p) => ({
    rawHour: p.hour || p.hourLabel || "",
    displayHour: formatHourLabel(p.hour, p.hourLabel),
    dns: p.dnsMs ?? p.avgDnsMs ?? 0,
    connect: p.connectMs ?? p.avgConnectMs ?? 0,
    tls: p.tlsMs ?? p.avgTlsMs ?? 0,
    ttfb: p.ttfbMs ?? p.avgTtfbMs ?? 0,
    totalLatency: p.avgLatencyMs,
    peakLatency: p.peakLatencyMs ?? p.maxLatencyMs ?? p.avgLatencyMs,
    checks: p.checks,
    failures: p.failures,
    uptimePct: p.checks > 0 ? ((p.checks - p.failures) / p.checks) * 100 : 100,
  })) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-zinc-100">{monitor.name}</h2>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                  {monitor.type}
                </span>
                <span
                  className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                    monitor.paused
                      ? "bg-zinc-800 text-zinc-400"
                      : monitor.state === "up"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {monitor.paused ? "Paused" : monitor.state}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate max-w-md">
                {monitor.type === "http" ? monitor.url : `Ping Token: ${monitor.pingToken}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Range Toggle Buttons */}
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs">
              {(["24h", "7d", "30d"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1 font-semibold rounded-lg transition-all ${
                    range === r
                      ? "bg-zinc-800 text-emerald-400 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <button
              onClick={fetchStats}
              disabled={loading}
              title="Refresh telemetry"
              className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-center gap-3">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                Uptime ({range})
              </span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold font-mono ${
                    (stats?.uptimePct ?? 100) >= 99.5
                      ? "text-emerald-400"
                      : (stats?.uptimePct ?? 100) >= 95
                      ? "text-amber-400"
                      : "text-rose-400"
                  }`}
                >
                  {stats ? `${stats.uptimePct.toFixed(2)}%` : "--%"}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                {stats ? `${stats.totalChecks - stats.totalFailures}/${stats.totalChecks} checks OK` : "Calculating..."}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                Average Latency
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold font-mono text-zinc-100">
                  {stats ? `${Math.round(stats.avgLatencyMs)}` : "--"}
                </span>
                <span className="text-xs text-zinc-500 font-mono">ms</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">Full roundtrip avg</span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                Peak Latency
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold font-mono text-amber-400">
                  {stats ? `${Math.round(stats.peakLatencyMs)}` : "--"}
                </span>
                <span className="text-xs text-zinc-500 font-mono">ms</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">Maximum measured spike</span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                Total Checkpoints
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-zinc-100">
                  {stats ? stats.totalChecks : "--"}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                {stats ? `${stats.totalFailures} incident checks` : "Aggregated rollups"}
              </span>
            </div>
          </div>

          {/* Hourly Uptime History Bar (GitHub Status / Datadog style) */}
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-zinc-200 tracking-wide">
                  Hourly Uptime History ({chartData.length} hours recorded)
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 font-medium">
                {stats ? `${stats.uptimePct.toFixed(1)}% uptime` : ""}
              </span>
            </div>

            {chartData.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No hourly rollups recorded yet for this window. Checks in progress...
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-end gap-1 h-9 w-full overflow-x-auto py-1">
                  {chartData.map((pt, idx) => {
                    let barColor = "bg-emerald-500";
                    let statusLabel = "100% Operational";
                    if (pt.checks === 0) {
                      barColor = "bg-zinc-800";
                      statusLabel = "No checks";
                    } else if (pt.failures > 0 && pt.failures === pt.checks) {
                      barColor = "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]";
                      statusLabel = "Major Outage (100% Failed)";
                    } else if (pt.failures > 0) {
                      barColor = "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]";
                      statusLabel = `Degraded (${pt.uptimePct.toFixed(1)}% Uptime)`;
                    }

                    return (
                      <div
                        key={idx}
                        className="group relative flex-1 min-w-[6px] h-full flex items-end cursor-pointer"
                      >
                        <div
                          className={`w-full rounded-sm transition-all group-hover:scale-y-110 ${barColor}`}
                          style={{ height: "100%" }}
                        />
                        {/* Hover Tooltip */}
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col z-30 min-w-[180px] p-2.5 rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl text-[11px] font-mono text-zinc-200">
                          <div className="font-semibold text-zinc-100 border-b border-zinc-800 pb-1 mb-1">
                            {pt.displayHour}
                          </div>
                          <div className="flex justify-between text-zinc-400">
                            <span>Status:</span>
                            <span className="text-zinc-200">{statusLabel}</span>
                          </div>
                          <div className="flex justify-between text-zinc-400">
                            <span>Checks:</span>
                            <span className="text-zinc-200">{pt.checks} (Failures: {pt.failures})</span>
                          </div>
                          <div className="flex justify-between text-zinc-400">
                            <span>Avg Latency:</span>
                            <span className="text-emerald-400">{Math.round(pt.totalLatency)} ms</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] font-mono text-zinc-500 pt-1">
                  <span>{range === "24h" ? "24 hours ago" : range === "7d" ? "7 days ago" : "30 days ago"}</span>
                  <span>Now</span>
                </div>
              </div>
            )}
          </div>

          {/* Stacked Latency Breakdown Chart (DNS, Connect, TLS, TTFB) */}
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-sky-400" />
                <span className="text-xs font-semibold text-zinc-200 tracking-wide">
                  Latency Breakdown (DNS · Connect · TLS · TTFB)
                </span>
              </div>
              <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> DNS
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /> Connect
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> TLS
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> TTFB
                </span>
              </div>
            </div>

            {loading && !stats ? (
              <div className="h-64 flex items-center justify-center text-xs text-zinc-500">
                <Activity className="h-5 w-5 animate-spin mr-2 text-emerald-400" />
                Fetching telemetry data...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-xs text-zinc-500 p-6">
                <Activity className="h-8 w-8 text-zinc-700 mb-2" />
                <p className="font-semibold text-zinc-400 mb-1">No latency metrics recorded yet</p>
                <p className="max-w-xs text-zinc-600">
                  Telemetry rollups aggregate after checks run. Checks are executed every {monitor.intervalSec || 60} seconds.
                </p>
              </div>
            ) : mounted ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDns" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="colorConnect" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818CF8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#818CF8" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="colorTls" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C084FC" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#C084FC" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="colorTtfb" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34D399" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#34D399" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="displayHour"
                      stroke="#52525B"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: "#27272A" }}
                    />
                    <YAxis
                      stroke="#52525B"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: "#27272A" }}
                      unit="ms"
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0]?.payload;
                        return (
                          <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl text-xs font-mono space-y-1.5 min-w-[200px]">
                            <div className="font-semibold text-zinc-100 border-b border-zinc-800 pb-1">
                              {label}
                            </div>
                            <div className="flex justify-between text-sky-400">
                              <span>DNS Lookup:</span>
                              <span className="font-bold">{data.dns} ms</span>
                            </div>
                            <div className="flex justify-between text-indigo-400">
                              <span>TCP Connect:</span>
                              <span className="font-bold">{data.connect} ms</span>
                            </div>
                            <div className="flex justify-between text-purple-400">
                              <span>TLS Handshake:</span>
                              <span className="font-bold">{data.tls} ms</span>
                            </div>
                            <div className="flex justify-between text-emerald-400">
                              <span>TTFB (Server):</span>
                              <span className="font-bold">{data.ttfb} ms</span>
                            </div>
                            <div className="border-t border-zinc-800 pt-1.5 mt-1 flex justify-between font-bold text-zinc-100">
                              <span>Avg Total:</span>
                              <span>{Math.round(data.totalLatency)} ms</span>
                            </div>
                            <div className="flex justify-between text-amber-400 text-[10px]">
                              <span>Peak Latency:</span>
                              <span>{Math.round(data.peakLatency)} ms</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="dns"
                      stackId="1"
                      stroke="#38BDF8"
                      fill="url(#colorDns)"
                      name="DNS"
                    />
                    <Area
                      type="monotone"
                      dataKey="connect"
                      stackId="1"
                      stroke="#818CF8"
                      fill="url(#colorConnect)"
                      name="Connect"
                    />
                    <Area
                      type="monotone"
                      dataKey="tls"
                      stackId="1"
                      stroke="#C084FC"
                      fill="url(#colorTls)"
                      name="TLS"
                    />
                    <Area
                      type="monotone"
                      dataKey="ttfb"
                      stackId="1"
                      stroke="#34D399"
                      fill="url(#colorTtfb)"
                      name="TTFB"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-500 font-mono">
          <span>Cost-controlled hourly rollups. Zero row-per-check bloating.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
