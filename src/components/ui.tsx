"use client";

import type { ReactNode } from "react";
import {
  WarningCircle,
  CirclesThreePlus,
  Pulse,
} from "@phosphor-icons/react";

export function Metric({
  label,
  value,
  accent,
  className = "",
  sub,
  title,
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
  sub?: string;
  title?: string;
}) {
  return (
    <div
      className="rounded-desk-sm border border-desk-border/80 bg-black/25 px-3 py-2.5"
      title={title}
    >
      <p className="text-[11px] font-medium text-desk-muted">{label}</p>
      <p
        className={`mt-0.5 font-mono text-xl font-semibold tabular ${
          accent ? "text-desk-accent" : "text-desk-ink"
        } ${className}`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-desk-muted">{sub}</p>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "up" | "down" | "cyan" | "warn";
}) {
  const colors =
    tone === "up"
      ? "border-desk-accent/35 text-desk-accent bg-desk-accent/5"
      : tone === "down"
        ? "border-desk-down/35 text-desk-down bg-desk-down/5"
        : tone === "cyan"
          ? "border-desk-accent/25 text-desk-ink/80 bg-white/[0.04]"
          : tone === "warn"
            ? "border-desk-warn/35 text-desk-warn bg-desk-warn/5"
            : "border-desk-border text-desk-muted bg-transparent";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors}`}
    >
      {children}
    </span>
  );
}

export function Panel({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section
      className={`rounded-desk-lg border border-desk-border bg-desk-panel p-4 shadow-desk ${className}`}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? (
            <h2 className="text-sm font-medium text-desk-ink/90">{title}</h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function DeskSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" aria-busy>
      <div className="flex justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-7 w-48" />
        </div>
        <SkeletonBlock className="h-8 w-24" />
      </div>
      <div className="rounded-desk-lg border border-desk-border bg-desk-panel p-4">
        <div className="mb-3 flex justify-between">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-3 w-16" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-16 w-full" />
          ))}
        </div>
        <SkeletonBlock className="mt-4 h-24 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SkeletonBlock className="h-12 w-full" />
        <SkeletonBlock className="h-12 w-full" />
      </div>
    </div>
  );
}

export function StateBlock({
  kind,
  title,
  detail,
}: {
  kind: "loading" | "empty" | "error";
  title: string;
  detail?: string;
}) {
  if (kind === "loading") {
    return <DeskSkeleton />;
  }

  const Icon = kind === "error" ? WarningCircle : kind === "empty" ? CirclesThreePlus : Pulse;
  const tone =
    kind === "error"
      ? "border-desk-down/25 text-desk-down"
      : "border-desk-border text-desk-muted";

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-desk-lg border border-dashed ${tone} bg-desk-panel/40 px-5 py-12 text-center`}
    >
      <Icon size={28} weight="duotone" className="mb-3 opacity-70" />
      <p className="text-sm font-medium text-desk-ink">{title}</p>
      {detail && <p className="mt-1 max-w-sm text-xs text-desk-muted">{detail}</p>}
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 rounded-desk border border-desk-border bg-desk-elevated/95 px-4 py-3 text-center text-sm shadow-desk backdrop-blur"
    >
      {message}
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  action,
}: {
  kicker?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker && (
          <p className="text-[11px] font-medium text-desk-muted">{kicker}</p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
  type = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  type?: "button" | "submit";
  title?: string;
}) {
  const styles =
    variant === "primary"
      ? "bg-desk-accent text-black shadow-desk-accent hover:bg-desk-accent/90"
      : variant === "secondary"
        ? "border border-desk-border bg-desk-panel text-desk-ink hover:border-desk-accent/35 hover:text-desk-accent"
        : "border border-desk-border bg-transparent text-desk-muted hover:text-desk-ink";
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-desk px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
