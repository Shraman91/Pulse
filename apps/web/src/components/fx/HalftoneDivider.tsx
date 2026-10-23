import React from "react";

interface HalftoneDividerProps {
  className?: string;
  height?: string;
  fade?: "top" | "bottom" | "both";
  spacing?: number;
  dotSize?: number;
  hasBorder?: boolean;
}

export function HalftoneDivider({
  className = "",
  height = "h-16",
  fade = "both",
  spacing = 18,
  dotSize = 1.25,
  hasBorder = false,
}: HalftoneDividerProps) {
  let maskStyle: string;

  switch (fade) {
    case "top":
      maskStyle =
        "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,1) 100%)";
      break;
    case "bottom":
      maskStyle =
        "linear-gradient(to bottom, rgba(0,0,0,1) 0%, transparent 100%)";
      break;
    case "both":
    default:
      maskStyle =
        "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,1) 35%, rgba(0,0,0,1) 65%, transparent 100%)";
      break;
  }

  return (
    <div
      className={`relative w-full overflow-hidden select-none pointer-events-none ${height} ${className}`}
      aria-hidden="true"
    >
      <div
        className="w-full h-full opacity-60 dark:opacity-40"
        style={{
          backgroundImage: `radial-gradient(var(--border-subtle) ${dotSize}px, transparent ${dotSize}px)`,
          backgroundSize: `${spacing}px ${spacing}px`,
          WebkitMaskImage: maskStyle,
          maskImage: maskStyle,
        }}
      />
      {hasBorder && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-[var(--border-subtle)]/40" />
      )}
    </div>
  );
}
