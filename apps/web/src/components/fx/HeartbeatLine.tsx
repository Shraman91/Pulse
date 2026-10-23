"use client";

import React, { useEffect, useRef, useSyncExternalStore } from "react";

interface HeartbeatLineProps {
  className?: string;
  onBeat?: (x?: number, y?: number) => void;
  interval?: number; // duration of one ECG cycle in seconds (default 4.2)
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

// SVG ECG path with clear P, Q, R, S, T waves
const ECG_PATH_D =
  "M 0 30 L 130 30 Q 142 24 152 30 L 165 30 L 175 35 L 190 6 L 205 50 L 218 30 L 235 30 Q 252 20 270 30 L 400 30";

export function HeartbeatLine({
  className = "",
  onBeat,
  interval = 4.2,
}: HeartbeatLineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const blipRef = useRef<SVGCircleElement>(null);
  const glowPathRef = useRef<SVGPathElement>(null);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );

  const onBeatRef = useRef(onBeat);
  useEffect(() => {
    onBeatRef.current = onBeat;
  }, [onBeat]);

  const inViewRef = useRef<boolean>(true);
  const isTabActiveRef = useRef<boolean>(true);

  useEffect(() => {
    if (reducedMotion) return;

    const container = containerRef.current;
    const path = pathRef.current;
    const blip = blipRef.current;
    const glowPath = glowPathRef.current;
    if (!container || !path || !blip) return;

    const pathLength = path.getTotalLength();
    let frameId: number | null = null;
    const startTime = performance.now();
    let hasTriggeredInCycle = false;

    // Peak is roughly at x=190, which is around 48% along pathLength
    const peakProgress = 0.475;

    // Visibility & Intersection Observers
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        inViewRef.current = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );
    intersectionObserver.observe(container);

    const handleVisibility = () => {
      isTabActiveRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const animate = (now: number) => {
      if (inViewRef.current && isTabActiveRef.current) {
        const elapsed = (now - startTime) / 1000;
        const cycleProgress = (elapsed % interval) / interval; // 0.0 to 1.0

        if (cycleProgress < 0.1) {
          hasTriggeredInCycle = false;
        }

        // Calculate point along ECG path
        const currentDistance = cycleProgress * pathLength;
        const pt = path.getPointAtLength(currentDistance);

        // Position traveling blip
        blip.setAttribute("cx", pt.x.toString());
        blip.setAttribute("cy", pt.y.toString());

        // Update glow trail with dashoffset
        if (glowPath) {
          const trailLength = pathLength * 0.22;
          glowPath.style.strokeDasharray = `${trailLength} ${pathLength}`;
          glowPath.style.strokeDashoffset = `${
            -currentDistance + trailLength
          }px`;
        }

        // Fire beat ripple when passing through R-wave peak
        if (!hasTriggeredInCycle && cycleProgress >= peakProgress) {
          hasTriggeredInCycle = true;
          if (onBeatRef.current && container) {
            const rect = container.getBoundingClientRect();
            // Scale SVG viewBox (400x60) to container dimensions
            const scaleX = rect.width / 400;
            const scaleY = rect.height / 60;
            const screenX = rect.left + pt.x * scaleX;
            const screenY = rect.top + pt.y * scaleY;
            onBeatRef.current(screenX, screenY);
          }
        }
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [interval, reducedMotion]);

  return (
    <div
      ref={containerRef}
      className={`relative select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 400 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto overflow-visible"
      >
        {/* Faint static trace */}
        <path
          ref={pathRef}
          d={ECG_PATH_D}
          stroke="var(--border-subtle)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-40"
        />

        {!reducedMotion && (
          <>
            {/* Glowing trail behind blip */}
            <path
              ref={glowPathRef}
              d={ECG_PATH_D}
              stroke="var(--accent-hint)"
              strokeWidth="2.0"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-90"
            />

            {/* Traveling ECG blip */}
            <circle
              ref={blipRef}
              cx="0"
              cy="30"
              r="3.5"
              fill="var(--accent-hint)"
              className="filter drop-shadow-[0_0_6px_var(--accent-hint)]"
            />
          </>
        )}
      </svg>
    </div>
  );
}
