import React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`p-10 sm:p-14 text-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-col items-center justify-center space-y-4 ${className}`}
    >
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-[var(--bg-page)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-center">
          {icon}
        </div>
      )}

      <div className="max-w-md space-y-1.5">
        <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          {description}
        </p>
      </div>

      {(actionLabel && (onAction || actionHref)) && (
        <div className="pt-2">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--aubergine-900)] text-[var(--silver-50)] text-xs font-semibold hover:bg-[var(--aubergine-700)] transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{actionLabel}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--aubergine-900)] text-[var(--silver-50)] text-xs font-semibold hover:bg-[var(--aubergine-700)] transition-colors shadow-sm focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] outline-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{actionLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
