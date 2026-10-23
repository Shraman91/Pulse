"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Clock,
  Radio,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { api, PublicStatusPageResponse, PublicMonitorStatus, PublicIncident } from "@/lib/api";

function StatusPageContent() {
  const params = useParams();
  const slug = (params?.slug as string) || "";

  const [data, setData] = useState<PublicStatusPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchStatus = async () => {
    if (!slug) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPublicStatusPage(slug);
      setData(res);
      setLastRefreshed(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Status page not found";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [slug]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
        <Activity className="h-8 w-8 text-emerald-400 animate-spin mb-4" />
        <p className="text-zinc-400 font-mono text-sm">Loading real-time system status...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 text-center">
        <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 max-w-md w-full">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold mb-2">Status Page Not Found</h1>
          <p className="text-zinc-400 text-sm mb-6">
            The status page for <span className="font-mono text-zinc-200">/{slug}</span> does not exist or has been set to private.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
          >
            Return to Pulse Home
          </Link>
        </div>
      </div>
    );
  }

  const isOperational = data.systemState === "operational";
  const isDegraded = data.systemState === "degraded";
  const isOutage = data.systemState === "outage";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Navigation Bar */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Activity className="h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight text-sm text-zinc-200">{data.title}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
              Updated: {lastRefreshed.toLocaleTimeString()}
            </span>
            <button
              onClick={fetchStatus}
              disabled={loading}
              title="Refresh status"
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-10">
        {/* Page Hero Description */}
        {data.description && (
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">{data.description}</p>
        )}

        {/* Global Health Beacon Banner */}
        <div
          className={`p-6 rounded-2xl border transition-all ${
            isOperational
              ? "bg-emerald-950/30 border-emerald-900/60 shadow-[0_0_30px_rgba(16,185,129,0.08)]"
              : isDegraded
              ? "bg-amber-950/30 border-amber-900/60 shadow-[0_0_30px_rgba(245,158,11,0.08)]"
              : "bg-rose-950/30 border-rose-900/60 shadow-[0_0_30px_rgba(244,63,94,0.12)]"
          }`}
        >
          <div className="flex items-center gap-3.5">
            {isOperational && (
              <span className="relative flex h-4 w-4 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
              </span>
            )}
            {isDegraded && (
              <span className="relative flex h-4 w-4 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
              </span>
            )}
            {isOutage && (
              <span className="relative flex h-4 w-4 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500" />
              </span>
            )}

            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-100">
                {isOperational
                  ? "All Systems Operational"
                  : isDegraded
                  ? "Partial Service Degradation"
                  : "Major System Outage Detected"}
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isOperational
                  ? "All services and background workers are operating normally with standard latency."
                  : isDegraded
                  ? "One or more monitored services are currently experiencing issues or downtime."
                  : "Critical service disruptions detected. Team is investigating."}
              </p>
            </div>
          </div>
        </div>

        {/* Monitored Services Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Services & Infrastructure</h3>
            <span className="text-xs font-mono text-zinc-500">Last 30 days</span>
          </div>

          <div className="space-y-3">
            {data.monitors.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-zinc-900/20 border border-zinc-800/80 text-zinc-500 text-xs">
                No active monitors configured for this status page.
              </div>
            ) : (
              data.monitors.map((mon) => {
                const isMonUp = mon.state === "up";
                const isMonDown = mon.state === "down";

                // Prepare 30-day timeline bars (default 30 bars if empty)
                const barsCount = 30;
                const rawBars = mon.uptimeBars || [];
                // Group or pad to 30 timeline points
                const timeline = Array.from({ length: barsCount }, (_, idx) => {
                  const pt = rawBars[rawBars.length - barsCount + idx];
                  if (!pt) {
                    return {
                      status: "ok",
                      label: `Day ${idx + 1}`,
                      uptimePct: 100,
                      checks: 0,
                    };
                  }
                  let status = "ok";
                  if (pt.failures > 0 && pt.failures === pt.checks) {
                    status = "down";
                  } else if (pt.failures > 0) {
                    status = "degraded";
                  }
                  const uptime = pt.checks > 0 ? ((pt.checks - pt.failures) / pt.checks) * 100 : 100;
                  return {
                    status,
                    label: pt.hour || "Recorded window",
                    uptimePct: uptime,
                    checks: pt.checks,
                  };
                });

                return (
                  <div
                    key={mon.id}
                    className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-3"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            isMonUp ? "bg-emerald-500" : isMonDown ? "bg-rose-500" : "bg-amber-400"
                          }`}
                        />
                        <span className="font-semibold text-sm text-zinc-100">{mon.name}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/40">
                          {mon.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-zinc-200">
                          {mon.uptime30d.toFixed(2)}%
                        </span>
                        <span
                          className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                            isMonUp
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : isMonDown
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {isMonUp ? "Operational" : isMonDown ? "Down" : "Unknown"}
                        </span>
                      </div>
                    </div>

                    {/* 30-Day Segmented Uptime Bars */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-end gap-1 h-7 w-full py-0.5">
                        {timeline.map((bar, bIdx) => {
                          let barColor = "bg-emerald-500";
                          if (bar.status === "down") {
                            barColor = "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.4)]";
                          } else if (bar.status === "degraded") {
                            barColor = "bg-amber-400";
                          }

                          return (
                            <div
                              key={bIdx}
                              className="group relative flex-1 min-w-[4px] h-full flex items-end cursor-pointer"
                            >
                              <div
                                className={`w-full rounded-sm transition-all group-hover:scale-y-110 ${barColor}`}
                                style={{ height: "100%" }}
                              />
                              {/* Hover Tooltip */}
                              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col z-30 min-w-[160px] p-2 rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl text-[10px] font-mono text-zinc-200">
                                <span className="font-semibold text-zinc-100">{bar.label}</span>
                                <span className="text-zinc-400">
                                  Uptime:{" "}
                                  <span className="text-emerald-400">{bar.uptimePct.toFixed(1)}%</span>
                                </span>
                                {bar.checks > 0 && (
                                  <span className="text-zinc-500">Checks: {bar.checks}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-zinc-500">
                        <span>30 days ago</span>
                        <span>{mon.uptime30d.toFixed(1)}% uptime</span>
                        <span>Today</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Incidents History Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Past Incidents</h3>

          <div className="space-y-3">
            {data.incidents.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-zinc-900/20 border border-zinc-800/80 border-dashed text-zinc-500 text-xs flex flex-col items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-emerald-500/60 mb-2" />
                <span>No incidents reported in the last 30 days. All systems operating flawlessly.</span>
              </div>
            ) : (
              data.incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          inc.resolvedAt
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {inc.resolvedAt ? "Resolved" : "Active Outage"}
                      </span>
                      <span className="font-semibold text-zinc-200">{inc.monitorName}</span>
                    </div>
                    <p className="text-zinc-400 font-mono text-[11px]">{inc.cause}</p>
                  </div>

                  <div className="text-right font-mono text-[11px] text-zinc-500 shrink-0">
                    <div>Started: {new Date(inc.startedAt).toLocaleString()}</div>
                    {inc.resolvedAt && (
                      <div className="text-emerald-400/80">
                        Resolved: {new Date(inc.resolvedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-8 mt-12 bg-zinc-950 text-center text-xs text-zinc-500 font-mono">
        <div className="flex items-center justify-center gap-2">
          <span>Powered by</span>
          <Link href="/" className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
            Pulse
          </Link>
          <span>• Developer Uptime & Cron Monitoring</span>
        </div>
      </footer>
    </div>
  );
}

export default function PublicStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
          <Activity className="h-8 w-8 text-emerald-400 animate-spin mb-4" />
          <p className="text-zinc-400 font-mono text-sm">Loading real-time system status...</p>
        </div>
      }
    >
      <StatusPageContent />
    </Suspense>
  );
}
