"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDeskStatus } from "@/hooks/useDeskStatus";
import { Badge, Metric, Panel, StateBlock, Toast } from "@/components/ui";
import {
  fmtCountdown,
  fmtInterval,
  fmtNum,
  fmtPct,
  fmtTime,
  shortHash,
} from "@/lib/format";
import { explorerTxUrl } from "@/lib/types";

export default function Desk() {
  const search = useSearchParams();
  const focusMarket = search.get("market");
  const { status, loading, error, busy, copy, claim, tick } = useDeskStatus({
    autoTick: true,
    pollMs: 8000,
  });
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

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
    const res = await copy();
    setToast(res.message);
  }

  async function onClaim(marketId?: string) {
    const res = await claim(marketId);
    setToast(res.message);
  }

  if (loading && !status) {
    return <StateBlock kind="loading" title="Connecting to desk…" detail="Fetching /api/status" />;
  }

  if (error && !status) {
    return (
      <StateBlock
        kind="error"
        title="Desk offline"
        detail={error}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-desk-muted">
            Trading desk
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {signal?.asset || "—"} · {fmtInterval(signal?.intervalSec)} window
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void tick()}
          disabled={busy !== null}
          className="rounded-lg border border-desk-border bg-desk-panel px-3 py-1.5 text-xs text-desk-muted transition hover:text-white disabled:opacity-50"
        >
          {busy === "tick" ? "Ticking…" : "Force tick"}
        </button>
      </div>

      {focusMarket && signal?.marketId && focusMarket.toLowerCase() !== signal.marketId.toLowerCase() && (
        <p className="rounded-xl border border-desk-warn/30 bg-desk-warn/5 px-3 py-2 text-xs text-desk-warn">
          Focused market {focusMarket.slice(0, 12)}… — agent currently tracks a different window.
        </p>
      )}

      <Panel>
        <div className="mb-3 flex items-center justify-between text-sm text-desk-muted">
          <span className="font-mono text-xs">
            {signal?.marketId ? `${signal.marketId.slice(0, 14)}…` : "No market"}
          </span>
          <span className="font-mono tabular-nums" suppressHydrationWarning>
            {signal?.expiry ? fmtCountdown(signal.expiry, now) : "—"} left
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

        <div className="mt-4 rounded-xl border border-desk-cyan/20 bg-gradient-to-br from-desk-cyan/5 to-transparent px-4 py-4">
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-desk-cyan">
            Why
          </p>
          <p className="text-[15px] leading-relaxed text-zinc-100">
            {signal?.reason || "Waiting for first agent tick…"}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge>{signal?.status || "—"}</Badge>
          {signal?.recommendedSide && (
            <Badge tone={signal.recommendedSide === "Up" ? "up" : "down"}>
              Signal {signal.recommendedSide}
            </Badge>
          )}
          {signal?.spotImpliedBias != null && (
            <Badge tone="cyan">Fair Up {fmtPct(signal.spotImpliedBias)}</Badge>
          )}
        </div>
      </Panel>

      {signal?.lastTrade && (
        <Panel title="Last trade">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">
                <span
                  className={
                    signal.lastTrade.side === "Up"
                      ? "text-desk-accent"
                      : "text-desk-down"
                  }
                >
                  {signal.lastTrade.side}
                </span>{" "}
                · size {signal.lastTrade.size} @ {fmtNum(signal.lastTrade.price, 3)}
              </p>
              <p className="mt-1 text-sm text-desk-muted">
                Edge {fmtPct(signal.lastTrade.edge)} · {fmtTime(signal.lastTrade.at)}
                {signal.lastTrade.dryRun ? " · dry-run" : ""}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                {signal.lastTrade.reason}
              </p>
            </div>
            {signal.lastTrade.txHash && (
              <a
                href={explorerTxUrl(signal.lastTrade.txHash)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-lg border border-desk-cyan/30 bg-desk-cyan/5 px-3 py-2 font-mono text-xs text-desk-cyan hover:underline"
              >
                Tx {shortHash(signal.lastTrade.txHash)} ↗
              </a>
            )}
          </div>
        </Panel>
      )}

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

      <div className="grid gap-3 sm:grid-cols-2">
        {signal?.oracleGraphUrl && (
          <a
            href={signal.oracleGraphUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-desk-border bg-desk-panel px-4 py-3 text-center text-sm text-desk-cyan transition hover:border-desk-cyan/40"
          >
            Oracle resolution graph ↗
          </a>
        )}
        <Link
          href="/app/markets"
          className="rounded-2xl border border-desk-border bg-desk-panel px-4 py-3 text-center text-sm text-desk-muted transition hover:text-white"
        >
          Browse markets →
        </Link>
      </div>

      {status?.claimable && status.claimable.length > 0 && (
        <Panel title="Claimable">
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
        </Panel>
      )}

      <footer className="space-y-1 pt-1 text-center text-[11px] text-desk-muted">
        <p>
          Threshold {fmtPct(signal?.edgeThreshold ?? status?.config?.edgeThreshold ?? 0.05, 0)} · size{" "}
          {signal?.copySize ?? status?.config?.copySize ?? 1} · tick{" "}
          {busy === "tick" ? "…" : "ok"}
        </p>
        <p suppressHydrationWarning>
          Updated {fmtTime(signal?.updatedAt)} · {new Date(now).toLocaleTimeString()}
        </p>
        {signal?.error && <p className="text-desk-down">{signal.error}</p>}
        {error && <p className="text-desk-warn">{error}</p>}
      </footer>

      {toast && <Toast message={toast} />}
    </div>
  );
}
