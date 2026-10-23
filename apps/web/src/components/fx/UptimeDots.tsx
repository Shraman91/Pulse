"use client";

import React, { useState, useId, useMemo, useSyncExternalStore } from "react";
import { RollupPoint } from "@/lib/api";

export interface UptimeDotsProps {
  points?: RollupPoint[];
  days?: number;
  className?: string;
  showSummary?: boolean;
  anchorDate?: string | Date;
}

interface DayStats {
  date: Date;
  dateKey: string;
  formattedDate: string;
  isToday: boolean;
  hasData: boolean;
  totalChecks: number;
  totalFailures: number;
  uptimePct: number | null;
  avgLatencyMs: number;
}

let cachedClientDate = "2026-10-23T12:00:00Z";

function getClientDateSnapshot(): string {
  if (typeof window === "undefined") return "2026-10-23T12:00:00Z";
  if (cachedClientDate === "2026-10-23T12:00:00Z") {
    cachedClientDate = new Date().toISOString();
  }
  return cachedClientDate;
}

function subscribeDate() {
  return () => {};
}

export function UptimeDots({
  points = [],
  days = 30,
  className = "",
  showSummary = true,
  anchorDate,
}: UptimeDotsProps) {
  const [hoveredDay, setHoveredDay] = useState<DayStats | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const componentId = useId();

  const clientDateIso = useSyncExternalStore(
    subscribeDate,
    getClientDateSnapshot,
    () => "2026-10-23T12:00:00Z"
  );

  // Aggregate hourly rollup points into daily stats
  const dayStatsList: DayStats[] = useMemo(() => {
    // Map points by dateKey (YYYY-MM-DD)
    const pointsByDate = new Map<string, RollupPoint[]>();
    let latestHourInPoints = "";

    for (const p of points) {
      if (!p.hour) continue;
      if (p.hour > latestHourInPoints) {
        latestHourInPoints = p.hour;
      }
      const key = p.hour.slice(0, 10);
      const list = pointsByDate.get(key) || [];
      list.push(p);
      pointsByDate.set(key, list);
    }

    const list: DayStats[] = [];

    // Derive anchor date: explicit prop > latest point hour > SSR-safe client date
    const today = anchorDate
      ? new Date(anchorDate)
      : latestHourInPoints
      ? new Date(latestHourInPoints)
      : new Date(clientDateIso);

    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - (days - 1 - i));
      const dateKey = d.toISOString().slice(0, 10);
      const dayPoints = pointsByDate.get(dateKey) || [];

      let totalChecks = 0;
      let totalFailures = 0;
      let latencySum = 0;
      let latencyChecks = 0;

      for (const pt of dayPoints) {
        totalChecks += pt.checks || 0;
        totalFailures += pt.failures || 0;
        if (pt.checks > 0 && pt.avgLatencyMs > 0) {
          latencySum += pt.avgLatencyMs * pt.checks;
          latencyChecks += pt.checks;
        }
      }

      const hasData = totalChecks > 0;
      const uptimePct = hasData
        ? Math.max(0, ((totalChecks - totalFailures) / totalChecks) * 100)
        : null;
      const avgLatencyMs =
        latencyChecks > 0 ? Math.round(latencySum / latencyChecks) : 0;

      const formattedDate = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        weekday: "short",
      });

      list.push({
        date: d,
        dateKey,
        formattedDate,
        isToday: i === days - 1,
        hasData,
        totalChecks,
        totalFailures,
        uptimePct,
        avgLatencyMs,
      });
    }

    return list;
  }, [points, days, anchorDate, clientDateIso]);

  // Overall 30-day uptime summary
  const summary = useMemo(() => {
    let totalChecks = 0;
    let totalFailures = 0;
    for (const d of dayStatsList) {
      totalChecks += d.totalChecks;
      totalFailures += d.totalFailures;
    }
    if (totalChecks === 0) return null;
    const pct = Math.max(0, ((totalChecks - totalFailures) / totalChecks) * 100);
    return {
      uptimePct: pct,
      totalChecks,
      totalFailures,
    };
  }, [dayStatsList]);

  // SVG dimensions
  const dotSpacing = 20;
  const maxRadius = 6.5;
  const minRadius = 2.5;
  const svgWidth = days * dotSpacing;
  const svgHeight = 28;

  return (
    <div className={`relative space-y-2 select-none ${className}`}>
      {/* Header labels */}
      {showSummary && (
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span className="font-mono">{days} days ago</span>
          {summary ? (
            <span className="font-semibold text-[var(--text-primary)]">
              {summary.uptimePct.toFixed(2)}% uptime
              {summary.totalFailures > 0 && (
                <span className="ml-1.5 text-[var(--status-down)]">
                  ({summary.totalFailures} failed)
                </span>
              )}
            </span>
          ) : (
            <span className="text-[var(--text-secondary)] italic">
              No checks recorded
            </span>
          )}
          <span className="font-mono">Today</span>
        </div>
      )}

      {/* Interactive SVG dots */}
      <div className="relative overflow-visible">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible"
          role="group"
          aria-label={`${days}-day uptime history${
            summary ? `: ${summary.uptimePct.toFixed(2)}% uptime` : ""
          }`}
        >
          {dayStatsList.map((day, idx) => {
            const cx = idx * dotSpacing + dotSpacing / 2;
            const cy = svgHeight / 2;

            let radius = 2.0;
            let fillColor = "transparent";
            let strokeColor = "var(--border-subtle)";
            const strokeWidth = 1.0;

            if (day.hasData && day.uptimePct !== null) {
              radius =
                minRadius + (maxRadius - minRadius) * (day.uptimePct / 100);

              if (day.totalFailures > 0) {
                fillColor = "var(--status-down)";
                strokeColor = "var(--status-down)";
              } else if (day.isToday) {
                fillColor = "var(--accent-hint)";
                strokeColor = "var(--accent-hint)";
              } else {
                fillColor = "var(--status-up)";
                strokeColor = "var(--status-up)";
              }
            }

            const isHovered = hoveredDay?.dateKey === day.dateKey;

            return (
              <g
                key={`${componentId}-${day.dateKey}`}
                tabIndex={0}
                role="button"
                aria-label={`${day.formattedDate}: ${
                  day.hasData && day.uptimePct !== null
                    ? `${day.uptimePct.toFixed(1)}% uptime, ${
                        day.totalFailures > 0
                          ? `${day.totalFailures} failures`
                          : "100% operational"
                      }`
                    : "No data recorded"
                }`}
                className="outline-none cursor-pointer group focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredDay(day);
                  setTooltipPos({
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  });
                }}
                onMouseLeave={() => setHoveredDay(null)}
                onFocus={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredDay(day);
                  setTooltipPos({
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  });
                }}
                onBlur={() => setHoveredDay(null)}
              >
                {/* Hit target */}
                <rect
                  x={idx * dotSpacing}
                  y={0}
                  width={dotSpacing}
                  height={svgHeight}
                  fill="transparent"
                />

                {/* Today's indicator outer ring */}
                {day.isToday && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={maxRadius + 3.0}
                    fill="none"
                    stroke="var(--accent-hint)"
                    strokeWidth={1.2}
                    strokeDasharray="2 2"
                    className="opacity-80 animate-pulse"
                  />
                )}

                {/* Main dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? radius + 1.2 : radius}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  className="transition-all duration-150 ease-out"
                />
              </g>
            );
          })}
        </svg>

        {/* Hover / Focus Tooltip */}
        {hoveredDay && tooltipPos && (
          <div
            className="fixed z-50 -translate-x-1/2 -translate-y-full mb-2 pointer-events-none px-3 py-2 rounded-lg bg-[var(--aubergine-900)] text-[var(--silver-50)] text-xs shadow-xl border border-[var(--silver-600)]/30 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y - 8,
            }}
          >
            <div className="font-semibold text-xs flex items-center justify-between gap-3">
              <span>{hoveredDay.formattedDate}</span>
              {hoveredDay.isToday && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--accent-hint)] text-[var(--aubergine-900)] font-bold">
                  Today
                </span>
              )}
            </div>

            {hoveredDay.hasData && hoveredDay.uptimePct !== null ? (
              <div className="mt-1 space-y-0.5 text-[11px] text-[var(--silver-200)]">
                <div className="flex justify-between gap-4">
                  <span>Uptime:</span>
                  <span
                    className={`font-semibold ${
                      hoveredDay.totalFailures > 0
                        ? "text-red-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {hoveredDay.uptimePct.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Checks:</span>
                  <span className="font-mono">
                    {hoveredDay.totalChecks - hoveredDay.totalFailures} /{" "}
                    {hoveredDay.totalChecks}
                  </span>
                </div>
                {hoveredDay.avgLatencyMs > 0 && (
                  <div className="flex justify-between gap-4">
                    <span>Avg latency:</span>
                    <span className="font-mono">
                      {hoveredDay.avgLatencyMs} ms
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1 text-[11px] text-[var(--silver-400)] italic">
                No checks recorded
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
