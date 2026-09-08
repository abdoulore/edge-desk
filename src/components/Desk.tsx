"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowSquareOut,
  Lightning,
  Warning,
} from "@phosphor-icons/react";
import { useDeskStatus } from "@/hooks/useDeskStatus";
import { useWalletTrade } from "@/hooks/useWalletTrade";
import { Badge, Metric, Panel, StateBlock, Toast, PageHeader, Btn } from "@/components/ui";
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
  const { status, loading, error, busy, tick, refresh } = useDeskStatus({
    pollMs: 8000,
  });
  const {
    isConnected,
    busy: tradeBusy,
    copyFromSignal,
    claimMarket,
  } = useWalletTrade();
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

  useEffect(() => {
    if (!focusMarket) return;
    void fetch("/api/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketId: focusMarket }),
    }).then(() => refresh());
  }, [focusMarket, refresh]);

  const signal = status?.signal;
  const claimable = status?.claimable ?? [];
  const hasClaimable = claimable.length > 0;
  const actionBusy = busy !== null || tradeBusy !== null;
  const edgeColor = useMemo(() => {
    if (signal?.edge == null) return "text-desk-muted";
    if (Math.abs(signal.edge) >= signal.edgeThreshold) return "text-desk-accent";
    return "text-desk-warn";
  }, [signal]);

  async function onCopy() {
    const res = await copyFromSignal(signal);
    setToast(res.message);
    await refresh();
  }

  async function onClaim(marketId?: string) {
    const id = marketId || claimable[0]?.marketId;
    const res = await claimMarket(id);
    setToast(res.message);
    await refresh();
  }

  if (loading && !status) {
    return (
      <StateBlock
        kind="loading"
        title="Connecting to desk..."
        detail="Fetching /api/status"
      />
    );
  }

  if (error && !status) {
    return <StateBlock kind="error" title="Desk offline" detail={error} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader
        kicker="Trading desk"
        title={`${signal?.asset || "-"} · ${fmtInterval(signal?.intervalSec)} window`}
        action={
          <button
            type="button"
            onClick={() => void tick()}
            disabled={actionBusy}
            className="inline-flex items-center gap-1.5 rounded-desk-sm border border-desk-border bg-desk-panel px-3 py-1.5 text-xs text-desk-muted transition hover:text-desk-ink disabled:opacity-50"
          >
            <Lightning size={13} weight="fill" />
            {busy === "tick" ? "Ticking..." : "Force signal"}
          </button>
        }
      />

      {status?.paused && (
        <Alert tone="warn">Agent paused. Resume in Settings.</Alert>
      )}

      {status?.agentStalled && !status?.paused && (
        <Alert tone="down">Agent not running (stale lastTickAt).</Alert>
      )}

      {(status?.preferredMissing || signal?.preferredMissing) && (
        <Alert tone="warn">
          Preferred window missing - showing {fmtInterval(signal?.intervalSec)}.
        </Alert>
      )}

      {focusMarket &&
        signal?.marketId &&
        focusMarket.toLowerCase() !== signal.marketId.toLowerCase() && (
          <Alert tone="warn">
            Focus requested {focusMarket.slice(0, 12)}... - waiting for agent to
            adopt.
          </Alert>
        )}

      <Panel>
        <div className="mb-3 flex items-center justify-between text-sm text-desk-muted">
          <span className="font-mono text-xs tabular">
            {signal?.marketId
              ? `${signal.marketId.slice(0, 14)}...`
              : "No market"}
          </span>
          <span className="font-mono text-xs tabular" suppressHydrationWarning>
            {signal?.expiry ? fmtCountdown(signal.expiry, now) : "-"} left
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Up %" value={fmtPct(signal?.upMid)} accent />
          <Metric
            label="Edge"
            value={
              signal?.edge == null
                ? "-"
                : `${signal.edge >= 0 ? "+" : ""}${fmtPct(signal.edge)}`
            }
            className={edgeColor}
          />
          <Metric
            label="Spot"
            value={fmtNum(signal?.spot, 2)}
            sub={
              signal?.spotSource && signal.spotSource !== "sdk"
                ? signal.spotSource
                : undefined
            }
          />
          <Metric label="Reference" value={fmtNum(signal?.reference, 2)} />
        </div>

        <div className="mt-4 rounded-desk border border-desk-accent/20 bg-gradient-to-br from-desk-accent/5 to-transparent px-4 py-4">
          <p className="mb-1.5 text-[11px] font-medium text-desk-accent">Why</p>
          <p className="text-[15px] leading-relaxed text-desk-ink">
            {signal?.reason || "Waiting for first agent tick..."}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge>{signal?.status || "-"}</Badge>
          {signal?.recommendedSide && (
            <Badge tone={signal.recommendedSide === "Up" ? "up" : "down"}>
              Signal {signal.recommendedSide}
            </Badge>
          )}
          {signal?.spotImpliedBias != null && (
            <Badge tone="cyan">Fair Up {fmtPct(signal.spotImpliedBias)}</Badge>
          )}
          {signal?.spotSource === "sdk" && <Badge tone="cyan">SDK spot</Badge>}
          {signal?.spotSource === "coingecko" && (
            <Badge tone="warn">CoinGecko display</Badge>
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
                · size {signal.lastTrade.size} @{" "}
                {fmtNum(signal.lastTrade.price, 3)}
              </p>
              <p className="mt-1 text-sm text-desk-muted">
                Edge {fmtPct(signal.lastTrade.edge)} ·{" "}
                {fmtTime(signal.lastTrade.at)}
                {signal.lastTrade.dryRun ? " · dry-run" : ""}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-desk-ink/85">
                {signal.lastTrade.reason}
              </p>
            </div>
            {signal.lastTrade.txHash && (
              <a
                href={explorerTxUrl(signal.lastTrade.txHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-desk-sm border border-desk-accent/30 bg-desk-accent/5 px-3 py-2 font-mono text-xs text-desk-accent hover:underline"
              >
                Tx {shortHash(signal.lastTrade.txHash)}
                <ArrowSquareOut size={12} />
              </a>
            )}
          </div>
        </Panel>
      )}

      <section className="grid grid-cols-2 gap-3">
        <Btn
          onClick={() => void onCopy()}
          disabled={actionBusy || !isConnected}
          className="w-full py-3.5"
        >
          {tradeBusy === "copy"
            ? "Trading..."
            : isConnected
              ? "Trade this signal"
              : "Connect to trade"}
        </Btn>
        <Btn
          variant="secondary"
          onClick={() => void onClaim()}
          disabled={actionBusy || !isConnected || !hasClaimable}
          className="w-full py-3.5"
        >
          {tradeBusy === "claim"
            ? "Claiming..."
            : !hasClaimable
              ? "Nothing to claim"
              : isConnected
                ? "Claim"
                : "Connect to claim"}
        </Btn>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {signal?.oracleGraphUrl && (
          <a
            href={signal.oracleGraphUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-desk-lg border border-desk-border bg-desk-panel px-4 py-3 text-center text-sm text-desk-accent transition hover:border-desk-accent/40"
          >
            Oracle resolution graph
            <ArrowSquareOut size={14} />
          </a>
        )}
        <Link
          href="/app/markets"
          className="rounded-desk-lg border border-desk-border bg-desk-panel px-4 py-3 text-center text-sm text-desk-muted transition hover:text-desk-ink"
        >
          Browse markets
        </Link>
      </div>

      {hasClaimable && (
        <Panel title="Claimable">
          <ul className="space-y-2">
            {claimable.map((c) => (
              <li
                key={c.marketId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div>
                  <p>
                    {c.asset} · {c.status}
                  </p>
                  <p className="font-mono text-xs text-desk-muted tabular">
                    {c.marketId.slice(0, 10)}...
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-desk-sm bg-white/10 px-3 py-1.5 text-xs transition hover:bg-white/15 disabled:opacity-50"
                  disabled={actionBusy || !isConnected}
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
          Threshold{" "}
          {fmtPct(
            signal?.edgeThreshold ?? status?.config?.edgeThreshold ?? 0.05,
            0,
          )}{" "}
          · size {signal?.copySize ?? status?.config?.copySize ?? 1} ·{" "}
          {status?.agentStalled
            ? "stalled"
            : status?.paused
              ? "paused"
              : "signal-only"}
        </p>
        <p suppressHydrationWarning>
          Updated {fmtTime(signal?.updatedAt)} ·{" "}
          {new Date(now).toLocaleTimeString()}
        </p>
        {signal?.error && <p className="text-desk-down">{signal.error}</p>}
        {error && <p className="text-desk-warn">{error}</p>}
      </footer>

      {toast && <Toast message={toast} />}
    </div>
  );
}

function Alert({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "warn" | "down";
}) {
  const cls =
    tone === "warn"
      ? "border-desk-warn/30 bg-desk-warn/5 text-desk-warn"
      : "border-desk-down/30 bg-desk-down/5 text-desk-down";
  return (
    <p
      className={`flex items-start gap-2 rounded-desk border px-3 py-2 text-xs ${cls}`}
    >
      <Warning size={14} className="mt-0.5 shrink-0" weight="fill" />
      <span>{children}</span>
    </p>
  );
}
