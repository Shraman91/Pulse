"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback, useSyncExternalStore } from "react";

interface KineticHeadingProps {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3";
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

export function KineticHeading({
  text,
  className = "",
  as: Component = "h1",
}: KineticHeadingProps) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [inView, setInView] = useState(true);
  const [entranceDone, setEntranceDone] = useState(false);
  const [wavePos, setWavePos] = useState<number | null>(null);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );

  // Split words and letters
  const words = useMemo(() => {
    return text.split(" ").map((word) => word.split(""));
  }, [text]);

  const totalChars = useMemo(() => {
    return words.reduce((acc, word) => acc + word.length, 0);
  }, [words]);

  // IntersectionObserver to pause pulse wave when off screen
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Entrance animation timer
  useEffect(() => {
    if (reducedMotion) {
      setEntranceDone(true);
      return;
    }
    const timer = setTimeout(() => {
      setEntranceDone(true);
    }, totalChars * 25 + 600);
    return () => clearTimeout(timer);
  }, [reducedMotion, totalChars]);

  // Pulse wave animation loop (ECG pulse traveling left to right)
  useEffect(() => {
    if (!entranceDone || !inView || reducedMotion) {
      return;
    }

    let frameId: number;
    let waveStartTime = 0;
    const waveDuration = 1200; // ms for wave to travel across
    const intervalBetweenWaves = 4200; // ms between heartbeat pulses

    let nextWaveTimeout: NodeJS.Timeout;

    const runWave = () => {
      waveStartTime = performance.now();

      const step = (now: number) => {
        const elapsed = now - waveStartTime;
        const progress = elapsed / waveDuration;

        if (progress <= 1.0) {
          // wave position in character index units (from -3 to totalChars + 3)
          const currentPos = progress * (totalChars + 6) - 3;
          setWavePos(currentPos);
          frameId = requestAnimationFrame(step);
        } else {
          setWavePos(null);
          nextWaveTimeout = setTimeout(runWave, intervalBetweenWaves);
        }
      };

      frameId = requestAnimationFrame(step);
    };

    nextWaveTimeout = setTimeout(runWave, 1800);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(nextWaveTimeout);
    };
  }, [entranceDone, inView, reducedMotion, totalChars]);

  // Direct DOM pointer proximity reaction (zero re-renders, 60fps smooth swell)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const radius = 100;

    letterRefs.current.forEach((el) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dist = Math.hypot(mouseX - centerX, mouseY - centerY);

      if (dist < radius) {
        const influence = Math.pow(1 - dist / radius, 2);
        el.style.transform = `scale(${1 + influence * 0.08})`;
        el.style.color = influence > 0.4 ? "var(--text-primary)" : "";
      } else {
        el.style.transform = "scale(1)";
      }
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    letterRefs.current.forEach((el) => {
      if (el) {
        el.style.transform = "scale(1)";
      }
    });
  }, []);

  // If user prefers reduced motion, render clean static heading
  if (reducedMotion) {
    return (
      <Component
        ref={containerRef}
        className={`font-sans tracking-tight text-[var(--text-primary)] ${className}`}
        style={{
          fontVariationSettings: "'wdth' 100, 'wght' 700",
        }}
      >
        {text}
      </Component>
    );
  }

  let charGlobalIndex = 0;

  return (
    <Component
      ref={containerRef}
      aria-label={text}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`font-sans tracking-tight select-none ${className}`}
    >
      {words.map((wordChars, wordIndex) => {
        return (
          <span
            key={`word-${wordIndex}`}
            className="inline-block whitespace-nowrap mr-[0.28em] last:mr-0"
            aria-hidden="true"
          >
            {wordChars.map((char) => {
              const index = charGlobalIndex++;

              // Calculate wave influence without touching refs
              let waveInfluence = 0;
              if (wavePos !== null) {
                const distFromWave = Math.abs(index - wavePos);
                if (distFromWave < 3.2) {
                  waveInfluence = Math.cos((distFromWave / 3.2) * (Math.PI / 2));
                }
              }

              const baseWeight = 600;
              const baseWidth = 92;

              const targetWeight = Math.min(
                800,
                baseWeight + waveInfluence * 180
              );
              const targetWidth = Math.min(
                100,
                baseWidth + waveInfluence * 8
              );

              const entranceDelay = `${index * 24}ms`;

              return (
                <span
                  key={`char-${index}`}
                  ref={(el) => {
                    letterRefs.current[index] = el;
                  }}
                  className="inline-block transition-[font-variation-settings] duration-150 ease-out text-[var(--text-primary)]"
                  style={{
                    fontVariationSettings: `'wdth' ${targetWidth}, 'wght' ${Math.round(targetWeight)}`,
                    animation: !entranceDone
                      ? `kinetic-entrance 600ms cubic-bezier(0.16, 1, 0.3, 1) ${entranceDelay} backwards`
                      : undefined,
                  }}
                >
                  {char}
                </span>
              );
            })}
          </span>
        );
      })}

      <style jsx>{`
        @keyframes kinetic-entrance {
          from {
            opacity: 0;
            transform: translateY(12px);
            font-variation-settings: 'wdth' 75, 'wght' 200;
          }
          to {
            opacity: 1;
            transform: translateY(0);
            font-variation-settings: 'wdth' 92, 'wght' 600;
          }
        }
      `}</style>
    </Component>
  );
}
