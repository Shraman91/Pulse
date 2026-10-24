"use client";

import React, { useEffect, useState, Suspense, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { api, PublicStatusPageResponse } from "@/lib/api";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UptimeDots } from "@/components/fx/UptimeDots";

const emptySubscribe = () => () => {};

function StatusPageContent() {
  const params = useParams();
  const slug = (params?.slug as string) || "";

  const [data, setData] = useState<PublicStatusPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>("");

  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const fetchStatus = React.useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPublicStatusPage(slug);
      setData(res);
      setLastRefreshedTime(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Status page not found";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col items-center justify-center p-4">
        <Activity className="h-8 w-8 text-[var(--accent-hint)] animate-spin mb-4" />
        <p className="text-[var(--text-secondary)] font-mono text-sm">Loading real-time system status...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col items-center justify-center p-4 text-center">
        <div className="p-8 rounded-2xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] shadow-xl max-w-md w-full">
          <div className="w-12 h-12 rounded-xl bg-[var(--status-late)]/10 border border-[var(--status-late)]/30 text-[var(--status-late)] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold mb-2 text-[var(--text-primary)]">Status Page Not Found</h1>
          <p className="text-[var(--text-secondary)] text-sm mb-6">
            The status page for <span className="font-mono text-[var(--text-primary)]">/{slug}</span> does not exist or is currently private.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-[var(--aubergine-900)] dark:bg-[var(--silver-100)] text-[var(--silver-50)] dark:text-[var(--aubergine-950)] text-xs font-semibold hover:opacity-90 transition-opacity"
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
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] transition-colors duration-200 flex flex-col selection:bg-[var(--aubergine-500)] selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[var(--aubergine-900)] text-[var(--silver-100)] dark:bg-[var(--silver-100)] dark:text-[var(--aubergine-950)] flex items-center justify-center font-mono font-bold text-xs shadow-sm">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-sm text-[var(--text-primary)]">{data.title}</span>
              <span className="ml-2 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--border-subtle)]/50 text-[var(--text-secondary)]">
                Status
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {mounted && lastRefreshedTime && (
              <span className="text-[11px] font-mono text-[var(--text-secondary)] hidden sm:inline">
                Updated: {lastRefreshedTime}
              </span>
            )}
            <button
              onClick={fetchStatus}
              disabled={loading}
              title="Refresh status"
              className="p-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[var(--accent-hint)]" : ""}`} />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Page Hero Description */}
        {data.description && (
          <p className="text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">{data.description}</p>
        )}

        {/* Global Health Beacon Banner */}
        <div
          className={`p-6 rounded-2xl border transition-all ${
            isOperational
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100 glow-emerald"
              : isDegraded
              ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100"
              : "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-100 glow-crimson"
          }`}
        >
          <div className="flex items-center gap-4">
            {isOperational && (
              <div className="relative flex h-6 w-6 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-6 w-6 bg-emerald-500 items-center justify-center text-white">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
            )}
            {isDegraded && (
              <div className="relative flex h-6 w-6 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-6 w-6 bg-amber-500 items-center justify-center text-white">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </span>
              </div>
            )}
            {isOutage && (
              <div className="relative flex h-6 w-6 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-6 w-6 bg-rose-500 items-center justify-center text-white font-bold text-xs">
                  !
                </span>
              </div>
            )}

            <div>
              <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
                {isOperational
                  ? "All Systems Operational"
                  : isDegraded
                  ? "Partial Service Degradation"
                  : "Major System Outage Detected"}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                {isOperational
                  ? "All systems and background services are operating within normal baseline latency."
                  : isDegraded
                  ? "One or more monitored endpoints are experiencing degraded performance or latency spikes."
                  : "Critical service disruptions detected. Engineers have been notified."}
              </p>
            </div>
          </div>
        </div>

        {/* Monitored Services Section */}
        <section className="space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Services &amp; Infrastructure</h3>
            <span className="text-xs font-mono text-[var(--text-secondary)]">30-day window</span>
          </div>

          <div className="space-y-3 min-w-0">
            {(data.monitors || []).length === 0 ? (
              <div className="p-8 text-center rounded-2xl glass-panel text-[var(--text-secondary)] text-xs">
                No active monitors configured for this status page.
              </div>
            ) : (
              (data.monitors || []).map((mon) => {
                const isMonUp = mon.state === "up";
                const isMonDown = mon.state === "down";

                return (
                  <div
                    key={mon.id}
                    className="p-5 rounded-2xl glass-panel space-y-4 min-w-0 overflow-hidden"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                            isMonUp
                              ? "bg-[var(--status-up)]"
                              : isMonDown
                              ? "bg-[var(--status-down)]"
                              : "bg-[var(--accent-hint)]"
                          }`}
                        />
                        <span className="font-semibold text-sm text-[var(--text-primary)] truncate max-w-[220px] sm:max-w-md" title={mon.name}>
                          {mon.name}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[var(--border-subtle)]/50 text-[var(--text-secondary)] shrink-0">
                          {mon.type}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                          {mon.uptime30d.toFixed(2)}%
                        </span>
                        <span
                          className={`text-[10px] uppercase font-semibold px-2.5 py-0.5 rounded-full ${
                            isMonUp
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                              : isMonDown
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                              : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {isMonUp ? "Operational" : isMonDown ? "Down" : "Checking"}
                        </span>
                      </div>
                    </div>

                    {/* 30-Day Interactive Uptime Dots */}
                    <div className="pt-1 overflow-hidden">
                      <UptimeDots points={mon.uptimeBars || []} days={30} showSummary={false} />
                      <div className="flex justify-between text-[10px] font-mono text-[var(--text-secondary)] mt-1.5">
                        <span>30 days ago</span>
                        <span className="font-semibold">{mon.uptime30d.toFixed(1)}% uptime</span>
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
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Past Incidents</h3>

          <div className="space-y-3">
            {(data.incidents || []).length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[var(--bg-panel)] border border-dashed border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs flex flex-col items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-emerald-500/70 mb-2" />
                <span>No incidents reported in the last 30 days. All systems operating smoothly.</span>
              </div>
            ) : (
              (data.incidents || []).map((inc) => (
                <div
                  key={inc.id}
                  className="p-4 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          inc.resolvedAt
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {inc.resolvedAt ? "Resolved" : "Active Outage"}
                      </span>
                      <span className="font-semibold text-[var(--text-primary)]">{inc.monitorName}</span>
                    </div>
                    <p className="text-[var(--text-secondary)] font-mono text-[11px]">{inc.cause}</p>
                  </div>

                  <div className="text-right font-mono text-[11px] text-[var(--text-secondary)] shrink-0">
                    <div>Started: {inc.startedAt.slice(0, 16).replace("T", " ")}</div>
                    {inc.resolvedAt && (
                      <div className="text-emerald-600 dark:text-emerald-400">
                        Resolved: {inc.resolvedAt.slice(0, 16).replace("T", " ")}
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
      <footer className="border-t border-[var(--border-subtle)] py-8 mt-12 bg-[var(--bg-panel)] text-center text-xs text-[var(--text-secondary)] font-mono">
        <div className="flex items-center justify-center gap-2">
          <span>Powered by</span>
          <Link href="/" className="font-semibold text-[var(--text-primary)] hover:underline transition-colors">
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
        <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col items-center justify-center p-4">
          <Activity className="h-8 w-8 text-[var(--accent-hint)] animate-spin mb-4" />
          <p className="text-[var(--text-secondary)] font-mono text-sm">Loading real-time system status...</p>
        </div>
      }
    >
      <StatusPageContent />
    </Suspense>
  );
}

