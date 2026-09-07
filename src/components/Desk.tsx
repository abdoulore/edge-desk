"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeskStatus } from "@/lib/types";

function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function fmtCountdown(expiry: number): string {
  if (!expiry) return "—";
  const left = Math.max(0, Math.floor(expiry - Date.now() / 1000));
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Desk() {
  const [status, setStatus] = useState<DeskStatus | null>(null);
  const [busy, setBusy] = useState<"copy" | "claim" | "tick" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      const json = (await res.json()) as DeskStatus;
      setStatus(json);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Status fetch failed");
    }
  }, []);

  const tick = useCallback(async () => {
    setBusy("tick");
    try {
      await fetch("/api/agent/tick", { method: "POST" });
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Tick failed");
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  useEffect(() => {
    void tick();
    const poll = setInterval(() => {
      void tick();
    }, 8000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [tick]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const signal = status?.signal;
  const edgeColor = useMemo(() => {
    if (!signal?.edge) return "text-desk-muted";
    if (Math.abs(signal.edge) >= signal.edgeThreshold) return "text-desk-accent";
    return "text-desk-warn";
  }, [signal]);

  async function onCopy() {
    setBusy("copy");
    try {
      const res = await fetch("/api/copy", { method: "POST" });
      const json = (await res.json()) as { ok: boolean; message: string };
      setToast(json.message);
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setBusy(null);
    }
  }

  async function onClaim(marketId?: string) {
    const id = marketId || status?.claimable?.[0]?.marketId;
    if (!id) {
      setToast("Nothing claimable yet");
      return;
    }
    setBusy("claim");
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: id }),
      });
      const json = (await res.json()) as { ok: boolean; message: string };
      setToast(json.message);
      await refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setBusy(null);
    }
  }

  const cadence =
    signal?.intervalSec != null
      ? `${Math.round(signal.intervalSec / 60)}m`
      : "—";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 px-4 py-5 pb-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-desk-muted">
            Somnia × DreamDEX
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Edge Desk</h1>
        </div>
        <div className="rounded-full border border-desk-border bg-desk-panel px-3 py-1 text-xs text-desk-muted">
          <span className="live-dot mr-1.5 inline-block h-2 w-2 rounded-full bg-desk-accent" />
          {status?.dryRun ? "DRY RUN" : "LIVE"} · {status?.network || "…"}
        </div>
      </header>

      <section className="rounded-2xl border border-desk-border bg-desk-panel p-4 shadow-lg shadow-black/30">
        <div className="mb-3 flex items-center justify-between text-sm text-desk-muted">
          <span>
            {signal?.asset || "BTC"} · {cadence} window
          </span>
          <span className="font-mono" suppressHydrationWarning>
            {signal?.expiry ? fmtCountdown(signal.expiry) : "—"} left
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Metric label="Up %" value={fmtPct(signal?.upMid)} accent />
          <Metric
            label="Edge"
            value={
              signal?.edge == null
                ? "—"
                : `${signal.edge >= 0 ? "+" : ""}${fmtPct(signal.edge)}`
            }
            className={edgeColor}
          />
          <Metric label="Spot" value={fmtNum(signal?.spot, 2)} />
          <Metric label="Reference" value={fmtNum(signal?.reference, 2)} />
        </div>

        <div className="mt-4 rounded-xl border border-desk-border/80 bg-black/20 px-3 py-3">
          <p className="mb-1 text-[11px] uppercase tracking-wider text-desk-muted">
            Why
          </p>
          <p className="text-sm leading-relaxed text-zinc-100">
            {signal?.reason || "Waiting for first agent tick…"}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-desk-muted">
          <Badge>{signal?.status || "—"}</Badge>
          {signal?.recommendedSide && (
            <Badge tone={signal.recommendedSide === "Up" ? "up" : "down"}>
              Signal {signal.recommendedSide}
            </Badge>
          )}
          {signal?.lastTrade && (
            <Badge>
              Last {signal.lastTrade.side}
              {signal.lastTrade.dryRun ? " (dry)" : ""}
            </Badge>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => void onCopy()}
          disabled={busy !== null}
          className="rounded-2xl bg-desk-accent px-4 py-3.5 text-sm font-semibold text-black transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy === "copy" ? "Copying…" : "Copy last trade"}
        </button>
        <button
          type="button"
          onClick={() => void onClaim()}
          disabled={busy !== null}
          className="rounded-2xl border border-desk-border bg-desk-panel px-4 py-3.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy === "claim" ? "Claiming…" : "Claim"}
        </button>
      </section>

      {signal?.oracleGraphUrl && (
        <a
          href={signal.oracleGraphUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-desk-border bg-desk-panel px-4 py-3 text-center text-sm text-desk-accent underline-offset-2 hover:underline"
        >
          Oracle resolution graph ↗
        </a>
      )}

      {status?.claimable && status.claimable.length > 0 && (
        <section className="rounded-2xl border border-desk-border bg-desk-panel p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-desk-muted">
            Claimable
          </p>
          <ul className="space-y-2">
            {status.claimable.map((c) => (
              <li
                key={c.marketId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div>
                  <p>
                    {c.asset} · {c.status}
                  </p>
                  <p className="font-mono text-xs text-desk-muted">
                    {c.marketId.slice(0, 10)}…
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs"
                  onClick={() => void onClaim(c.marketId)}
                >
                  Claim
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-auto space-y-1 pt-2 text-center text-[11px] text-desk-muted">
        <p>
          Threshold {fmtPct(signal?.edgeThreshold ?? 0.05, 0)} · size{" "}
          {signal?.copySize ?? 1} · tick {busy === "tick" ? "…" : "ok"}
        </p>
        <p suppressHydrationWarning>
          Updated {signal?.updatedAt ? new Date(signal.updatedAt).toLocaleTimeString() : "—"} ·{" "}
          {new Date(now).toLocaleTimeString()}
        </p>
        {status?.wallet && (
          <p className="font-mono">
            {status.wallet.slice(0, 6)}…{status.wallet.slice(-4)}
          </p>
        )}
        {signal?.error && <p className="text-desk-down">{signal.error}</p>}
      </footer>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 rounded-xl border border-desk-border bg-zinc-900 px-4 py-3 text-center text-sm shadow-xl">
          {toast}
        </div>
      )}
    </main>
  );
}

function Metric({
  label,
  value,
  accent,
  className = "",
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className="rounded-xl border border-desk-border/70 bg-black/25 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-desk-muted">
        {label}
      </p>
      <p
        className={`mt-0.5 font-mono text-xl font-semibold ${
          accent ? "text-desk-accent" : ""
        } ${className}`}
      >
        {value}
      </p>
    </div>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "up" | "down";
}) {
  const colors =
    tone === "up"
      ? "border-desk-accent/40 text-desk-accent"
      : tone === "down"
        ? "border-desk-down/40 text-desk-down"
        : "border-desk-border text-desk-muted";
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 font-medium ${colors}`}
    >
      {children}
    </span>
  );
}
