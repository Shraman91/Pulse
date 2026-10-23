# Pulse Design System & Frontend Architecture

Pulse is an uptime and cron monitoring tool built for developers who care about precision, speed, and reliability. This document serves as the single source of truth for the visual language, component library, effect lifecycles, accessibility standards, and engineering guidelines across `apps/web`.

---

## 1. Core Philosophy

### 1.1 Machined Instrumentation
Pulse is designed as a **laboratory-grade physical instrument**, milled out of cold machined silver and deep aubergine. It rejects generic SaaS trends (such as noisy gradients, candy-colored buttons, and excessive rounded cards) in favor of crisp borders, dense data tables, monospace metrics, and tactile micro-interactions.

### 1.2 Disciplined Boldness
> **The Golden Rule**: Boldness is reserved for the landing page hero. App screens, dashboards, and status pages remain calm, utilitarian, and distraction-free.

- **Landing Hero**: Kinetic variable typography, WebGL halftone dot matrices, animated ECG heartbeat lines, and interactive drifting particle fields.
- **In-App Dashboard & Monitor Detail**: High data density, instant readability, zero decorative canvas loops, quiet state transitions, and clear visual hierarchy.
- **Status Pages**: Public-facing, calm, high-contrast operational beacons and interactive 30-day uptime timelines.

### 1.3 Microcopy & Tone
- Plain, direct, sentence-case English.
- No hollow marketing jargon ("revolutionary", "magic", "disruptive").
- Clear states: `3 up • 0 down • 0 late • 0 open incidents`.
- Descriptive action triggers: `Create monitor`, `Send test ping`, `Copy ping URL`.

### 1.4 No Mock Data Commitment
Every UI element in Pulse connects to the real Go backend (`services/api`) via the type-safe API client (`@/lib/api.ts`) and Firebase Auth. There are no mock flags, fake fixtures, or synthetic fallback arrays.

---

## 2. Color Palette & CSS Tokens

Pulse enforces a strict color token hierarchy defined in `src/styles/tokens.css` and applied via CSS variables.

### 2.1 The Three Core Hues
1. **Machined Silver (70%)**: The dominant structural surface.
   - Light Mode: Crisp off-white and cool aluminum (`#f8fafc` to `#cbd5e1`).
   - Dark Mode: Deep gunmetal and anodized titanium (`#0f172a` to `#334155`).
2. **Deep Aubergine (25%)**: The anchoring grounding tone.
   - Provides contrast, depth, and identity (`#1a0b2e`, `#2d124d`, `#3b1d64`).
   - Used for headers, primary action buttons in light mode, badge backgrounds, and deep shadows.
3. **Warm Marigold (<5%)**: The intentional accent hint.
   - Used sparingly as a heartbeat accent and subtle highlight (`#f59e0b`, `#fbbf24`).
   - **Contrast Rule**: Marigold is never used for text over light silver backgrounds. It is strictly used as an accent ring, particle highlight, or badge indicator.

### 2.2 Semantic Status Palette
- **Up / Operational**: Emerald (`#10b981`) — represents healthy heartbeats and successful 2xx responses.
- **Down / Outage**: Rose / Crimson (`#f43f5e`) — represents failed pings, 5xx errors, or dead man's switch timeouts.
- **Late / Degraded**: Marigold / Amber (`#f59e0b`) — represents cron jobs overdue within grace period or latency spikes.
- **Pending / Unknown**: Muted Silver (`#94a3b8`) — newly provisioned monitors awaiting first ping.

### 2.3 Token Reference

| CSS Variable | Dark Value | Light Value | Purpose |
| :--- | :--- | :--- | :--- |
| `--bg-page` | `#090a0f` | `#f8f9fb` | Main document background |
| `--bg-panel` | `#12131a` | `#ffffff` | Primary card and table container |
| `--bg-panel-elevated` | `#181a24` | `#f1f3f7` | Modals, dropdowns, hovered rows |
| `--border-subtle` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` | Primary card and row dividers |
| `--border-strong` | `rgba(255,255,255,0.18)` | `rgba(0,0,0,0.16)` | Active borders, hover states |
| `--text-primary` | `#f1f5f9` | `#0f172a` | High-contrast body and headings |
| `--text-secondary` | `#94a3b8` | `#64748b` | Subheadings, table column headers, metadata |
| `--text-muted` | `#64748b` | `#94a3b8` | Timestamps, inactive tabs, disabled labels |
| `--status-up` | `#10b981` | `#059669` | Monitor operational status |
| `--status-down` | `#f43f5e` | `#e11d48` | Monitor failing status |
| `--status-late` | `#f59e0b` | `#d97706` | Monitor late status |
| `--accent-hint` | `#f59e0b` | `#d97706` | Heartbeat pulse accent |
| `--focus-ring` | `#a855f7` | `#7c3aed` | Accessible keyboard focus outline |

---

## 3. Typography Hierarchy

Pulse utilizes three distinct typeface families to communicate precision:

1. **Display Headings (`font-heading`)**: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque)
   - Variable axis font (`font-optical-sizing`, `font-variation-settings`).
   - Kinetic interpolation on hero headings with animated weights (`300` to `800`) and optical widths.
