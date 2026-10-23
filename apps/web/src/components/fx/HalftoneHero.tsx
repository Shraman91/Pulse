"use client";

import React, {
  useEffect,
  useRef,
  useSyncExternalStore,
  useCallback,
} from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";
import { useTheme } from "@/context/ThemeContext";

interface HalftoneHeroProps {
  className?: string;
}

function checkWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl") ||
        canvas.getContext("webgl2"))
    );
  } catch {
    return false;
  }
}

function getWebGLSnapshot(): boolean {
  return checkWebGLSupport();
}

function subscribeNoop() {
  return () => {};
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

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform float uTheme; // 0.0 = light, 1.0 = dark

varying vec2 vUv;

void main() {
  vec2 pixelCoord = gl_FragCoord.xy;

  // Dot spacing: 22px
  float dotSpacing = 22.0;
  vec2 gridCoord = pixelCoord / dotSpacing;
  vec2 cellCoord = fract(gridCoord) - 0.5;
  vec2 cellCenter = (floor(gridCoord) + 0.5) * dotSpacing;

  // Distance from center of current dot
  float distToCenter = length(cellCoord);

  // Organic, slow-moving field wave (3 sinusoids)
  float wave1 = sin(cellCenter.x * 0.0035 + uTime * 0.40);
  float wave2 = cos(cellCenter.y * 0.0045 - uTime * 0.30);
  float wave3 = sin((cellCenter.x + cellCenter.y) * 0.0025 + uTime * 0.20);
  float field = 0.5 + 0.25 * wave1 + 0.15 * wave2 + 0.10 * wave3;

  // Base dot radius in cell units (0 to 0.5 max)
  float baseRadius = 0.07 + 0.15 * field;

  // Cursor proximity
  float mouseDist = distance(cellCenter, uMouse);
  float mouseRadius = 170.0;
  float mouseInfluence = 0.0;
  if (uMouseActive > 0.01 && mouseDist < mouseRadius) {
    float normDist = mouseDist / mouseRadius;
    mouseInfluence = (1.0 - normDist * normDist) * uMouseActive;
  }

  // Dynamic radius under cursor
  float targetRadius = min(0.44, baseRadius + mouseInfluence * 0.18);

  // Antialiased edge
  float delta = 0.035;
  float circle = 1.0 - smoothstep(targetRadius - delta, targetRadius + delta, distToCenter);

  if (circle < 0.01) {
    discard;
  }

  // Palette colors:
  // Light mode base: Aubergine ink / silver tone
  vec3 lightBaseColor = vec3(0.227, 0.082, 0.251); // aubergine-700
  vec3 lightMarigold = vec3(0.957, 0.663, 0.075);  // marigold-500

  // Dark mode base: Silver tone
  vec3 darkBaseColor = vec3(0.541, 0.565, 0.600);  // silver-600
  vec3 darkMarigold = vec3(1.0, 0.788, 0.302);   // marigold-300

  vec3 baseColor = mix(lightBaseColor, darkBaseColor, uTheme);
  vec3 highlightColor = mix(lightMarigold, darkMarigold, uTheme);

  // Interpolate towards marigold near cursor
  vec3 dotColor = mix(baseColor, highlightColor, mouseInfluence * 0.90);

  // Alpha modulation
  float baseAlpha = mix(0.12 + 0.10 * field, 0.18 + 0.12 * field, uTheme);
  float alpha = baseAlpha + mouseInfluence * 0.50;

  gl_FragColor = vec4(dotColor, circle * alpha);
}
`;

export function HalftoneHero({ className = "" }: HalftoneHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);

  const [hasWebGLError, setHasWebGLError] = React.useState(false);

  useEffect(() => {
    themeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  const triggerFallback = useCallback(() => {
    queueMicrotask(() => {
      setHasWebGLError(true);
    });
  }, []);

  const isWebGLAvailable = useSyncExternalStore(
    subscribeNoop,
    getWebGLSnapshot,
    () => false
  );

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );

  const isTabActiveRef = useRef<boolean>(true);
  const inViewRef = useRef<boolean>(true);
  const mouseStateRef = useRef<{ x: number; y: number; active: number }>({
    x: -9999,
    y: -9999,
    active: 0,
  });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // WebGL has origin at bottom-left, DOM at top-left
    mouseStateRef.current = {
      x: clientX,
      y: rect.height - clientY,
      active: 1.0,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseStateRef.current.active = 0.0;
  }, []);

  useEffect(() => {
    if (!isWebGLAvailable || reducedMotion || hasWebGLError) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let renderer: Renderer | null = null;
    let frameId: number | null = null;
    let isCancelled = false;

    try {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      renderer = new Renderer({
        canvas,
        alpha: true,
        antialias: true,
        dpr,
      });

      const gl = renderer.gl;
      if (!gl) {
        triggerFallback();
        return;
      }

      const geometry = new Triangle(gl);

      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;

      const program = new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: [width * dpr, height * dpr] },
          uMouse: { value: [-9999, -9999] },
          uMouseActive: { value: 0 },
          uTheme: { value: themeRef.current === "dark" ? 1.0 : 0.0 },
        },
        transparent: true,
        depthTest: false,
      });

      // If shader linking failed, gracefully fall back
      if (!program.uniformLocations) {
        triggerFallback();
        return;
      }

      const mesh = new Mesh(gl, { geometry, program });

      const handleResize = () => {
        if (!container || !renderer || isCancelled) return;
        const w = container.clientWidth || 800;
        const h = container.clientHeight || 600;
        const currentDpr = Math.min(2, window.devicePixelRatio || 1);
        renderer.dpr = currentDpr;
        renderer.setSize(w, h);
        if (program.uniforms.uResolution) {
          program.uniforms.uResolution.value = [w * currentDpr, h * currentDpr];
        }
      };

      handleResize();

      const resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(container);

      const intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          inViewRef.current = entry.isIntersecting;
        },
        { threshold: 0.05 }
      );
      intersectionObserver.observe(container);

      const handleVisibility = () => {
        isTabActiveRef.current = !document.hidden;
      };
      document.addEventListener("visibilitychange", handleVisibility);

      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", handleMouseLeave);

      const startTime = performance.now();
      let currentMouseActive = 0;

      const render = (now: number) => {
        if (isCancelled) return;

        if (inViewRef.current && isTabActiveRef.current && renderer) {
          try {
            const elapsed = (now - startTime) / 1000;
            program.uniforms.uTime.value = elapsed;

            // Smoothly ease mouseActive uniform
            const targetActive = mouseStateRef.current.active;
            currentMouseActive += (targetActive - currentMouseActive) * 0.15;
            program.uniforms.uMouseActive.value = currentMouseActive;

            // Scale mouse coords to canvas pixel space
            const currentDpr = renderer.dpr || 1;
            program.uniforms.uMouse.value = [
              mouseStateRef.current.x * currentDpr,
              mouseStateRef.current.y * currentDpr,
            ];

            // Update theme uniform from ref without restarting effect
            program.uniforms.uTheme.value = themeRef.current === "dark" ? 1.0 : 0.0;

            renderer.render({ scene: mesh });
          } catch (renderErr) {
            console.warn("[HalftoneHero] Render loop caught error, activating CSS fallback:", renderErr);
            isCancelled = true;
            triggerFallback();
            return;
          }
        }

        frameId = requestAnimationFrame(render);
      };

      frameId = requestAnimationFrame(render);

      return () => {
        isCancelled = true;
        if (frameId !== null) {
          cancelAnimationFrame(frameId);
        }
        resizeObserver.disconnect();
        intersectionObserver.disconnect();
        document.removeEventListener("visibilitychange", handleVisibility);
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("mouseleave", handleMouseLeave);
      };
    } catch (initErr) {
      console.warn("[HalftoneHero] WebGL initialization failed, activating CSS fallback:", initErr);
      triggerFallback();
    }
  }, [
    isWebGLAvailable,
    reducedMotion,
    hasWebGLError,
    handleMouseMove,
    handleMouseLeave,
    triggerFallback,
  ]);

  // CSS Fallback when WebGL is unsupported, reduced-motion is requested, or WebGL encounters an error
  if (!isWebGLAvailable || reducedMotion || hasWebGLError) {
    return (
      <div
        className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
        aria-hidden="true"
      >
        <div
          className="w-full h-full opacity-35"
          style={{
            backgroundImage:
              "radial-gradient(var(--border-subtle) 1.25px, transparent 1.25px)",
            backgroundSize: "22px 22px",
          }}
        />
      </div>
    );
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

