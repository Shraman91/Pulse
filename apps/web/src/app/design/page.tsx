"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Pause,
  HelpCircle,
  Activity,
  Radio,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTheme } from "@/context/ThemeContext";
import { KineticHeading } from "@/components/fx/KineticHeading";
import { Marquee } from "@/components/fx/Marquee";
import { ParticleField, ParticleFieldHandle } from "@/components/fx/ParticleField";

export default function DesignSystemPage() {
  const { resolvedTheme } = useTheme();
  const [sampleText, setSampleText] = useState("https://api.example.com/health");
  const [sampleType, setSampleType] = useState<"http" | "heartbeat">("http");
  const [sampleChecked, setSampleChecked] = useState(true);
  const particleFieldRef = useRef<ParticleFieldHandle>(null);

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Top Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)] text-[var(--silver-50)] flex items-center justify-center font-bold">
                <Activity className="w-4 h-4" />
              </div>
              <span>Pulse</span>
            </Link>
            <span className="text-[var(--text-secondary)]">/</span>
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-secondary)]">
              Design system
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--text-secondary)] hidden sm:inline">
              Theme: <span className="font-semibold capitalize text-[var(--text-primary)]">{resolvedTheme}</span>
            </span>
            <ThemeToggle />
            <Link
              href="/monitors"
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] hover:border-[var(--border-strong)] transition-colors"
            >
              Back to app
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-16">
        {/* Intro */}
        <section aria-labelledby="intro-title" className="space-y-4">
          <h1 id="intro-title" className="text-3xl sm:text-4xl font-bold tracking-tight">
            Pulse design system
          </h1>
          <p className="text-base text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            Pulse is designed as a machined silver instrument that is alive. The interface uses calibrated silver surfaces (~70%), precision aubergine ink (~25%), and marigold hints (&lt;5%) for focus rings and micro-indicators.
          </p>
        </section>

        {/* Color Palette */}
        <section aria-labelledby="palette-title" className="space-y-6">
          <div className="border-b border-[var(--border-subtle)] pb-2 flex items-baseline justify-between">
            <h2 id="palette-title" className="text-xl font-bold tracking-tight">
              Color tokens
            </h2>
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              70% Silver / 25% Aubergine / &lt;5% Marigold
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Silver 50 */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-2">
              <div className="h-14 rounded-lg border border-[#B4B9C0] bg-[#F2F3F5]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">--silver-50</span>
                <span className="text-xs font-mono text-[var(--text-secondary)]">#F2F3F5</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Raised panels, highlights</p>
            </div>

            {/* Silver 200 */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-2">
              <div className="h-14 rounded-lg border border-[#B4B9C0] bg-[#D9DCE0]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">--silver-200</span>
                <span className="text-xs font-mono text-[var(--text-secondary)]">#D9DCE0</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Default page surface (light theme)</p>
            </div>

            {/* Silver 400 */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-2">
              <div className="h-14 rounded-lg border border-[#8A9099] bg-[#B4B9C0]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">--silver-400</span>
                <span className="text-xs font-mono text-[var(--text-secondary)]">#B4B9C0</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Borders, dividers, dots on light</p>
            </div>

            {/* Silver 600 */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-2">
              <div className="h-14 rounded-lg border border-[#B4B9C0] bg-[#8A9099]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">--silver-600</span>
                <span className="text-xs font-mono text-[var(--text-secondary)]">#8A9099</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Secondary text on light, muted UI</p>
            </div>

            {/* Aubergine 900 */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-2">
              <div className="h-14 rounded-lg border border-[#3A1540] bg-[#1B0A1F]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">--aubergine-900</span>
                <span className="text-xs font-mono text-[var(--text-secondary)]">#1B0A1F</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Text on silver, dark theme surface</p>
            </div>

            {/* Aubergine 700 */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-2">
              <div className="h-14 rounded-lg border border-[#5C2465] bg-[#3A1540]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">--aubergine-700</span>
                <span className="text-xs font-mono text-[var(--text-secondary)]">#3A1540</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Secondary surfaces, dark panels</p>
            </div>

            {/* Aubergine 500 */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-2">
              <div className="h-14 rounded-lg border border-[#3A1540] bg-[#5C2465]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">--aubergine-500</span>
                <span className="text-xs font-mono text-[var(--text-secondary)]">#5C2465</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Secondary accent: buttons, charts</p>
            </div>

            {/* Marigold 500 */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-2">
              <div className="h-14 rounded-lg border border-[#F4A913] bg-[#F4A913]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">--marigold-500</span>
                <span className="text-xs font-mono text-[var(--text-secondary)]">#F4A913</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Accent hints: focus rings, today dot</p>
            </div>

            {/* Marigold 300 */}
            <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-2">
              <div className="h-14 rounded-lg border border-[#FFC94D] bg-[#FFC94D]" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">--marigold-300</span>
                <span className="text-xs font-mono text-[var(--text-secondary)]">#FFC94D</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Accent on dark surfaces</p>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section aria-labelledby="typography-title" className="space-y-6">
          <div className="border-b border-[var(--border-subtle)] pb-2">
            <h2 id="typography-title" className="text-xl font-bold tracking-tight">
              Typography and copy rules
            </h2>
          </div>

          <div className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-6">
            <div>
              <span className="text-xs font-mono text-[var(--text-secondary)] block mb-1">
                Display 1 • Bricolage Grotesque Bold • 36px
              </span>
              <p className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                Know the moment your service goes quiet.
              </p>
            </div>

            <div>
              <span className="text-xs font-mono text-[var(--text-secondary)] block mb-1">
                Headline • Bricolage Grotesque SemiBold • 24px
              </span>
              <p className="text-2xl font-semibold tracking-tight">
                High-precision HTTP and dead man&apos;s switch checking.
              </p>
            </div>

            <div>
              <span className="text-xs font-mono text-[var(--text-secondary)] block mb-1">
                Body • Bricolage Grotesque Regular • 15px (Max 80 chars per line)
              </span>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-prose leading-relaxed">
                Detect outages before users notice. Monitored with high-precision httptrace, anti-flapping incident states, multi-channel alerting, and public status pages.
              </p>
            </div>

            <div>
              <span className="text-xs font-mono text-[var(--text-secondary)] block mb-1">
                Code & Ping Snippets • JetBrains Mono • 13px
              </span>
              <div className="p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-xs overflow-x-auto">
                curl -fsS --retry 3 https://pulse.dev/ping/d89f07a2-94b1
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-xs font-semibold text-[var(--text-primary)]">Style rule:</span>{" "}
              <span className="text-xs text-[var(--text-secondary)]">
                Sentence case everywhere. No ALL-CAPS eyebrows, no tracked-out caps labels, no spaced em dashes.
              </span>
            </div>
          </div>
        </section>

        {/* Kinetic Typography (Phase F1) */}
        <section aria-labelledby="kinetic-title" className="space-y-6">
          <div className="border-b border-[var(--border-subtle)] pb-2 flex items-baseline justify-between">
            <h2 id="kinetic-title" className="text-xl font-bold tracking-tight">
              Kinetic typography &amp; marquee
            </h2>
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              Signature effects • Hero only
            </span>
          </div>

          <div className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-6">
            <div>
              <span className="text-xs font-mono text-[var(--text-secondary)] block mb-2">
                KineticHeading • Hover letters or watch periodic ECG heartbeat pulse
              </span>
              <div className="p-4 rounded-lg bg-[var(--bg-page)] border border-[var(--border-subtle)]">
                <KineticHeading
                  text="Know the moment your service goes quiet."
                  className="text-2xl sm:text-3xl font-bold"
                />
              </div>
            </div>

            <div>
              <span className="text-xs font-mono text-[var(--text-secondary)] block mb-2">
                Marquee • Responsive to scroll velocity and skew
              </span>
              <Marquee
                items={[
                  "Zero-trust SSRF guard",
                  "Distributed lease workers",
                  "httptrace latency breakdown",
                  "Anti-flapping incidents",
                  "Dead man's switch cron",
                  "Discord Slack Telegram alerts",
                  "Public status pages",
                ]}
                speed={35}
              />
            </div>
          </div>
        </section>

        {/* Particle Field (Phase F2) */}
        <section aria-labelledby="particles-title" className="space-y-6">
          <div className="border-b border-[var(--border-subtle)] pb-2 flex items-baseline justify-between">
            <h2 id="particles-title" className="text-xl font-bold tracking-tight">
              Drifting particle field
            </h2>
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              Canvas 2D • Proximity mesh • Pulse ripple
            </span>
          </div>

          <div className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-4">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Desktop renders ~90 particles, mobile ~40. About 1 in 12 particles is tinted marigold with a warm proximity glow. Particles gently drift, connect with proximity lines, repel from cursor, and pause when tab is hidden or off-screen.
            </p>

            <div className="relative h-64 sm:h-80 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-page)] overflow-hidden shadow-inner">
              <ParticleField ref={particleFieldRef} particleCount={70} />

              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                <div className="px-4 py-2 rounded-xl bg-[var(--bg-panel)]/90 backdrop-blur-md border border-[var(--border-subtle)] shadow-sm pointer-events-auto flex flex-col sm:flex-row items-center gap-3">
                  <span className="text-xs text-[var(--text-primary)] font-medium">
                    Move cursor across canvas or trigger ripple
                  </span>
                  <button
                    type="button"
                    onClick={() => particleFieldRef.current?.pulse()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--aubergine-500)] text-[var(--silver-50)] text-xs font-semibold hover:bg-[var(--aubergine-700)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Radio className="w-3.5 h-3.5 text-[var(--marigold-300)]" aria-hidden="true" />
                    Trigger heartbeat pulse
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section aria-labelledby="buttons-title" className="space-y-6">
          <div className="border-b border-[var(--border-subtle)] pb-2">
            <h2 id="buttons-title" className="text-xl font-bold tracking-tight">
              Button components
            </h2>
          </div>

          <div className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Primary */}
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-[var(--aubergine-500)] text-[var(--silver-50)] text-sm font-semibold hover:bg-[var(--aubergine-700)] transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Create monitor
              </button>

              {/* Secondary */}
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] text-sm font-medium hover:border-[var(--border-strong)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Send test alert
              </button>

              {/* Subtle Outline */}
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Pause monitor
              </button>

              {/* Destructive */}
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Delete monitor
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Focus rings use <code className="font-mono text-[var(--text-primary)]">--marigold-500</code> in light theme and <code className="font-mono text-[var(--text-primary)]">--marigold-300</code> in dark theme. Press Tab to preview focus outline.
            </p>
          </div>
        </section>

        {/* Form Inputs */}
        <section aria-labelledby="inputs-title" className="space-y-6">
          <div className="border-b border-[var(--border-subtle)] pb-2">
            <h2 id="inputs-title" className="text-xl font-bold tracking-tight">
              Inputs and form controls
            </h2>
          </div>

          <div className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-6 max-w-xl">
            {/* Text Input */}
            <div className="space-y-1.5">
              <label htmlFor="sample-url" className="text-xs font-semibold text-[var(--text-primary)]">
                Target URL
              </label>
              <input
                id="sample-url"
                type="url"
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-page)] text-[var(--text-primary)] font-mono text-sm placeholder:text-[var(--text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] transition-all"
                placeholder="https://example.com"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                The endpoint checked on each interval. Must start with http:// or https://.
              </p>
            </div>

            {/* Radio Group */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-[var(--text-primary)] block">
                Monitor type
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSampleType("http")}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    sampleType === "http"
                      ? "border-[var(--aubergine-500)] bg-[var(--bg-subtle)] font-semibold"
                      : "border-[var(--border-subtle)] bg-[var(--bg-page)] opacity-70"
                  }`}
                >
                  <span className="text-sm block">HTTP endpoint</span>
                  <span className="text-xs text-[var(--text-secondary)]">Checks response code & latency</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSampleType("heartbeat")}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    sampleType === "heartbeat"
                      ? "border-[var(--aubergine-500)] bg-[var(--bg-subtle)] font-semibold"
                      : "border-[var(--border-subtle)] bg-[var(--bg-page)] opacity-70"
                  }`}
                >
                  <span className="text-sm block">Heartbeat cron</span>
                  <span className="text-xs text-[var(--text-secondary)]">Dead man&apos;s switch ping</span>
                </button>
              </div>
            </div>

            {/* Checkbox */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sampleChecked}
                onChange={(e) => setSampleChecked(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border-subtle)] text-[var(--aubergine-500)] focus:ring-[var(--focus-ring)]"
              />
              <span className="text-sm text-[var(--text-primary)]">
                Dispatch alerts when consecutive failures reach 3
              </span>
            </label>
          </div>
        </section>

        {/* State Badges */}
        <section aria-labelledby="badges-title" className="space-y-6">
          <div className="border-b border-[var(--border-subtle)] pb-2 flex items-baseline justify-between">
            <h2 id="badges-title" className="text-xl font-bold tracking-tight">
              Monitor state badges
            </h2>
            <span className="text-xs text-[var(--text-secondary)]">
              Color is never the only signal; always pair with icon and text label
            </span>
          </div>

          <div className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Up */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EAF7ED] dark:bg-[#132718] text-[#237836] dark:text-[#49AA19] border border-[#95DE64] dark:border-[#1F4F28]">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Up</span>
              </div>

              {/* Down */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFF1F0] dark:bg-[#2A1215] text-[#A8071A] dark:text-[#E84749] border border-[#FFA39E] dark:border-[#5C1D24]">
                <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Down</span>
              </div>

              {/* Late */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFFBE6] dark:bg-[#2B1D0E] text-[#AD6800] dark:text-[#D89614] border border-[#FFE58F] dark:border-[#593C15]">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Late</span>
              </div>

              {/* Paused */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F5F5F5] dark:bg-[#1E1622] text-[#595959] dark:text-[#8C8C8C] border border-[#D9D9D9] dark:border-[#3D2944]">
                <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Paused</span>
              </div>

              {/* Unknown */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F5F5F5] dark:bg-[#1E1622] text-[#8C8C8C] dark:text-[#8C8C8C] border border-[#D9D9D9] dark:border-[#3D2944]">
                <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Unknown</span>
              </div>
            </div>

            {/* Active Checking Indicator */}
            <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--marigold-500)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--marigold-500)]" />
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                Active checking now indicator (uses marigold hint, strictly non-textual)
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-subtle)] py-6 mt-16 text-center text-xs text-[var(--text-secondary)]">
        Pulse design system • Bricolage Grotesque &amp; JetBrains Mono • WCAG AA compliant
      </footer>
    </div>
  );
}
