"use client";

import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useSyncExternalStore,
  useCallback,
} from "react";

export interface ParticleFieldHandle {
  pulse: (x?: number, y?: number) => void;
}

interface ParticleFieldProps {
  className?: string;
  particleCount?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseRadius: number;
  radius: number;
  isMarigold: boolean;
  alpha: number;
  pulseHighlight: number; // 0 to 1 when wave crest hits
}

interface Ripple {
  x: number;
  y: number;
  currentRadius: number;
  maxRadius: number;
  speed: number;
  strength: number;
  done: boolean;
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

export const ParticleField = forwardRef<ParticleFieldHandle, ParticleFieldProps>(
  function ParticleField({ className = "", particleCount }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const reducedMotion = useSyncExternalStore(
      subscribeReducedMotion,
      getReducedMotionSnapshot,
      () => false
    );

    const ripplesRef = useRef<Ripple[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const mousePosRef = useRef<{ x: number; y: number } | null>(null);
    const inViewRef = useRef<boolean>(true);
    const isTabActiveRef = useRef<boolean>(true);
    const frameIdRef = useRef<number | null>(null);

    // Expose imperative pulse(x, y)
    const triggerPulse = useCallback((x?: number, y?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const originX = x !== undefined ? x : rect.width / 2;
      const originY = y !== undefined ? y : rect.height / 2;

      ripplesRef.current.push({
        x: originX,
        y: originY,
        currentRadius: 0,
        maxRadius: Math.max(rect.width, rect.height) * 0.75,
        speed: 280, // px per second
        strength: 1.0,
        done: false,
      });
    }, []);

    useImperativeHandle(ref, () => ({
      pulse: triggerPulse,
    }));

    // Mouse tracking
    const handleMouseMove = useCallback((e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }, []);

    const handleMouseLeave = useCallback(() => {
      mousePosRef.current = null;
    }, []);

    useEffect(() => {
      if (reducedMotion) return;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) return;

      let width = container.clientWidth;
      let height = container.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);

      const resize = () => {
        if (!container || !canvas) return;
        width = container.clientWidth;
        height = container.clientHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);
      };

      resize();

      // Determine particle count (desktop ~90, mobile ~40)
      const isMobile = width < 768;
      const count = particleCount ?? (isMobile ? 40 : 90);

      // Initialize particles
      particlesRef.current = Array.from({ length: count }, () => {
        const isMarigold = Math.random() < 0.083; // roughly 1 in 12
        const baseRadius = isMarigold
          ? Math.random() * 0.8 + 2.0
          : Math.random() * 0.9 + 1.2;

        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          baseRadius,
          radius: baseRadius,
          isMarigold,
          alpha: isMarigold ? 0.85 : Math.random() * 0.35 + 0.35,
          pulseHighlight: 0,
        };
      });

      // ResizeObserver
      const resizeObserver = new ResizeObserver(() => {
        resize();
      });
      resizeObserver.observe(container);

      // IntersectionObserver for off-screen pause
      const intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          inViewRef.current = entry.isIntersecting;
        },
        { threshold: 0.05 }
      );
      intersectionObserver.observe(container);

      // Visibility change for tab hidden pause
      const handleVisibilityChange = () => {
        isTabActiveRef.current = !document.hidden;
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      // Mouse events
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", handleMouseLeave);

      // Colors from theme or defaults
      const silverColor = "#B4B9C0";
      const marigoldColor = "#F4A913";

      let lastTime = performance.now();

      // Main Animation Loop
      const render = (time: number) => {
        const dt = Math.min(64, time - lastTime) / 1000;
        lastTime = time;

        if (inViewRef.current && isTabActiveRef.current) {
          ctx.clearRect(0, 0, width, height);

          // Update active ripples
          const ripples = ripplesRef.current;
          for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i];
            r.currentRadius += r.speed * dt;
            r.strength = Math.max(0, 1 - r.currentRadius / r.maxRadius);

            if (r.currentRadius >= r.maxRadius || r.strength <= 0) {
              ripples.splice(i, 1);
            }
          }

          const particles = particlesRef.current;
          const mouse = mousePosRef.current;
          const mouseRadius = 110;

          // Update & draw particles
          for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            // Natural slow drift
            p.x += p.vx * 60 * dt;
            p.y += p.vy * 60 * dt;

            // Bounce gently off canvas borders
            if (p.x < 0) {
              p.x = 0;
              p.vx *= -1;
            } else if (p.x > width) {
              p.x = width;
              p.vx *= -1;
            }
            if (p.y < 0) {
              p.y = 0;
              p.vy *= -1;
            } else if (p.y > height) {
              p.y = height;
              p.vy *= -1;
            }

            // Mouse repulsion with smooth easing
            if (mouse) {
              const dx = p.x - mouse.x;
              const dy = p.y - mouse.y;
              const dist = Math.hypot(dx, dy);

              if (dist < mouseRadius && dist > 0.001) {
                const force = Math.pow(1 - dist / mouseRadius, 2) * 3.5;
                const angle = Math.atan2(dy, dx);
                p.x += Math.cos(angle) * force;
                p.y += Math.sin(angle) * force;
              }
            }

            // Ripple interaction
            p.pulseHighlight = 0;
            for (let rIdx = 0; rIdx < ripples.length; rIdx++) {
              const r = ripples[rIdx];
              const distToRipple = Math.hypot(p.x - r.x, p.y - r.y);
              const diff = Math.abs(distToRipple - r.currentRadius);
              const waveThickness = 45;

              if (diff < waveThickness) {
                const waveFactor = (1 - diff / waveThickness) * r.strength;
                p.pulseHighlight = Math.max(p.pulseHighlight, waveFactor);

                // Nudge particle slightly outward along ripple ray
                const angle = Math.atan2(p.y - r.y, p.x - r.x);
                p.x += Math.cos(angle) * waveFactor * 1.8;
                p.y += Math.sin(angle) * waveFactor * 1.8;
              }
            }

            // Draw particle
            ctx.beginPath();
            const currentRadius = p.pulseHighlight > 0
              ? p.baseRadius + p.pulseHighlight * 1.5
              : p.baseRadius;

            ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);

            if (p.isMarigold || p.pulseHighlight > 0.3) {
              ctx.fillStyle = marigoldColor;
              ctx.globalAlpha = Math.min(1.0, p.alpha + p.pulseHighlight * 0.4);
            } else {
              ctx.fillStyle = silverColor;
              ctx.globalAlpha = p.alpha;
            }

            ctx.fill();
          }

          // Draw connecting proximity lines
          const maxLineDist = isMobile ? 65 : 85;
          ctx.lineWidth = 0.8;

          for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            for (let j = i + 1; j < particles.length; j++) {
              const p2 = particles[j];
              const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

              if (dist < maxLineDist) {
                const lineAlpha = (1 - dist / maxLineDist) * 0.22;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);

                if (p1.isMarigold || p2.isMarigold || p1.pulseHighlight > 0.4) {
                  ctx.strokeStyle = marigoldColor;
                  ctx.globalAlpha = lineAlpha * 1.4;
                } else {
                  ctx.strokeStyle = silverColor;
                  ctx.globalAlpha = lineAlpha;
                }

                ctx.stroke();
              }
            }
          }

          ctx.globalAlpha = 1.0;
        }

        frameIdRef.current = requestAnimationFrame(render);
      };

      frameIdRef.current = requestAnimationFrame(render);

      return () => {
        if (frameIdRef.current !== null) {
          cancelAnimationFrame(frameIdRef.current);
        }
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseleave", handleMouseLeave);
      };
    }, [particleCount, reducedMotion, handleMouseMove, handleMouseLeave]);

    // Respect prefers-reduced-motion by rendering nothing
    if (reducedMotion) {
      return null;
    }

    return (
      <div
        ref={containerRef}
        className={`absolute inset-0 pointer-events-auto overflow-hidden ${className}`}
        aria-hidden="true"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    );
  }
);
