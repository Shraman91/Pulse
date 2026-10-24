"use client";

import React, { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Activity,
  Plus,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  Radio,
  LogIn,
  LogOut,
  AlertCircle,
  Bell,
  CheckCircle2,
  XCircle,
  BarChart2,
  Globe,
  Search,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  api,
  Monitor,
  Incident,
  StatusPage,
  CreateStatusPagePayload,
  CreateMonitorPayload,
  AlertChannel,
} from "@/lib/api";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MonitorForm } from "@/components/monitors/MonitorForm";

let cachedNow = 0;

function getNowSnapshot(): number {
  if (typeof window === "undefined") return 0;
  if (!cachedNow) {
    cachedNow = Date.now();
  }
  return cachedNow;
}

function subscribeNow(callback: () => void) {
  const timer = setInterval(() => {
    cachedNow = Date.now();
    callback();
  }, 5000);
  return () => clearInterval(timer);
}

export default function MonitorsPage() {
  const {
    user,
    token,
    loading: authLoading,
    signInWithGoogle,
    signInWithGithub,
    signInDev,
    signOut,
  } = useAuth();

  const currentTime = useSyncExternalStore(subscribeNow, getNowSnapshot, () => 0);

  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [statusPages, setStatusPages] = useState<StatusPage[]>([]);
  const [activeTab, setActiveTab] = useState<
    "monitors" | "incidents" | "statuspages"
  >("monitors");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterState, setFilterState] = useState<
    "all" | "up" | "down" | "paused"
  >("all");

  // Create Monitor Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Status Page Modal State
  const [isStatusPageModalOpen, setIsStatusPageModalOpen] = useState(false);
  const [spTitle, setSpTitle] = useState("");
  const [spSlug, setSpSlug] = useState("");
  const [spDesc, setSpDesc] = useState("");
  const spPublic = true;
  const [spSelectedMonitors, setSpSelectedMonitors] = useState<string[]>([]);
  const [spSubmitting, setSpSubmitting] = useState(false);
  const [spError, setSpError] = useState<string | null>(null);

  // Alert Settings Modal State
  const [selectedMonitorForAlerts, setSelectedMonitorForAlerts] =
    useState<Monitor | null>(null);
  const [newChannelType, setNewChannelType] = useState<
    "discord" | "slack" | "telegram"
  >("discord");
  const [newChannelTarget, setNewChannelTarget] = useState("");
  const [testingAlert, setTestingAlert] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [savingAlerts, setSavingAlerts] = useState(false);

  // Load monitors, incidents, status pages
  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const [monData, incData, spData] = await Promise.all([
        api.getMonitors(token).catch(() => []),
        api.getIncidents(token).catch(() => []),
        api.getStatusPages(token).catch(() => []),
      ]);
      setMonitors(Array.isArray(monData) ? monData : []);
      setIncidents(Array.isArray(incData) ? incData : []);
      setStatusPages(Array.isArray(spData) ? spData : []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load dashboard data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [token, fetchData]);

  // Handle Pause / Resume
  const handleTogglePause = async (mon: Monitor) => {
    if (!token) return;
    try {
      const updated = await api.updateMonitor(token, mon.id, {
        paused: !mon.paused,
      });
      setMonitors((prev) => prev.map((m) => (m.id === mon.id ? updated : m)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update monitor");
    }
  };

  // Handle Delete
  const handleDeleteMonitor = async (id: string, name: string) => {
    if (!token) return;
    if (!confirm(`Delete monitor "${name}"? This cannot be undone.`)) return;
    try {
      await api.deleteMonitor(token, id);
      setMonitors((prev) => prev.filter((m) => m.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete monitor");
    }
  };

  // Handle Create Monitor Submit
  const handleCreateSubmit = async (payload: CreateMonitorPayload) => {
    if (!token) return;
    try {
      setCreateSubmitting(true);
      setCreateError(null);
      const created = await api.createMonitor(token, payload);
      setMonitors((prev) => [created, ...prev]);
      setIsCreateModalOpen(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create monitor";
      setCreateError(msg);
      throw err;
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Handle Create Status Page Submit
  const handleCreateStatusPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      setSpSubmitting(true);
      setSpError(null);
      const payload: CreateStatusPagePayload = {
        title: spTitle.trim(),
        slug: spSlug.trim().toLowerCase(),
        description: spDesc.trim(),
        isPublic: spPublic,
        monitorIds: spSelectedMonitors,
      };
      const created = await api.createStatusPage(token, payload);
      setStatusPages((prev) => [created, ...prev]);
      setIsStatusPageModalOpen(false);
      setSpTitle("");
      setSpSlug("");
      setSpDesc("");
      setSpSelectedMonitors([]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create status page";
      setSpError(msg);
    } finally {
      setSpSubmitting(false);
    }
  };

  // Handle Delete Status Page
  const handleDeleteStatusPage = async (id: string, title: string) => {
    if (!token) return;
    if (!confirm(`Delete status page "${title}"?`)) return;
    try {
      await api.deleteStatusPage(token, id);
      setStatusPages((prev) => prev.filter((sp) => sp.id !== id));
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : "Failed to delete status page"
      );
    }
  };

  // Handle Add/Remove Alert Channel
  const handleSaveAlertChannels = async (channels: AlertChannel[]) => {
    if (!token || !selectedMonitorForAlerts) return;
    try {
      setSavingAlerts(true);
      const updated = await api.updateMonitor(
        token,
        selectedMonitorForAlerts.id,
        {
          alertChannels: channels,
        }
      );
      setMonitors((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );
      setSelectedMonitorForAlerts(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to save alert channels");
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleTestAlertChannel = async () => {
    if (!token || !newChannelTarget.trim()) return;
    try {
      setTestingAlert(true);
      setTestResult(null);
      await api.testAlertChannel(token, {
        type: newChannelType,
        target: newChannelTarget.trim(),
      });
      setTestResult({
        ok: true,
        message: "Test webhook delivered successfully!",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to send test alert";
      setTestResult({ ok: false, message: msg });
    } finally {
      setTestingAlert(false);
    }
  };

  // Summary counts
  const summary = useMemo(() => {
    const monList = monitors || [];
    const incList = incidents || [];
    const up = monList.filter((m) => !m.paused && m.state === "up").length;
    const down = monList.filter((m) => !m.paused && m.state === "down").length;
    const late = monList.filter(
      (m) => !m.paused && m.type === "heartbeat" && m.state === "down"
    ).length;
    const paused = monList.filter((m) => m.paused).length;
    const openIncidents = incList.filter((inc) => !inc.resolvedAt).length;

    return { up, down, late, paused, openIncidents };
  }, [monitors, incidents]);

  // Filtered monitors list
  const filteredMonitors = useMemo(() => {
    return (monitors || []).filter((m) => {
      // Search
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.url && m.url.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.pingToken && m.pingToken.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Filter state
      if (filterState === "up") return !m.paused && m.state === "up";
      if (filterState === "down") return !m.paused && m.state === "down";
      if (filterState === "paused") return m.paused;
      return true;
    });
  }, [monitors, searchQuery, filterState]);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] p-6 sm:p-10 max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-[var(--border-subtle)]">
          <TableSkeleton rows={6} />
        </div>
      </div>
    );
  }

  // Unauthenticated View
  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] selection:bg-[var(--aubergine-500)] selection:text-[var(--silver-50)] flex flex-col justify-center items-center p-6">
        <div className="w-full max-w-md p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] shadow-xl text-center space-y-6">
          <div className="w-12 h-12 rounded-xl bg-[var(--aubergine-500)] text-[var(--silver-50)] flex items-center justify-center font-bold mx-auto shadow-sm">
            <Activity className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Sign in to Pulse
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              Precision uptime &amp; dead man&apos;s switch monitoring instrument.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="w-full py-2.5 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--silver-50)] dark:hover:bg-[var(--silver-200)]/10 transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
            >
              <LogIn className="w-4 h-4 text-[var(--text-secondary)]" />
              <span>Continue with Google</span>
            </button>

            <button
              type="button"
              onClick={() => signInWithGithub()}
              className="w-full py-2.5 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--silver-50)] dark:hover:bg-[var(--silver-200)]/10 transition-colors flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
            >
              <LogIn className="w-4 h-4 text-[var(--text-secondary)]" />
              <span>Continue with GitHub</span>
            </button>

            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => signInDev()}
                className="w-full py-2 px-3 rounded-lg bg-[var(--aubergine-900)] text-[var(--silver-50)] text-xs font-semibold hover:bg-[var(--aubergine-700)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
              >
                Sign in with Developer Mode (Instant)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] selection:bg-[var(--aubergine-500)] selection:text-[var(--silver-50)] transition-colors duration-200">
      {/* Top App Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Navigation Tabs */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-bold tracking-tight hover:opacity-85 transition-opacity"
            >
              <div className="w-7 h-7 rounded-lg bg-[var(--aubergine-500)] text-[var(--silver-50)] flex items-center justify-center font-bold">
                <Activity className="w-4 h-4" />
              </div>
              <span>Pulse</span>
            </Link>

            <nav aria-label="Dashboard sections" className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("monitors")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === "monitors"
                    ? "bg-[var(--bg-page)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Monitors ({(monitors || []).length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("incidents")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors relative ${
                  activeTab === "incidents"
                    ? "bg-[var(--bg-page)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>Incidents</span>
                {summary.openIncidents > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--status-down)] text-white font-bold">
                    {summary.openIncidents}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("statuspages")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === "statuspages"
                    ? "bg-[var(--bg-page)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Status pages ({(statusPages || []).length})
              </button>
            </nav>
          </div>

          {/* User & Theme Toggle */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            <div className="flex items-center gap-2 pl-3 border-l border-[var(--border-subtle)]">
              <span className="text-xs font-mono text-[var(--text-secondary)] hidden md:inline truncate max-w-[140px]">
                {user.email || user.displayName || "Dev User"}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                aria-label="Sign out"
                className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--status-down)] hover:border-red-500/30 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* System Overview 4-Card Status Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 min-w-0">
          {/* Card 1: Up */}
          <div className="p-4 rounded-2xl glass-panel space-y-1.5 min-w-0 relative overflow-hidden group">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
              <span>Operational</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--status-up)]" />
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono text-[var(--status-up)] truncate">
              {summary.up}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">
              Endpoints healthy
            </div>
          </div>

          {/* Card 2: Down */}
          <div className="p-4 rounded-2xl glass-panel space-y-1.5 min-w-0 relative overflow-hidden group">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
              <span>Outages</span>
              <span className={`w-2 h-2 rounded-full ${summary.down > 0 ? "bg-[var(--status-down)] animate-ping" : "bg-[var(--status-down)]"}`} />
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono truncate ${summary.down > 0 ? "text-[var(--status-down)]" : "text-[var(--text-primary)]"}`}>
              {summary.down}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">
              Failing services
            </div>
          </div>

          {/* Card 3: Late */}
          <div className="p-4 rounded-2xl glass-panel space-y-1.5 min-w-0 relative overflow-hidden group">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
              <span>Late / Degraded</span>
              <span className="w-2 h-2 rounded-full bg-[var(--status-late)]" />
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-mono truncate ${summary.late > 0 ? "text-[var(--status-late)]" : "text-[var(--text-primary)]"}`}>
              {summary.late}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">
              Heartbeat delays
            </div>
          </div>

          {/* Card 4: Total & Incidents */}
          <div className="p-4 rounded-2xl glass-panel space-y-1.5 min-w-0 relative overflow-hidden group">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono">
              <span>Open Incidents</span>
              <span className="w-2 h-2 rounded-full bg-[var(--accent-hint)]" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono text-[var(--text-primary)] truncate">
              {summary.openIncidents}
            </div>
            <div className="text-[11px] font-mono text-[var(--text-muted)] truncate">
              Across {(monitors || []).length} total monitors
            </div>
          </div>
        </div>

        {/* Action Bar with Primary Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {activeTab === "monitors"
                ? `Active Monitors (${filteredMonitors.length})`
                : activeTab === "incidents"
                ? `Incidents History (${(incidents || []).length})`
                : `Public Status Pages (${(statusPages || []).length})`}
            </span>
          </div>

          {activeTab === "monitors" && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--aubergine-900)] text-[var(--silver-50)] text-xs font-semibold hover:bg-[var(--aubergine-700)] transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none glow-amethyst"
            >
              <Plus className="w-4 h-4" />
              <span>Create monitor</span>
            </button>
          )}

          {activeTab === "statuspages" && (
            <button
              type="button"
              onClick={() => setIsStatusPageModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--aubergine-900)] text-[var(--silver-50)] text-xs font-semibold hover:bg-[var(--aubergine-700)] transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none glow-amethyst"
            >
              <Plus className="w-4 h-4" />
              <span>Create status page</span>
            </button>
          )}
        </div>

        {/* Error notification banner */}
        {error && (
          <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchData}
              className="px-2.5 py-1 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[11px] font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* TAB 1: MONITORS */}
        {activeTab === "monitors" && (
          <section aria-labelledby="monitors-table-heading" className="space-y-4 min-w-0">
            {/* Search and Filters */}
            {(monitors || []).length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between min-w-0">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search monitors by name or URL..."
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none transition-colors"
                  />
                </div>

                <div className="flex rounded-xl p-0.5 bg-[var(--bg-panel)] border border-[var(--border-subtle)]">
                  {(["all", "up", "down", "paused"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFilterState(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                        filterState === st
                          ? "bg-[var(--bg-page)] text-[var(--text-primary)] shadow-sm"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <TableSkeleton rows={5} />
            ) : filteredMonitors.length === 0 ? (
              (monitors || []).length === 0 ? (
                <EmptyState
                  icon={<Globe className="w-6 h-6" />}
                  title="No monitors yet"
                  description="Add your first HTTP endpoint or heartbeat cron job to start monitoring."
                  actionLabel="Create monitor"
                  onAction={() => setIsCreateModalOpen(true)}
                />
              ) : (
                <div className="p-8 text-center text-xs text-[var(--text-secondary)] rounded-2xl glass-panel">
                  No monitors match your current search and filter.
                </div>
              )
            ) : (
              /* Dense Laboratory-Grade Monitors Table with Overflow-X Container */
              <div className="rounded-2xl glass-panel overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-page)]/70 text-[var(--text-secondary)] font-mono text-[11px]">
                      <th className="py-3.5 px-4 font-semibold">State</th>
                      <th className="py-3.5 px-4 font-semibold">Monitor</th>
                      <th className="py-3.5 px-4 font-semibold hidden md:table-cell">
                        Target / Cron
                      </th>
                      <th className="py-3.5 px-4 font-semibold hidden sm:table-cell">
                        Interval
                      </th>
                      <th className="py-3.5 px-4 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {filteredMonitors.map((mon) => {
                      const isCheckingNow =
                        !mon.paused &&
                        mon.nextCheckAt &&
                        currentTime > 0 &&
                        new Date(mon.nextCheckAt).getTime() <= currentTime + 15000;

                      return (
                        <tr
                          key={mon.id}
                          className="hover:bg-[var(--bg-page)]/80 transition-colors group"
                        >
                          {/* State Column */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {mon.paused ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--silver-400)]/20 text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                                  <span className="w-2 h-2 rounded-full bg-[var(--status-paused)]" />
                                  <span>Paused</span>
                                </span>
                              ) : mon.state === "up" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                  <span className="w-2 h-2 rounded-full bg-[var(--status-up)]" />
                                  <span>Up</span>
                                </span>
                              ) : mon.state === "down" ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30">
                                  <span className="w-2 h-2 rounded-full bg-[var(--status-down)]" />
                                  <span>Down</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                  <span className="w-2 h-2 rounded-full bg-[var(--accent-hint)]" />
                                  <span>Pending</span>
                                </span>
                              )}

                              {/* Marigold "Checking Now" dot */}
                              {isCheckingNow && (
                                <span
                                  title="Checking right now"
                                  className="w-1.5 h-1.5 rounded-full bg-[var(--accent-hint)] animate-ping"
                                />
                              )}
                            </div>
                          </td>

                          {/* Name Column */}
                          <td className="py-3.5 px-4">
                            <Link
                              href={`/monitors/${mon.id}`}
                              className="font-bold text-[var(--text-primary)] hover:underline flex items-center gap-1.5 max-w-[200px] sm:max-w-[260px] truncate"
                              title={mon.name}
                            >
                              <span className="truncate">{mon.name}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] transition-opacity shrink-0" />
                            </Link>
                            <span className="text-[11px] font-mono text-[var(--text-secondary)] block sm:hidden truncate max-w-[200px]">
                              {mon.type === "http" ? mon.url : `cron: ping/${mon.pingToken?.slice(0, 8)}`}
                            </span>
                          </td>

                          {/* Target Column */}
                          <td className="py-3.5 px-4 hidden md:table-cell font-mono text-[11px] text-[var(--text-secondary)] max-w-[220px] sm:max-w-xs truncate">
                            {mon.type === "http" ? (
                              <span className="truncate block" title={mon.url}>{mon.url}</span>
                            ) : (
                              <div className="flex items-center gap-1.5 truncate">
                                <Radio className="w-3.5 h-3.5 text-[var(--accent-hint)] shrink-0" />
                                <span className="truncate">
                                  ping/{mon.pingToken?.slice(0, 12)}...
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Interval Column */}
                          <td className="py-3.5 px-4 hidden sm:table-cell font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-[var(--bg-page)] border border-[var(--border-subtle)]">
                              {mon.type === "http"
                                ? `${mon.intervalSec}s`
                                : `${mon.expectedEverySec}s`}
                            </span>
                          </td>

                          {/* Actions Column */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <Link
                                href={`/monitors/${mon.id}`}
                                title="View telemetry & stats"
                                className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page)] transition-colors"
                              >
                                <BarChart2 className="w-3.5 h-3.5" />
                              </Link>

                              <button
                                type="button"
                                onClick={() => setSelectedMonitorForAlerts(mon)}
                                title="Alert settings"
                                className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page)] transition-colors"
                              >
                                <Bell className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleTogglePause(mon)}
                                title={mon.paused ? "Resume" : "Pause"}
                                className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-page)] transition-colors"
                              >
                                {mon.paused ? (
                                  <Play className="w-3.5 h-3.5 text-[var(--status-up)]" />
                                ) : (
                                  <Pause className="w-3.5 h-3.5 text-[var(--status-paused)]" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteMonitor(mon.id, mon.name)
                                }
                                title="Delete monitor"
                                className="p-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* TAB 2: INCIDENTS */}
        {activeTab === "incidents" && (
          <section aria-labelledby="incidents-heading" className="space-y-4 min-w-0">
            <h2 id="incidents-heading" className="text-base font-bold text-[var(--text-primary)]">
              All incidents
            </h2>

            {(incidents || []).length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="w-6 h-6 text-[var(--status-up)]" />}
                title="Zero active incidents"
                description="All your services are healthy and passing checks."
              />
            ) : (
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
                        <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2 truncate">
                          <span>{inc.monitorName}</span>
                          <span className="font-normal text-[var(--text-secondary)] truncate">
                            — {inc.cause || "Health check failed"}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5">
                          Started: {new Date(inc.startedAt).toLocaleString()}
                          {inc.resolvedAt && (
                            <span>
                              {" "}
                              • Resolved:{" "}
                              {new Date(inc.resolvedAt).toLocaleString()}
                            </span>
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
                      {inc.resolvedAt ? "Resolved" : "Open incident"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: STATUS PAGES */}
        {activeTab === "statuspages" && (
          <section aria-labelledby="statuspages-heading" className="space-y-4 min-w-0">
            <h2 id="statuspages-heading" className="text-base font-bold text-[var(--text-primary)]">
              Public status pages
            </h2>

            {(statusPages || []).length === 0 ? (
              <EmptyState
                icon={<Globe className="w-6 h-6" />}
                title="No status pages created"
                description="Share live uptime reports with your users using clean public status pages."
                actionLabel="Create status page"
                onAction={() => setIsStatusPageModalOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {(statusPages || []).map((sp) => (
                  <div
                    key={sp.id}
                    className="p-5 rounded-2xl glass-panel space-y-3.5 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-up)]" />
                          <span>Live</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteStatusPage(sp.id, sp.title)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>

                      <h3 className="font-bold text-[var(--text-primary)] text-sm tracking-tight">
                        {sp.title}
                      </h3>

                      {sp.description && (
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                          {sp.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-mono">
                      <span className="text-[var(--text-secondary)]">
                        {(sp.monitorIds || []).length} monitors
                      </span>
                      <Link
                        href={`/status/${sp.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-[var(--aubergine-400)] hover:underline font-semibold"
                      >
                        <span>/status/{sp.slug}</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* CREATE MONITOR MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Create new monitor
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Close
              </button>
            </div>
            <MonitorForm
              token={token || ""}
              submitting={createSubmitting}
              error={createError}
              onSubmit={handleCreateSubmit}
              onCancel={() => setIsCreateModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* CREATE STATUS PAGE MODAL */}
      {isStatusPageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Create public status page
              </h3>
              <button
                type="button"
                onClick={() => setIsStatusPageModalOpen(false)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateStatusPage} className="space-y-4 text-xs">
              {spError && (
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400">
                  {spError}
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold block text-[var(--text-primary)]">
                  Title
                </label>
                <input
                  type="text"
                  value={spTitle}
                  onChange={(e) => setSpTitle(e.target.value)}
                  placeholder="e.g. Acme Production Status"
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold block text-[var(--text-primary)]">
                  Slug (URL pathname)
                </label>
                <div className="flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] px-3">
                  <span className="font-mono text-[var(--text-secondary)]">
                    /status/
                  </span>
                  <input
                    type="text"
                    value={spSlug}
                    onChange={(e) => setSpSlug(e.target.value.toLowerCase())}
                    placeholder="acme-corp"
                    className="flex-1 py-2 font-mono text-[var(--text-primary)] bg-transparent focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold block text-[var(--text-primary)]">
                  Description (optional)
                </label>
                <textarea
                  value={spDesc}
                  onChange={(e) => setSpDesc(e.target.value)}
                  placeholder="Real-time uptime status for Acme public API and services."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="font-semibold block text-[var(--text-primary)]">
                  Included monitors ({spSelectedMonitors.length} selected)
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1 border border-[var(--border-subtle)] rounded-lg p-2 bg-[var(--bg-page)]">
                  {(monitors || []).map((m) => {
                    const isChecked = spSelectedMonitors.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-[var(--bg-panel)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSpSelectedMonitors((prev) => [...prev, m.id]);
                            } else {
                              setSpSelectedMonitors((prev) =>
                                prev.filter((id) => id !== m.id)
                              );
                            }
                          }}
                          className="rounded border-[var(--border-subtle)]"
                        />
                        <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                          {m.name}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-secondary)] ml-auto uppercase">
                          {m.type}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsStatusPageModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] font-semibold text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={spSubmitting || !spTitle.trim() || !spSlug.trim()}
                  className="px-5 py-2 rounded-lg bg-[var(--aubergine-900)] text-[var(--silver-50)] font-semibold hover:bg-[var(--aubergine-700)] disabled:opacity-50"
                >
                  {spSubmitting ? "Creating..." : "Create page"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALERT CHANNELS MODAL */}
      {selectedMonitorForAlerts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Alert channels: {selectedMonitorForAlerts.name}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Receive webhook alerts when consecutive failures exceed threshold.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedMonitorForAlerts(null);
                  setTestResult(null);
                }}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Close
              </button>
            </div>

            {/* Existing Channels */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Active webhooks ({(selectedMonitorForAlerts.alertChannels || []).length})
              </span>
              {(selectedMonitorForAlerts.alertChannels || []).length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)] italic">
                  No alert channels configured yet.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {(selectedMonitorForAlerts.alertChannels || []).map((ch, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-panel)] font-bold uppercase border border-[var(--border-subtle)]">
                          {ch.type}
                        </span>
                        <span className="font-mono text-[var(--text-secondary)] truncate">
                          {ch.target}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = selectedMonitorForAlerts.alertChannels.filter(
                            (_, i) => i !== idx
                          );
                          handleSaveAlertChannels(updated);
                        }}
                        className="text-xs text-red-500 hover:underline ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Channel */}
            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-3">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Add new webhook channel
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={newChannelType}
                  onChange={(e) =>
                    setNewChannelType(
                      e.target.value as "discord" | "slack" | "telegram"
                    )
                  }
                  className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs text-[var(--text-primary)]"
                >
                  <option value="discord">Discord</option>
                  <option value="slack">Slack</option>
                  <option value="telegram">Telegram</option>
                </select>
                <input
                  type="text"
                  value={newChannelTarget}
                  onChange={(e) => setNewChannelTarget(e.target.value)}
                  placeholder="Webhook URL or Chat ID..."
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestAlertChannel}
                  disabled={testingAlert || !newChannelTarget.trim()}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-page)] disabled:opacity-50 transition-colors"
                >
                  {testingAlert ? "Testing..." : "Send test webhook"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!newChannelTarget.trim()) return;
                    const next = [
                      ...selectedMonitorForAlerts.alertChannels,
                      {
                        type: newChannelType,
                        target: newChannelTarget.trim(),
                      },
                    ];
                    handleSaveAlertChannels(next);
                    setNewChannelTarget("");
                  }}
                  disabled={!newChannelTarget.trim() || savingAlerts}
                  className="px-4 py-1.5 rounded-lg bg-[var(--aubergine-500)] text-[var(--silver-50)] text-xs font-semibold hover:bg-[var(--aubergine-700)] disabled:opacity-50"
                >
                  {savingAlerts ? "Saving..." : "Add channel"}
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                    testResult.ok
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20"
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
