"use client";

import React, { useState } from "react";
import {
  Globe,
  Radio,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  CreateMonitorPayload,
  AlertChannel,
  Monitor,
  api,
} from "@/lib/api";

interface MonitorFormProps {
  initialMonitor?: Monitor;
  token: string;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (payload: CreateMonitorPayload) => Promise<void>;
  onCancel?: () => void;
}

export function MonitorForm({
  initialMonitor,
  token,
  submitting = false,
  error = null,
  onSubmit,
  onCancel,
}: MonitorFormProps) {
  const [type, setType] = useState<"http" | "heartbeat">(
    initialMonitor?.type || "http"
  );
  const [name, setName] = useState(initialMonitor?.name || "");

  // HTTP specific state
  const [url, setUrl] = useState(initialMonitor?.url || "https://");
  const [method, setMethod] = useState(initialMonitor?.method || "GET");
  const [intervalSec, setIntervalSec] = useState(
    initialMonitor?.intervalSec || 300
  );
  const [timeoutMs, setTimeoutMs] = useState(
    initialMonitor?.timeoutMs || 10000
  );
  const [expectedStatus, setExpectedStatus] = useState(
    initialMonitor?.expectedStatus || 200
  );

  // Heartbeat specific state
  const [expectedEverySec, setExpectedEverySec] = useState(
    initialMonitor?.expectedEverySec || 3600
  );
  const [graceSec, setGraceSec] = useState(initialMonitor?.graceSec || 300);

  // Alert Channel state
  const [channels, setChannels] = useState<AlertChannel[]>(
    initialMonitor?.alertChannels || []
  );
  const [newChannelType, setNewChannelType] = useState<
    "discord" | "slack" | "telegram"
  >("discord");
  const [newChannelTarget, setNewChannelTarget] = useState("");
  const [testingAlert, setTestingAlert] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const [validationError, setValidationError] = useState<string | null>(null);

  const handleTestAlert = async () => {
    if (!newChannelTarget.trim()) {
      setTestResult({ ok: false, message: "Enter a webhook URL or chat ID first" });
      return;
    }

    try {
      setTestingAlert(true);
      setTestResult(null);
      await api.testAlertChannel(token, {
        type: newChannelType,
        target: newChannelTarget.trim(),
      });
      setTestResult({
        ok: true,
        message: "Test alert dispatched successfully! Check your channel.",
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to deliver test alert";
      setTestResult({ ok: false, message: msg });
    } finally {
      setTestingAlert(false);
    }
  };

  const handleAddChannel = () => {
    if (!newChannelTarget.trim()) return;
    setChannels((prev) => [
      ...prev,
      { type: newChannelType, target: newChannelTarget.trim() },
    ]);
    setNewChannelTarget("");
    setTestResult(null);
  };

  const handleRemoveChannel = (index: number) => {
    setChannels((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError("Please enter a monitor name");
      return;
    }

    if (type === "http") {
      const trimmedUrl = url.trim();
      if (!trimmedUrl || (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://"))) {
        setValidationError("Please enter a valid HTTP or HTTPS URL");
        return;
      }

      await onSubmit({
        name: trimmedName,
        type: "http",
        url: trimmedUrl,
        method,
        intervalSec: Number(intervalSec),
        timeoutMs: Number(timeoutMs),
        expectedStatus: Number(expectedStatus),
        alertChannels: channels,
      });
    } else {
      await onSubmit({
        name: trimmedName,
        type: "heartbeat",
        expectedEverySec: Number(expectedEverySec),
        graceSec: Number(graceSec),
        alertChannels: channels,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type Toggle Tabs */}
      {!initialMonitor && (
        <div className="flex rounded-xl p-1 bg-[var(--bg-page)] border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setType("http")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
              type === "http"
                ? "bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Globe className="w-4 h-4 text-[var(--status-up)]" />
            <span>HTTP endpoint</span>
          </button>
          <button
            type="button"
            onClick={() => setType("heartbeat")}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
              type === "heartbeat"
                ? "bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Radio className="w-4 h-4 text-[var(--accent-hint)]" />
            <span>Heartbeat (Cron)</span>
          </button>
        </div>
      )}

      {/* Error Banners */}
      {(validationError || error) && (
        <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{validationError || error}</span>
        </div>
      )}

      {/* Monitor Name */}
      <div className="space-y-1.5">
        <label
          htmlFor="monitor-name"
          className="block text-xs font-semibold text-[var(--text-primary)]"
        >
          Monitor name
        </label>
        <input
          id="monitor-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            type === "http" ? "e.g. Production API" : "e.g. Daily DB Backup"
          }
          className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
          required
        />
      </div>

      {/* HTTP Fields */}
      {type === "http" && (
        <div className="space-y-4">
          {/* URL & Method */}
          <div className="space-y-1.5">
            <label
              htmlFor="monitor-url"
              className="block text-xs font-semibold text-[var(--text-primary)]"
            >
              URL to check
            </label>
            <div className="flex gap-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs font-mono text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
              >
                <option value="GET">GET</option>
                <option value="HEAD">HEAD</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input
                id="monitor-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/health"
                className="flex-1 px-3.5 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
                required
              />
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Protected by SSRF guard: private IPs, loopback, and cloud metadata
              are rejected.
            </p>
          </div>

          {/* Grid Settings: Interval, Timeout, Expected Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="monitor-interval"
                className="block text-xs font-semibold text-[var(--text-primary)]"
              >
                Check interval
              </label>
              <select
                id="monitor-interval"
                value={intervalSec}
                onChange={(e) => setIntervalSec(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
              >
                <option value={30}>Every 30 seconds</option>
                <option value={60}>Every 1 minute</option>
                <option value={300}>Every 5 minutes</option>
                <option value={600}>Every 10 minutes</option>
                <option value={1800}>Every 30 minutes</option>
                <option value={3600}>Every 1 hour</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="monitor-timeout"
                className="block text-xs font-semibold text-[var(--text-primary)]"
              >
                Timeout
              </label>
              <select
                id="monitor-timeout"
                value={timeoutMs}
                onChange={(e) => setTimeoutMs(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
              >
                <option value={5000}>5 seconds</option>
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="monitor-status"
                className="block text-xs font-semibold text-[var(--text-primary)]"
              >
                Expected status
              </label>
              <input
                id="monitor-status"
                type="number"
                value={expectedStatus}
                onChange={(e) => setExpectedStatus(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs font-mono text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Heartbeat Fields */}
      {type === "heartbeat" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="heartbeat-expected"
                className="block text-xs font-semibold text-[var(--text-primary)]"
              >
                Expected every
              </label>
              <select
                id="heartbeat-expected"
                value={expectedEverySec}
                onChange={(e) => setExpectedEverySec(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
              >
                <option value={60}>Every 1 minute</option>
                <option value={300}>Every 5 minutes</option>
                <option value={900}>Every 15 minutes</option>
                <option value={3600}>Every 1 hour</option>
                <option value={21600}>Every 6 hours</option>
                <option value={43200}>Every 12 hours</option>
                <option value={86400}>Every 24 hours (1 day)</option>
                <option value={604800}>Every 7 days</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="heartbeat-grace"
                className="block text-xs font-semibold text-[var(--text-primary)]"
              >
                Grace period
              </label>
              <select
                id="heartbeat-grace"
                value={graceSec}
                onChange={(e) => setGraceSec(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
              >
                <option value={120}>2 minutes</option>
                <option value={300}>5 minutes</option>
                <option value={900}>15 minutes</option>
                <option value={1800}>30 minutes</option>
                <option value={3600}>1 hour</option>
              </select>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs text-[var(--text-secondary)] space-y-1">
            <span className="font-semibold text-[var(--text-primary)] block">
              How dead man&apos;s switch works
            </span>
            <p className="leading-relaxed">
              After creating this monitor, Pulse generates a unique ping token.
              Append a cURL request to your crontab script. If a ping is not
              received within the expected window plus grace period, you will receive an alert.
            </p>
          </div>
        </div>
      )}

      {/* Alert Webhooks Section */}
      <div className="pt-4 border-t border-[var(--border-subtle)] space-y-4">
        <div>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Alert channels (optional)
          </span>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            Receive instant notifications when incidents occur.
          </p>
        </div>

        {/* Channels List */}
        {channels.length > 0 && (
          <div className="space-y-2">
            {channels.map((ch, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs font-mono"
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-panel)] font-bold uppercase border border-[var(--border-subtle)]">
                    {ch.type}
                  </span>
                  <span className="truncate text-[var(--text-secondary)]">
                    {ch.target}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveChannel(idx)}
                  className="text-xs text-[var(--status-down)] hover:underline ml-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Channel Row */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={newChannelType}
              onChange={(e) =>
                setNewChannelType(
                  e.target.value as "discord" | "slack" | "telegram"
                )
              }
              className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
            >
              <option value="discord">Discord Webhook</option>
              <option value="slack">Slack Webhook</option>
              <option value="telegram">Telegram Webhook</option>
            </select>
            <input
              type="text"
              value={newChannelTarget}
              onChange={(e) => setNewChannelTarget(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="flex-1 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTestAlert}
                disabled={testingAlert || !newChannelTarget.trim()}
                className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-page)] disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {testingAlert ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Test</span>
              </button>
              <button
                type="button"
                onClick={handleAddChannel}
                disabled={!newChannelTarget.trim()}
                className="px-3 py-2 rounded-lg bg-[var(--aubergine-500)] text-[var(--silver-50)] text-xs font-semibold hover:bg-[var(--aubergine-700)] disabled:opacity-50 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Test feedback banner */}
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

      {/* Form Action Buttons */}
      <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--aubergine-900)] text-[var(--silver-50)] text-xs font-semibold hover:bg-[var(--aubergine-700)] disabled:opacity-60 transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>
            {initialMonitor ? "Update monitor" : "Create monitor"}
          </span>
        </button>
      </div>
    </form>
  );
}
