"use client";

import type { ReactNode } from "react";

export function Metric({
  label,
  value,
  accent,
  className = "",
  sub,
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-desk-border/70 bg-black/25 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-desk-muted">
        {label}
      </p>
      <p
        className={`mt-0.5 font-mono text-xl font-semibold tabular-nums ${
          accent ? "text-desk-accent" : ""
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
      ? "border-desk-accent/40 text-desk-accent bg-desk-accent/5"
      : tone === "down"
        ? "border-desk-down/40 text-desk-down bg-desk-down/5"
        : tone === "cyan"
          ? "border-desk-cyan/40 text-desk-cyan bg-desk-cyan/5"
          : tone === "warn"
            ? "border-desk-warn/40 text-desk-warn bg-desk-warn/5"
            : "border-desk-border text-desk-muted";
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
      className={`rounded-2xl border border-desk-border bg-desk-panel p-4 shadow-lg shadow-black/20 ${className}`}
    >
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? (
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-desk-muted">
              {title}
            </h2>
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

export function StateBlock({
  kind,
  title,
  detail,
}: {
  kind: "loading" | "empty" | "error";
  title: string;
  detail?: string;
}) {
  const tone =
    kind === "error"
      ? "border-desk-down/30 text-desk-down"
      : kind === "loading"
        ? "border-desk-cyan/20 text-desk-cyan"
        : "border-desk-border text-desk-muted";
  return (
    <div
      className={`rounded-2xl border border-dashed ${tone} bg-desk-panel/50 px-5 py-10 text-center`}
    >
      <p className="text-sm font-medium">{title}</p>
      {detail && <p className="mt-1 text-xs text-desk-muted">{detail}</p>}
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 rounded-xl border border-desk-border bg-zinc-900/95 px-4 py-3 text-center text-sm shadow-xl backdrop-blur">
      {message}
    </div>
  );
}
