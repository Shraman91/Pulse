"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ShieldCheck,
  Cpu,
  Bell,
  Clock,
  Terminal,
  ArrowRight,
  Copy,
  Check,
  ExternalLink,
  Sliders,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { KineticHeading } from "@/components/fx/KineticHeading";
import { Marquee } from "@/components/fx/Marquee";
import {
  ParticleField,
  ParticleFieldHandle,
} from "@/components/fx/ParticleField";
import { HalftoneHero } from "@/components/fx/HalftoneHero";
import { HalftoneDivider } from "@/components/fx/HalftoneDivider";
import { HeartbeatLine } from "@/components/fx/HeartbeatLine";

export default function Home() {
  const { user } = useAuth();
  const particleFieldRef = useRef<ParticleFieldHandle>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const cronSnippet =
    "0 2 * * * /backup.sh && curl -fsS --retry 3 https://pulse.dev/ping/token_8f39a1c4";

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(cronSnippet);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleHeartbeat = (x?: number, y?: number) => {
    particleFieldRef.current?.pulse(x, y);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col font-sans selection:bg-[var(--aubergine-500)] selection:text-[var(--silver-50)] transition-colors duration-200">
      {/* Top Header Navigation */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 group focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-lg outline-none"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--aubergine-500)] text-[var(--silver-50)] flex items-center justify-center font-bold shadow-sm group-hover:bg-[var(--aubergine-700)] transition-colors">
                <Activity className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
                  Pulse
                </span>
                <span className="text-[10px] font-mono text-[var(--text-secondary)] -mt-0.5">
                  Uptime &amp; cron
                </span>
              </div>
            </Link>
          </div>

          {/* Right Navigation */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/design"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-page)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Design system</span>
            </Link>

            <a
              href="http://localhost:8080/healthz"
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-page)]"
            >
              <span className="w-2 h-2 rounded-full bg-[var(--status-up)] animate-pulse" />
              <span>API: 8080</span>
            </a>

            <ThemeToggle />

            {user ? (
              <Link
                href="/monitors"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-[var(--aubergine-900)] text-[var(--silver-50)] hover:bg-[var(--aubergine-700)] transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
              >
                <span>Open dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                href="/monitors"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-[var(--aubergine-900)] text-[var(--silver-50)] hover:bg-[var(--aubergine-700)] transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
              >
                <span>Start monitoring</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        aria-labelledby="hero-heading"
        className="relative overflow-hidden border-b border-[var(--border-subtle)]"
      >
        {/* Layer 1: WebGL Halftone Dot Field */}
        <HalftoneHero className="opacity-90" />

        {/* Layer 2: 2D Canvas Particle Field with Pulse Ripple API */}
        <ParticleField ref={particleFieldRef} />

        {/* Vignette bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--bg-page)] to-transparent pointer-events-none" />

        {/* Foreground Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center flex flex-col items-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--bg-panel)]/80 backdrop-blur-md border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)] shadow-sm mb-6 pointer-events-auto">
            <span
              className="w-2 h-2 rounded-full bg-[var(--accent-hint)] animate-ping"
              aria-hidden="true"
            />
            <span>Zero-trust distributed monitoring engine</span>
          </div>

          {/* Kinetic Headline */}
          <KineticHeading
            text="Know the moment your service goes quiet."
            className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[var(--text-primary)] max-w-4xl leading-[1.08]"
          />

          {/* Subheading */}
          <p className="mt-6 text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            Precision HTTP checking and dead man&apos;s switch for cron jobs.
            Anti-flapping incident states, zero false alarms, and instant alert
            delivery.
          </p>

          {/* Heartbeat ECG Line: pulses particle field on every R-wave beat */}
          <div className="w-full max-w-md my-4 px-4 pointer-events-auto">
            <HeartbeatLine onBeat={handleHeartbeat} interval={4.2} />
          </div>

          {/* Call to Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-2 pointer-events-auto">
            <Link
              href="/monitors"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--aubergine-900)] text-[var(--silver-50)] text-sm font-semibold hover:bg-[var(--aubergine-700)] transition-all shadow-md focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
            >
              <span>Start monitoring free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#architecture"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--bg-panel)]/90 backdrop-blur-md border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm font-semibold hover:bg-[var(--bg-panel)] transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
            >
              <Terminal className="w-4 h-4 text-[var(--text-secondary)]" />
              <span>Inspect architecture</span>
            </a>
          </div>
        </div>
      </section>

      {/* Continuous Marquee Band */}
      <section aria-label="Feature marquee" className="border-b border-[var(--border-subtle)]">
        <Marquee
          items={[
            "Zero-trust SSRF guard",
            "Distributed lease workers",
            "httptrace latency breakdown",
            "Anti-flapping incident states",
            "Dead man's switch cron",
            "Discord, Slack, Telegram alerts",
            "Public status pages",
          ]}
          speed={32}
        />
      </section>

      {/* Halftone Transition Divider */}
      <HalftoneDivider height="h-16" fade="both" hasBorder />

      {/* Main Architectural Capabilities */}
      <main id="architecture" className="flex-1 max-w-6xl mx-auto px-6 py-16 space-y-20">
        {/* Section Header */}
        <div className="max-w-2xl">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)]">
            Architectural guarantees
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Engineered like laboratory hardware.
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
            Built from scratch in Go and Next.js. Every check undergoes strict
            network validation, microsecond socket tracing, and distributed
            consensus.
          </p>
        </div>

        {/* 4 Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: SSRF Guard */}
          <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-4 hover:border-[var(--text-muted)] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-page)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[var(--status-up)]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Zero-trust network guard
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1.5">
                Custom dialer control intercepts resolved DNS records before
                connecting. Rejects loopback (127.0.0.1), RFC 1918 private ranges,
                carrier-grade NAT, and cloud metadata (169.254.169.254) to
                prevent internal network probing.
              </p>
            </div>
            <div className="pt-2 text-[11px] font-mono text-[var(--text-secondary)] border-t border-[var(--border-subtle)]/50 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-up)]" />
              <span>RFC 1918 &amp; cloud metadata blocked</span>
            </div>
          </div>

          {/* Card 2: Distributed Worker Pool */}
          <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-4 hover:border-[var(--text-muted)] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-page)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center">
              <Cpu className="w-5 h-5 text-[var(--aubergine-500)]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Atomic lease worker pool
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1.5">
                Checks are scheduled across concurrent workers using atomic
                database transactions with random jitter. Monitors are claimed
                with leases, guaranteeing zero duplicate executions or missed
                intervals across worker replicas.
              </p>
            </div>
            <div className="pt-2 text-[11px] font-mono text-[var(--text-secondary)] border-t border-[var(--border-subtle)]/50 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-hint)]" />
              <span>Atomic lease consensus</span>
            </div>
          </div>

          {/* Card 3: Anti-Flapping Alerts */}
          <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-4 hover:border-[var(--text-muted)] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-page)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center">
              <Bell className="w-5 h-5 text-[var(--status-down)]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Anti-flapping incident states
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1.5">
                Never get woken up by transient network blips. Monitors require 3
                consecutive check failures before opening an incident and
                dispatching webhooks to Discord, Slack, or Telegram. Resolves
                instantly on the first healthy check.
              </p>
            </div>
            <div className="pt-2 text-[11px] font-mono text-[var(--text-secondary)] border-t border-[var(--border-subtle)]/50 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-down)]" />
              <span>3 consecutive failure hysteresis</span>
            </div>
          </div>

          {/* Card 4: Microsecond Latency Breakdown */}
          <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-4 hover:border-[var(--text-muted)] transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-page)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center">
              <Clock className="w-5 h-5 text-[var(--accent-hint)]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Microsecond httptrace latency
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1.5">
                Pinpoint root causes instantly. Every HTTP check measures DNS
                lookup, TCP connection handshake, TLS certificate negotiation,
                and server response Time To First Byte (TTFB) independently.
              </p>
            </div>
            <div className="pt-2 text-[11px] font-mono text-[var(--text-secondary)] border-t border-[var(--border-subtle)]/50 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-up)]" />
              <span>DNS • Connect • TLS • TTFB</span>
            </div>
          </div>
        </div>

        {/* Dead Man's Switch Cron Explainer */}
        <div className="p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)]">
                Cron &amp; background tasks
              </span>
              <h3 className="text-xl font-bold text-[var(--text-primary)] mt-0.5">
                Dead man&apos;s switch for cron jobs
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono bg-[var(--bg-page)] border border-[var(--border-subtle)] text-[var(--text-secondary)] self-start sm:self-auto">
              cURL ping token
            </span>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-2xl">
            Never wonder if your database backup or billing reconciliation job
            quietly failed to start. Append a cURL ping to your crontab. If
            Pulse doesn&apos;t hear from your job within the expected interval
            plus grace window, it fires an immediate alert.
          </p>

          {/* Copyable cURL Box */}
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--aubergine-900)] text-[var(--silver-50)] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[var(--silver-400)]">
              <span>Crontab integration snippet</span>
              <button
                type="button"
                onClick={handleCopySnippet}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--aubergine-700)] text-[var(--silver-50)] text-xs hover:bg-[var(--aubergine-500)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
              >
                {copiedSnippet ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy snippet</span>
                  </>
                )}
              </button>
            </div>
            <pre className="font-mono text-xs overflow-x-auto text-[var(--silver-50)] select-all py-1">
              <code>{cronSnippet}</code>
            </pre>
          </div>
        </div>
      </main>

      {/* Halftone Transition Divider */}
      <HalftoneDivider height="h-16" fade="both" hasBorder />

      {/* Machined Silver Footer */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[var(--aubergine-500)] text-[var(--silver-50)] flex items-center justify-center font-bold">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <span>
              Pulse &copy; 2026. Precision uptime and cron monitoring for
              developers.
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/monitors"
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/design"
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              Design system
            </Link>
            <a
              href="http://localhost:8080/healthz"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[var(--text-primary)] transition-colors inline-flex items-center gap-1"
            >
              <span>API health</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
