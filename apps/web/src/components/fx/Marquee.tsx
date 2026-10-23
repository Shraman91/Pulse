"use client";

import React, { useEffect, useRef, useState, useMemo, useSyncExternalStore } from "react";

interface MarqueeProps {
  items: string[];
  separator?: string;
  speed?: number; // pixels per second
  className?: string;
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

export function Marquee({
  items,
  separator = "•",
  speed = 40,
  className = "",
}: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );

  // IntersectionObserver to pause when off screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Velocity and offset animation
  useEffect(() => {
    if (!inView || reducedMotion) return;

    let frameId: number;
    let lastTime = performance.now();
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;
    let offset = 0;
    let currentSkew = 0;

    const handleScroll = () => {
      const now = performance.now();
      const currentScrollY = window.scrollY;
      const dt = Math.max(16, now - lastTime);
      const dy = currentScrollY - lastScrollY;
      scrollVelocity = (dy / dt) * 1000; // px per second
      lastScrollY = currentScrollY;
      lastTime = now;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    const step = (time: number) => {
      const dt = Math.min(32, time - lastTime) / 1000;
      lastTime = time;

      // Decay scroll velocity towards zero
      scrollVelocity *= 0.92;
      if (Math.abs(scrollVelocity) < 0.1) scrollVelocity = 0;

      // Target skew and speed based on velocity
      const targetSkew = Math.max(-5, Math.min(5, (scrollVelocity / 800) * -5));
      currentSkew += (targetSkew - currentSkew) * 0.12;

      // Effective speed
      const dynamicSpeed = speed + Math.abs(scrollVelocity) * 0.25;
      offset -= dynamicSpeed * dt;

      if (trackRef.current) {
        // Repeat cycle: when offset passes half the track width, wrap around
        const trackWidth = trackRef.current.scrollWidth / 2;
        if (trackWidth > 0 && Math.abs(offset) >= trackWidth) {
          offset = offset % trackWidth;
        }

        trackRef.current.style.transform = `translate3d(${offset}px, 0, 0) skewX(${currentSkew.toFixed(2)}deg)`;
      }

      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(frameId);
    };
  }, [inView, reducedMotion, speed]);

  const fullText = useMemo(() => items.join(`  ${separator}  `), [items, separator]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none py-4 border-y border-[var(--border-subtle)] bg-[var(--bg-panel)]/50 ${className}`}
      aria-label={`Announcement: ${fullText}`}
    >
      <div
        ref={trackRef}
        className="flex whitespace-nowrap will-change-transform font-mono text-xs uppercase tracking-widest text-[var(--text-secondary)]"
      >
        {/* Render twice for seamless infinite wrap */}
        {[0, 1].map((copyIndex) => (
          <div
            key={copyIndex}
            className="flex items-center shrink-0"
            aria-hidden={copyIndex > 0 ? "true" : undefined}
          >
            {items.map((item, idx) => (
              <span key={`${copyIndex}-${idx}`} className="inline-flex items-center">
                <span className="hover:text-[var(--text-primary)] transition-colors px-4">
                  {item}
                </span>
                <span className="text-[var(--marigold-500)] dark:text-[var(--marigold-300)] opacity-70">
                  {separator}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
