"use client";

import React, { useSyncExternalStore } from "react";

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeReducedMotion(callback: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );

  return (
    <div
      className={`rounded bg-[var(--silver-400)]/30 dark:bg-[var(--silver-600)]/20 ${
        reducedMotion ? "" : "animate-pulse"
      } ${className}`}
      aria-hidden="true"
    />
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full space-y-3">
      {/* Table header */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-panel)]"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-3 h-3 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36 sm:w-48" />
              <Skeleton className="h-3 w-48 sm:w-64" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-16 rounded-md hidden sm:block" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