2. **Body & Interface (`font-sans`)**: [Inter](https://fonts.google.com/specimen/Inter)
   - Clean, geometric neutral sans-serif optimized for legibility at small sizes.
   - Letter-spacing: `-0.011em` on body text.
3. **Data, Metrics & Code (`font-mono`)**: [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)
   - Used for all status codes (`200 OK`, `502`), response times (`42ms`), cron schedules (`*/5 * * * *`), ping URLs, and GUIDs.

---

## 4. Visual Effects Catalog & Lifecycles

Pulse includes signature front-end effects crafted with vanilla Canvas and WebGL. Each effect follows strict lifecycle, performance, and accessibility safeguards.

### 4.1 KineticHeading (`@/components/fx/KineticHeading.tsx`)
- **Metaphor**: Live physiological heartbeat rhythm pulsing through typography.
- **Mechanism**: A 4.2-second mathematical ECG wave function interpolating the CSS variable font axis `font-variation-settings: 'wght' W, 'wdth' D`.
- **Interactivity**: Proximity mouse swell — characters near the cursor swell in weight.
- **Safeguards**:
  - Automatically disabled when `prefers-reduced-motion: reduce` is detected.
  - Pauses execution loop when element scrolls out of viewport (`IntersectionObserver`).

### 4.2 ParticleField (`@/components/fx/ParticleField.tsx`)
- **Metaphor**: Atmospheric silver dust floating in a machined laboratory chamber.
- **Mechanism**: High-performance HTML5 2D Canvas. ~70 silver particles with ~1 in 12 particles highlighted in warm marigold.
- **Proximity Mesh**: Particles closer than 85px draw semi-transparent connective threads.
- **Cursor Repulsion**: Smooth velocity deflection when the cursor approaches.
- **Imperative API**: Exposes `pulse(x, y)` ref method to trigger outward shockwave rings.
- **Safeguards**:
  - Device Pixel Ratio (DPR) capped at 2.0 to prevent GPU throttling on retina 4K screens.
  - Automatically pauses rendering when browser tab is inactive (`document.hidden`) or off-screen.
  - Static low-opacity fallback rendered when `prefers-reduced-motion` is active.

### 4.3 HalftoneHero (`@/components/fx/HalftoneHero.tsx`)
- **Metaphor**: Milled aluminum perforated speaker grill responding to energy waves.
- **Mechanism**: WebGL fragment shader using `ogl` (minimal WebGL library). Dynamically renders a hexagonal dot matrix with distance-based radius modulation and mouse reaction.
- **Safeguards**:
  - Inverted Y coordinates (`rect.height - clientY`) for WebGL coordinate space.
  - Pure CSS radial-gradient fallback if WebGL context creation fails or device is low-power.
  - Viewport intersection observer to cease shader draw calls when scrolled past.

### 4.4 HeartbeatLine (`@/components/fx/HeartbeatLine.tsx`)
- **Metaphor**: Real-time electrocardiogram (ECG) monitor.
- **Mechanism**: SVG path drawn via `motion/react` with a cyclical stroke-dashoffset animation.
- **Cross-Component Sync**: Synchronously invokes `particleFieldRef.current.pulse(x, y)` at the exact moment the R-wave peak spikes, visually coupling the type, the trace, and the particle field.

### 4.5 UptimeDots (`@/components/fx/UptimeDots.tsx`)
- **Metaphor**: 30-day segmented historical availability grid.
- **Mechanism**: Interactive SVG circles sized proportionally to uptime percentage ($2.5\text{px}$ to $6.5\text{px}$).
- **State Colors**:
  - Green (`--status-up`): 100% checks passed.
  - Red (`--status-down`): Failures recorded during window.
  - Amber / Marigold (`--accent-hint`): Today's active cycle with pulsing concentric ring.
- **Interactivity**: Hover and keyboard focus reveal a floating glass tooltip showing date, uptime percentage, checks passed/failed, and average latency.
- **Accessibility**: Full ARIA group labels and keyboard navigable focus rings (`tabIndex={0}`).

---

## 5. Accessibility (a11y) Standards

Pulse is committed to WCAG 2.1 Level AA compliance:

1. **Reduced Motion**:
   - Every animated component checks `window.matchMedia('(prefers-reduced-motion: reduce)')`.
   - When active: animations halt, particle field becomes static, and headings display standard font weights.
2. **Screen Reader Live Announcements**:
   - Summary status bars (`3 up • 0 down • 0 late`) use `aria-live="polite"` and `role="status"` to announce real-time health transitions without interrupting screen readers.
3. **Contrast Compliance**:
   - All text tokens meet minimum 4.5:1 contrast against their respective panel backgrounds.
   - Text over light silver backgrounds strictly uses `--text-primary` (`#0f172a`) or `--text-secondary` (`#64748b`), never yellow or marigold.
4. **Keyboard Operability**:
   - Custom interactive elements (e.g. UptimeDots, tab triggers, modal buttons) provide visible `:focus-visible` rings with `--focus-ring`.
   - Modals trap focus and close on `Escape`.

---

## 6. Engineering Conventions for Contributors

### 6.1 Token Adherence
Always use CSS variables rather than arbitrary hex values or arbitrary Tailwind classes:
```tsx
// Correct
<div className="bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[var(--text-primary)]" />

// Incorrect
<div className="bg-zinc-900 border border-zinc-800 text-white" />
```

### 6.2 Next.js 16 Partial Prerendering (PPR) Safe Practices
Turbopack in Next.js 16 enforces strict prerendering invariants:
- **No Synchronous Client Clock Reads**: Calling `new Date()` or `Date.now()` inside a component render pass triggers `blocking-prerender-current-time-client`.
- **Solution**: Use `useSyncExternalStore` or subscribe on mount:
```tsx
const mounted = useSyncExternalStore(
  () => () => {},
  () => true,
  () => false
);
```
- **Dynamic Route Params**: Any page accessing `useParams()` must be wrapped in a `<Suspense>` boundary in its default export.

### 6.3 State & Density Guidelines
- Use `LoadingSkeleton` with matching layout structures during data fetching.
- Use `EmptyState` with a clear icon, plain sentence explanation, and a direct call-to-action button when lists are empty.
- When adding new metrics or table columns, use `font-mono` for numeric values to prevent layout shift during live poll updates.
