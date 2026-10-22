import React from "react";
import Link from "next/link";
import { Activity, ShieldCheck, Cpu, Bell, CheckCircle2, Terminal } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <Activity className="h-5 w-5 animate-pulse" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Pulse
            </span>
            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              v1.0 Ready
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="http://localhost:8080/healthz"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-emerald-400 transition-colors py-1 px-3 rounded-lg border border-zinc-800 bg-zinc-900/60"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              API: 8080
            </a>
            <Link
              href="/monitors"
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-20 flex flex-col justify-center">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Zero-Trust Distributed Monitoring Engine
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Uptime and cron monitoring{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              engineered for developers.
            </span>
          </h1>

          <p className="text-lg text-zinc-400 leading-relaxed mb-10 max-w-2xl">
            Detect outages before users notice. Monitored with high-precision <code className="text-zinc-200 bg-zinc-800/80 px-1.5 py-0.5 rounded font-mono text-sm">httptrace</code>,
            anti-flapping incident states, multi-channel alerting (Discord, Slack, Telegram), and public status pages.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/monitors"
              className="px-6 py-3 rounded-xl bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.3)]"
            >
              Get Started Free
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-semibold hover:bg-zinc-850 hover:border-zinc-700 transition-colors flex items-center gap-2"
            >
              <Terminal className="h-4 w-4" />
              View Architecture
            </a>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-all">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold mb-2">SSRF-Safe Network Guard</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Custom socket control intercepts resolved DNS records, blocking all loopback, RFC 1918, link-local, and cloud metadata targets.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-all">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Distributed Lease Worker Pool</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              20 concurrent goroutines claim checks with atomic Firestore transactions and jitter, guaranteeing no duplicate executions across instances.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-all">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
              <Bell className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Anti-Flapping Alerts</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              State machine requires 3 consecutive failures before alerting, eliminating false alarm noise while resolving on the very first recovery.
            </p>
          </div>
        </div>

        {/* System Status Banner */}
        <div className="mt-16 p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-medium text-zinc-300">Phase 0 Architecture Scaffold Initialized</span>
          </div>
          <span className="text-xs font-mono text-zinc-500">Go 1.22+ • Next.js 15 • Firebase</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
        Pulse Uptime Monitoring &copy; 2026. Designed for resilience and cost-efficiency.
      </footer>
    </div>
  );
}
