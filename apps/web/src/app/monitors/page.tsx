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
  Bell,
  Send,
  CheckCircle2,
  X,
  BarChart2,
  Globe,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  api,
  Monitor,
  Incident,
  CreateMonitorPayload,
  AlertChannel,
  StatusPage,
  CreateStatusPagePayload,
} from "@/lib/api";
import { MonitorStatsModal } from "@/components/dashboard/MonitorStatsModal";

export default function MonitorsPage() {
  const { user, token, loading: authLoading, signInWithGoogle, signInWithGithub, signInDev, signOut } = useAuth();

  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [statusPages, setStatusPages] = useState<StatusPage[]>([]);
  const [activeTab, setActiveTab] = useState<"monitors" | "incidents" | "statuspages">("monitors");
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

  // Status Page Modal State
  const [isStatusPageModalOpen, setIsStatusPageModalOpen] = useState(false);
  const [spTitle, setSpTitle] = useState("");
  const [spSlug, setSpSlug] = useState("");
  const [spDesc, setSpDesc] = useState("");
  const [spPublic, setSpPublic] = useState(true);
  const [spSelectedMonitors, setSpSelectedMonitors] = useState<string[]>([]);
  const [spSubmitting, setSpSubmitting] = useState(false);
  const [spError, setSpError] = useState<string | null>(null);

  // Copied Ping Token State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Alert Channels Modal State
  const [selectedMonitorForAlerts, setSelectedMonitorForAlerts] = useState<Monitor | null>(null);
  const [selectedMonitorForStats, setSelectedMonitorForStats] = useState<Monitor | null>(null);
  const [newChannelType, setNewChannelType] = useState<"discord" | "slack" | "telegram">("discord");
  const [newChannelTarget, setNewChannelTarget] = useState("");
  const [testingAlert, setTestingAlert] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [savingAlerts, setSavingAlerts] = useState(false);

  const fetchMonitors = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const [monData, incData, spData] = await Promise.all([
        api.getMonitors(token),
        api.getIncidents(token).catch(() => []),
        api.getStatusPages(token).catch(() => []),
      ]);
      setMonitors(monData);
      setIncidents(incData);
      setStatusPages(spData);
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

  const handleOpenAlertsModal = (m: Monitor) => {
    setSelectedMonitorForAlerts(m);
    setNewChannelType("discord");
    setNewChannelTarget("");
    setTestResult(null);
  };

  const handleTestAlertChannel = async () => {
    if (!token || !selectedMonitorForAlerts || !newChannelTarget.trim()) return;
    setTestingAlert(true);
    setTestResult(null);
    try {
      const res = await api.testAlertChannel(
        token,
        { type: newChannelType, target: newChannelTarget.trim() },
        selectedMonitorForAlerts.name
      );
      if (res.ok) {
        setTestResult({ ok: true, message: res.message || "Test notification delivered successfully!" });
      } else {
        setTestResult({ ok: false, message: res.error || "Failed to deliver test notification." });
      }
    } catch (err: unknown) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "Failed to deliver test notification.",
      });
    } finally {
      setTestingAlert(false);
    }
  };

  const handleAddAlertChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedMonitorForAlerts || !newChannelTarget.trim()) return;
    setSavingAlerts(true);
    const updatedChannels: AlertChannel[] = [
      ...(selectedMonitorForAlerts.alertChannels || []),
      { type: newChannelType, target: newChannelTarget.trim() },
    ];
    try {
      const updated = await api.updateMonitor(token, selectedMonitorForAlerts.id, {
        alertChannels: updatedChannels,
      });
      setSelectedMonitorForAlerts(updated);
      setMonitors((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setNewChannelTarget("");
      setTestResult(null);
    } catch (err: unknown) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "Failed to save alert channel.",
      });
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleDeleteAlertChannel = async (index: number) => {
    if (!token || !selectedMonitorForAlerts) return;
    setSavingAlerts(true);
    const updatedChannels = (selectedMonitorForAlerts.alertChannels || []).filter((_, i) => i !== index);
    try {
      const updated = await api.updateMonitor(token, selectedMonitorForAlerts.id, {
        alertChannels: updatedChannels,
      });
      setSelectedMonitorForAlerts(updated);
      setMonitors((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove alert channel.");
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleCreateStatusPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSpSubmitting(true);
    setSpError(null);

    const payload: CreateStatusPagePayload = {
      title: spTitle.trim(),
      slug: spSlug.trim().toLowerCase(),
      description: spDesc.trim(),
      isPublic: spPublic,
      monitorIds: spSelectedMonitors,
    };

    try {
      const newPage = await api.createStatusPage(token, payload);
      setStatusPages((prev) => [newPage, ...prev]);
      setIsStatusPageModalOpen(false);
      setSpTitle("");
      setSpSlug("");
      setSpDesc("");
      setSpSelectedMonitors([]);
    } catch (err: unknown) {
      setSpError(err instanceof Error ? err.message : "Failed to create status page");
    } finally {
      setSpSubmitting(false);
    }
  };

  const handleDeleteStatusPage = async (id: string, title: string) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to delete status page "${title}"?`)) return;

    try {
      await api.deleteStatusPage(token, id);
      setStatusPages((prev) => prev.filter((p) => p.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete status page");
    }
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
              <button
                onClick={() => setActiveTab("statuspages")}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === "statuspages"
                    ? "bg-zinc-800 text-zinc-100 border border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                Status Pages ({statusPages.length})
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

            {/* Status Pages List / View */}
            {activeTab === "statuspages" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
                  <div>
                    <h3 className="text-base font-bold text-zinc-200">Public Status Pages</h3>
                    <p className="text-xs text-zinc-400">
                      Share real-time service health, 30-day uptime bars, and incident logs with your customers.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsStatusPageModalOpen(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)] shrink-0 self-start sm:self-auto"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Status Page
                  </button>
                </div>

                {statusPages.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-zinc-900/20 border border-zinc-800/80 border-dashed">
                    <Globe className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-zinc-300 mb-1">No status pages yet</h3>
                    <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-6">
                      Create your first status page to publish your service uptime on a clean, shareable URL.
                    </p>
                    <button
                      onClick={() => setIsStatusPageModalOpen(true)}
                      className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Create Status Page
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {statusPages.map((sp) => {
                      const publicUrl = `/status/${sp.slug}`;
                      return (
                        <div
                          key={sp.id}
                          className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${
                                    sp.isPublic ? "bg-emerald-500" : "bg-zinc-600"
                                  }`}
                                />
                                <h4 className="font-bold text-base text-zinc-100">{sp.title}</h4>
                              </div>
                              <span
                                className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                                  sp.isPublic
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-zinc-800 text-zinc-400"
                                }`}
                              >
                                {sp.isPublic ? "Public" : "Private"}
                              </span>
                            </div>

                            {sp.description && (
                              <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{sp.description}</p>
                            )}

                            <div className="mb-4 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
                              <span className="text-[11px] font-mono text-zinc-500 block mb-1">
                                Public URL:
                              </span>
                              <Link
                                href={publicUrl}
                                target="_blank"
                                className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 truncate"
                              >
                                <span>{publicUrl}</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </Link>
                            </div>

                            <div className="text-xs font-mono text-zinc-500 mb-2">
                              Monitored Services: {sp.monitorIds?.length || 0}
                            </div>
                          </div>

                          <div className="border-t border-zinc-800/60 pt-3 flex items-center justify-between">
                            <span className="text-[11px] font-mono text-zinc-500">
                              Updated {new Date(sp.updatedAt).toLocaleDateString()}
                            </span>
                            <div className="flex items-center gap-2">
                              <Link
                                href={publicUrl}
                                target="_blank"
                                className="px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs flex items-center gap-1 transition-colors"
                              >
                                <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                                <span>Open Page</span>
                              </Link>
                              <button
                                onClick={() => handleDeleteStatusPage(sp.id, sp.title)}
                                className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-rose-950/40 hover:border-rose-900/50 text-zinc-400 hover:text-rose-400 transition-colors"
                                title="Delete Status Page"
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
              </div>
            )}


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
                            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400/80 mt-2 pt-2 border-t border-zinc-800/40">
                              <span>
                                {m.lastPingAt
                                  ? `Last Ping: ${new Date(m.lastPingAt).toLocaleTimeString()}`
                                  : "Waiting for initial ping"}
                              </span>
                              <span className="text-zinc-500">
                                {m.lastPingAt
                                  ? new Date(m.lastPingAt).toLocaleDateString()
                                  : "Never pinged"}
                              </span>
                            </div>
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
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedMonitorForStats(m)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-sky-400 text-xs transition-colors"
                            title="View Telemetry & Latency Breakdown"
                          >
                            <BarChart2 className="h-3.5 w-3.5 text-sky-400" />
                            <span>Telemetry</span>
                          </button>
                          <button
                            onClick={() => handleOpenAlertsModal(m)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-emerald-400 text-xs transition-colors"
                            title="Manage Alert Channels"
                          >
                            <Bell className="h-3.5 w-3.5" />
                            <span>
                              {m.alertChannels && m.alertChannels.length > 0
                                ? `${m.alertChannels.length} alert${m.alertChannels.length > 1 ? "s" : ""}`
                                : "Add alert"}
                            </span>
                          </button>
                        </div>

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

      {/* Alert Channels Modal */}
      {selectedMonitorForAlerts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-zinc-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                  <Bell className="h-5 w-5 text-emerald-400" />
                  Alert Notifications
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-md">
                  Configuring channels for <span className="text-zinc-200 font-semibold">{selectedMonitorForAlerts.name}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedMonitorForAlerts(null)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Configured Channels List */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Active Notification Channels ({selectedMonitorForAlerts.alertChannels?.length || 0})
              </label>

              {(!selectedMonitorForAlerts.alertChannels || selectedMonitorForAlerts.alertChannels.length === 0) ? (
                <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-center text-xs text-zinc-500">
                  No alert channels configured yet. Add a Discord webhook, Slack webhook, or Telegram bot below.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedMonitorForAlerts.alertChannels.map((ch, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase font-mono ${
                            ch.type === "discord"
                              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                              : ch.type === "slack"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                          }`}
                        >
                          {ch.type}
                        </span>
                        <span className="font-mono text-zinc-300 truncate text-[11px]" title={ch.target}>
                          {ch.target}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteAlertChannel(idx)}
                        disabled={savingAlerts}
                        className="p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors shrink-0"
                        title="Remove alert channel"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Channel Form */}
            <div className="border-t border-zinc-800 pt-5">
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
                Add New Alert Channel
              </h3>

              {/* Type Switcher */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(["discord", "slack", "telegram"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setNewChannelType(type);
                      setTestResult(null);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize transition-all border ${
                      newChannelType === type
                        ? "bg-zinc-800 text-zinc-100 border-zinc-600 shadow"
                        : "bg-zinc-950/60 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Target Input */}
              <div className="space-y-1.5 mb-3">
                <label className="block text-xs font-medium text-zinc-400">
                  {newChannelType === "discord"
                    ? "Discord Webhook URL"
                    : newChannelType === "slack"
                    ? "Slack Incoming Webhook URL"
                    : "Telegram Target (<bot_token>:<chat_id> or <chat_id>)"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    newChannelType === "discord"
                      ? "https://discord.com/api/webhooks/..."
                      : newChannelType === "slack"
                      ? "https://hooks.slack.com/services/..."
                      : "123456789:ABCdef_gh:987654321"
                  }
                  value={newChannelTarget}
                  onChange={(e) => {
                    setNewChannelTarget(e.target.value);
                    setTestResult(null);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Live Test Notification Feedback Banner */}
              {testResult && (
                <div
                  className={`p-3 mb-3 rounded-xl border text-xs flex items-center gap-2 ${
                    testResult.ok
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Actions: Send Test Notification & Add Channel */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestAlertChannel}
                  disabled={testingAlert || !newChannelTarget.trim()}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className={`h-3.5 w-3.5 ${testingAlert ? "animate-spin" : ""}`} />
                  {testingAlert ? "Testing..." : "Send Test Notification"}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMonitorForAlerts(null)}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={handleAddAlertChannel}
                    disabled={savingAlerts || !newChannelTarget.trim()}
                    className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {savingAlerts ? "Saving..." : "Add Channel"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry & Stats Modal */}
      {selectedMonitorForStats && token && (
        <MonitorStatsModal
          monitor={selectedMonitorForStats}
          token={token}
          onClose={() => setSelectedMonitorForStats(null)}
        />
      )}

      {/* Create Status Page Modal */}
      {isStatusPageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 my-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Globe className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Create Status Page</h2>
              </div>
              <button
                onClick={() => setIsStatusPageModalOpen(false)}
                className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {spError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{spError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStatusPage} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Page Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Production Services"
                  value={spTitle}
                  onChange={(e) => setSpTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 text-sm text-zinc-100 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  URL Slug
                </label>
                <div className="flex rounded-xl bg-zinc-950 border border-zinc-800 focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/60 overflow-hidden">
                  <span className="px-3 py-2.5 bg-zinc-900 border-r border-zinc-800 text-xs font-mono text-zinc-500 select-none">
                    /status/
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="my-company"
                    value={spSlug}
                    onChange={(e) => setSpSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="flex-1 px-3 py-2.5 bg-transparent focus:outline-none text-sm font-mono text-zinc-100"
                  />
                </div>
                <p className="text-[11px] font-mono text-zinc-500 mt-1">
                  Preview: /status/{spSlug || "your-slug"} (3-50 lowercase chars & hyphens)
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Real-time uptime and incident tracking for our customer-facing APIs."
                  value={spDesc}
                  onChange={(e) => setSpDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/60 text-sm text-zinc-100 transition-colors resize-none"
                />
              </div>

              {/* Include Monitors Checkbox list */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Include Monitors ({spSelectedMonitors.length} selected)
                </label>
                {monitors.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No monitors created yet.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                    {monitors.map((m) => {
                      const isChecked = spSelectedMonitors.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-zinc-900 cursor-pointer text-xs select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSpSelectedMonitors([...spSelectedMonitors, m.id]);
                              } else {
                                setSpSelectedMonitors(spSelectedMonitors.filter((id) => id !== m.id));
                              }
                            }}
                            className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500/40"
                          />
                          <span className="font-semibold text-zinc-200">{m.name}</span>
                          <span className="text-[10px] font-mono uppercase text-zinc-500">({m.type})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Public Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                <div>
                  <span className="text-xs font-semibold text-zinc-200 block">Public Status Page</span>
                  <span className="text-[11px] text-zinc-500">
                    Anyone with the link can view your status page without logging in.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={spPublic}
                  onChange={(e) => setSpPublic(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500/40"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setIsStatusPageModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={spSubmitting || !spTitle.trim() || !spSlug.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                >
                  <Plus className="h-4 w-4" />
                  {spSubmitting ? "Creating..." : "Create Status Page"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
