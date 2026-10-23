"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  Plus,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Radio,
  Clock,
  Shield,
  LogIn,
  LogOut,
  AlertCircle,
  Server,
  Zap,
  Flame,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, Monitor, Incident, CreateMonitorPayload } from "@/lib/api";

export default function MonitorsPage() {
  const { user, token, loading: authLoading, signInWithGoogle, signInWithGithub, signInDev, signOut } = useAuth();

  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeTab, setActiveTab] = useState<"monitors" | "incidents">("monitors");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [monitorType, setMonitorType] = useState<"http" | "heartbeat">("http");
  const [formName, setFormName] = useState("");
  const [formURL, setFormURL] = useState("https://");
  const [formMethod, setFormMethod] = useState("GET");
  const [formInterval, setFormInterval] = useState(300);
  const [formTimeout, setFormTimeout] = useState(10000);
  const [formExpectedStatus, setFormExpectedStatus] = useState(200);
  const [formExpectedEvery, setFormExpectedEvery] = useState(3600);
  const [formGrace, setFormGrace] = useState(300);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Copied Ping Token State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchMonitors = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const [monData, incData] = await Promise.all([
        api.getMonitors(token),
        api.getIncidents(token).catch(() => []),
      ]);
      setMonitors(monData);
      setIncidents(incData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load monitors";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchMonitors();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [token, authLoading]);

  const handleCreateMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    setFormError(null);

    const payload: CreateMonitorPayload = {
      name: formName.trim(),
      type: monitorType,
    };

    if (monitorType === "http") {
      payload.url = formURL.trim();
      payload.method = formMethod;
      payload.intervalSec = Number(formInterval);
      payload.timeoutMs = Number(formTimeout);
      payload.expectedStatus = Number(formExpectedStatus);
    } else {
      payload.expectedEverySec = Number(formExpectedEvery);
      payload.graceSec = Number(formGrace);
    }

    try {
      const created = await api.createMonitor(token, payload);
      setMonitors((prev) => [created, ...prev]);
      setIsModalOpen(false);
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create monitor";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePause = async (m: Monitor) => {
    if (!token) return;
    try {
      const updated = await api.updateMonitor(token, m.id, { paused: !m.paused });
      setMonitors((prev) => prev.map((item) => (item.id === m.id ? updated : item)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to toggle pause");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to delete monitor "${name}"?`)) return;

    try {
      await api.deleteMonitor(token, id);
      setMonitors((prev) => prev.filter((item) => item.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete monitor");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resetForm = () => {
    setFormName("");
    setFormURL("https://");
    setFormMethod("GET");
    setFormInterval(300);
    setFormTimeout(10000);
    setFormExpectedStatus(200);
    setFormExpectedEvery(3600);
    setFormGrace(300);
    setFormError(null);
  };

  // Quota calculation
  const monitorCount = monitors.length;
  const isQuotaReached = monitorCount >= 10;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Navigation */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="h-5 w-5 animate-pulse" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Pulse
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-zinc-300 font-medium">{user.email || user.displayName}</span>
                  {user.isDev && (
                    <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded font-mono">
                      DEV
                    </span>
                  )}
                </div>
                <button
                  onClick={signOut}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-rose-400 transition-colors py-1.5 px-3 rounded-lg border border-zinc-800 hover:border-rose-900/50 bg-zinc-900/40"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => signInDev()}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors border border-zinc-700"
                >
                  Quick Dev Login
                </button>
                <button
                  onClick={signInWithGoogle}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors flex items-center gap-1.5"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {!user && !authLoading ? (
          /* Unauthenticated State View */
          <div className="max-w-md mx-auto my-16 p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-4">
              <Shield className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold mb-2">Sign in to Pulse</h2>
            <p className="text-sm text-zinc-400 mb-6">
              Create and manage your HTTP monitors and cron heartbeat check-ins.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => signInDev()}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                <Zap className="h-4 w-4" />
                Sign In with 1-Click Dev Mode
              </button>
              <button
                onClick={signInWithGoogle}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-medium transition-colors flex items-center justify-center gap-2"
              >
                Sign In with Google
              </button>
              <button
                onClick={signInWithGithub}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-medium transition-colors flex items-center justify-center gap-2"
              >
                Sign In with GitHub
              </button>
            </div>
          </div>
        ) : (
          /* Authenticated Dashboard View */
          <div>
            {/* Dashboard Controls & Quota */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Monitors</h1>
                <p className="text-sm text-zinc-400 mt-1">
                  Manage active endpoints, cron jobs, and notification channels.
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* Quota Indicator */}
                <div className="flex items-center gap-2.5 bg-zinc-900/60 border border-zinc-800 px-3.5 py-2 rounded-xl text-xs">
                  <span className="text-zinc-400 font-medium">Quota:</span>
                  <div className="w-20 bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isQuotaReached ? "bg-rose-500" : "bg-emerald-400"
                      }`}
                      style={{ width: `${(monitorCount / 10) * 100}%` }}
                    />
                  </div>
                  <span className={`font-mono font-semibold ${isQuotaReached ? "text-rose-400" : "text-zinc-200"}`}>
                    {monitorCount} / 10
                  </span>
                </div>

                {/* Create Monitor Button */}
                <button
                  onClick={() => setIsModalOpen(true)}
                  disabled={isQuotaReached}
                  className={`flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all ${
                    isQuotaReached
                      ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
                      : "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]"
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  Add Monitor
                </button>
              </div>
            </div>

            {/* Active Incidents Banner */}
            {incidents.filter((inc) => !inc.resolvedAt).length > 0 && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-950/40 border border-rose-900/60 shadow-[0_0_20px_rgba(244,63,94,0.1)]">
                <div className="flex items-center gap-2 text-sm font-semibold text-rose-400 mb-2">
                  <Flame className="h-4 w-4 animate-pulse text-rose-500" />
                  Active Outage Detected ({incidents.filter((inc) => !inc.resolvedAt).length})
                </div>
                <div className="space-y-1.5">
                  {incidents
                    .filter((inc) => !inc.resolvedAt)
                    .map((inc) => (
                      <div
                        key={inc.id}
                        className="text-xs bg-rose-950/60 border border-rose-900/40 rounded-xl px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-rose-200"
                      >
                        <span className="font-semibold text-rose-300">{inc.monitorName}: <span className="font-normal text-rose-400/90">{inc.cause}</span></span>
                        <span className="font-mono text-[11px] text-rose-400/70">
                          Started: {new Date(inc.startedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* View Switcher Tabs */}
            <div className="flex items-center gap-2 mb-6 border-b border-zinc-800 pb-3">
              <button
                onClick={() => setActiveTab("monitors")}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === "monitors"
                    ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Monitors ({monitors.length})
              </button>
              <button
                onClick={() => setActiveTab("incidents")}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === "incidents"
                    ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Incidents History ({incidents.length})
              </button>
            </div>

            {error && (
              <div className="p-4 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {activeTab === "incidents" ? (
              <div className="space-y-3">
                {incidents.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-zinc-900/20 border border-zinc-800/80 border-dashed text-zinc-500 text-sm">
                    No incidents recorded. All systems running cleanly!
                  </div>
                ) : (
                  incidents.map((inc) => (
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
                          <span className="font-semibold text-sm text-zinc-200">{inc.monitorName}</span>
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
            ) : null}

            {/* Monitors Grid / Empty State */}
            {activeTab === "monitors" && (
              <>
                {loading ? (
              <div className="py-24 text-center text-zinc-500 text-sm">
                <Activity className="h-6 w-6 animate-spin mx-auto mb-3 text-emerald-400" />
                Loading your monitors...
              </div>
            ) : monitors.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-zinc-900/20 border border-zinc-800/80 border-dashed">
                <Server className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-zinc-300 mb-1">No monitors configured</h3>
                <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-6">
                  Set up your first HTTP check or heartbeat dead man&apos;s switch to track service uptime.
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Your First Monitor
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {monitors.map((m) => {
                  const pingUrl = `http://localhost:8080/ping/${m.pingToken}`;
                  const curlSnippet = `curl -s "${pingUrl}"`;

                  return (
                    <div
                      key={m.id}
                      className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            {/* Health Dot */}
                            {m.paused ? (
                              <span className="h-3 w-3 rounded-full bg-zinc-600" title="Paused" />
                            ) : m.state === "up" ? (
                              <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                              </span>
                            ) : m.state === "down" ? (
                              <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                              </span>
                            ) : (
                              <span className="h-3 w-3 rounded-full bg-amber-400" title="Pending initial check" />
                            )}

                            <span className="font-semibold text-base tracking-tight text-zinc-100">{m.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                              {m.type}
                            </span>
                            <span
                              className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                                m.paused
                                  ? "bg-zinc-800 text-zinc-400"
                                  : m.state === "up"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : m.state === "down"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {m.paused ? "Paused" : m.state}
                            </span>
                          </div>
                        </div>

                        {/* Monitor Target / Ping URL */}
                        {m.type === "http" ? (
                          <div className="mb-4">
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-mono text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5 truncate"
                            >
                              <span className="font-semibold text-zinc-500">{m.method}</span>
                              <span className="truncate">{m.url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 text-zinc-600" />
                            </a>
                          </div>
                        ) : (
                          <div className="mb-4 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                                <Radio className="h-3 w-3 text-emerald-400" />
                                Ping URL
                              </span>
                              <button
                                onClick={() => copyToClipboard(curlSnippet, m.id)}
                                className="text-[10px] flex items-center gap-1 text-zinc-400 hover:text-emerald-300 font-mono py-0.5 px-1.5 rounded bg-zinc-900 border border-zinc-800"
                              >
                                {copiedId === m.id ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-400" /> Copied curl!
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" /> Copy curl
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="text-[11px] font-mono text-zinc-500 truncate">{pingUrl}</div>
                          </div>
                        )}

                        {/* Metadata row */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 font-mono mb-4">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-zinc-600" />
                            {m.type === "http" ? `Every ${m.intervalSec}s` : `Expected every ${m.expectedEverySec}s`}
                          </div>
                          {m.type === "http" && <div>Timeout: {m.timeoutMs}ms</div>}
                          {m.type === "heartbeat" && <div>Grace: {m.graceSec}s</div>}
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="border-t border-zinc-800/60 pt-3 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-zinc-600">ID: {m.id}</span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTogglePause(m)}
                            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors"
                            title={m.paused ? "Resume Monitor" : "Pause Monitor"}
                          >
                            {m.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDelete(m.id, m.name)}
                            className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-rose-950/40 hover:border-rose-900/50 text-zinc-400 hover:text-rose-400 transition-colors"
                            title="Delete Monitor"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Create Monitor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6">
            <h2 className="text-xl font-bold tracking-tight mb-4">Create New Monitor</h2>

            {/* Type Switcher Tabs */}
            <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800 mb-6">
              <button
                type="button"
                onClick={() => setMonitorType("http")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  monitorType === "http"
                    ? "bg-zinc-800 text-zinc-100 shadow"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                HTTP Endpoint
              </button>
              <button
                type="button"
                onClick={() => setMonitorType("heartbeat")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  monitorType === "heartbeat"
                    ? "bg-zinc-800 text-zinc-100 shadow"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Heartbeat (Dead Man&apos;s Switch)
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateMonitor} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Monitor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production API Health"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {monitorType === "http" ? (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Method</label>
                      <select
                        value={formMethod}
                        onChange={(e) => setFormMethod(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                      >
                        <option>GET</option>
                        <option>POST</option>
                        <option>HEAD</option>
                        <option>PUT</option>
                        <option>PATCH</option>
                        <option>DELETE</option>
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">URL</label>
                      <input
                        type="url"
                        required
                        placeholder="https://api.domain.com/healthz"
                        value={formURL}
                        onChange={(e) => setFormURL(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Interval</label>
                      <select
                        value={formInterval}
                        onChange={(e) => setFormInterval(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                      >
                        <option value={60}>1 min</option>
                        <option value={120}>2 min</option>
                        <option value={300}>5 min</option>
                        <option value={600}>10 min</option>
                        <option value={1800}>30 min</option>
                        <option value={3600}>1 hour</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Timeout</label>
                      <select
                        value={formTimeout}
                        onChange={(e) => setFormTimeout(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                      >
                        <option value={2000}>2s</option>
                        <option value={5000}>5s</option>
                        <option value={10000}>10s</option>
                        <option value={20000}>20s</option>
                        <option value={30000}>30s</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">Expected Status</label>
                      <input
                        type="number"
                        value={formExpectedStatus}
                        onChange={(e) => setFormExpectedStatus(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Expected Check-in</label>
                    <select
                      value={formExpectedEvery}
                      onChange={(e) => setFormExpectedEvery(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value={300}>Every 5 min</option>
                      <option value={1800}>Every 30 min</option>
                      <option value={3600}>Every 1 hour</option>
                      <option value={21600}>Every 6 hours</option>
                      <option value={86400}>Every 24 hours</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">Grace Period</label>
                    <select
                      value={formGrace}
                      onChange={(e) => setFormGrace(Number(e.target.value))}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value={60}>1 min</option>
                      <option value={300}>5 min</option>
                      <option value={600}>10 min</option>
                      <option value={1800}>30 min</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition-colors text-xs shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create Monitor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
