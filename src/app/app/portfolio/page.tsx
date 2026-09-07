"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { useDeskStatus } from "@/hooks/useDeskStatus";
import { useWalletTrade } from "@/hooks/useWalletTrade";
import {
  Badge,
  Panel,
  StateBlock,
  Toast,
  PageHeader,
} from "@/components/ui";
import {
  fmtDateTime,
  fmtInterval,
  fmtNum,
  fmtPct,
  shortHash,
} from "@/lib/format";
import { readFocusedBalances } from "@/lib/clientExchange";
import { explorerTxUrl } from "@/lib/types";

export default function PortfolioPage() {
  const { status, loading, error, refresh } = useDeskStatus({
    pollMs: 10000,
  });
  const { address, isConnected } = useAccount();
  const { busy, claimMarket } = useWalletTrade();
  const [toast, setToast] = useState<string | null>(null);
  const [balances, setBalances] = useState<{
    upBalance: string;
    downBalance: string;
  } | null>(null);

  const claimable = status?.claimable ?? [];
  const lastTrade = status?.signal?.lastTrade;
  const signal = status?.signal;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isConnected || !address || !signal?.marketId) {
        setBalances(null);
        return;
      }
      const row = await readFocusedBalances(signal.marketId, address);
      if (!cancelled) setBalances(row);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [address, isConnected, signal?.marketId, status?.lastTickAt]);

  if (loading && !status) {
    return <StateBlock kind="loading" title="Loading portfolio..." />;
  }
  if (error && !status) {
    return (
      <StateBlock kind="error" title="Portfolio unavailable" detail={error} />
    );
  }

  async function onClaim(id: string) {
    const res = await claimMarket(id);
    setToast(res.message);
    setTimeout(() => setToast(null), 4000);
    await refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader kicker="Portfolio" title="Positions and claims" />

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat label="Focused" value={signal?.asset || "-"} />
        <MiniStat
          label="Claimable"
          value={String(claimable.length)}
          accent={claimable.length > 0}
        />
        <MiniStat
          label="Last side"
          value={lastTrade?.side || "-"}
          tone={
            lastTrade?.side === "Up"
              ? "text-desk-accent"
              : lastTrade?.side === "Down"
                ? "text-desk-down"
                : ""
          }
        />
      </div>

      <Panel title="Open focus">
        {signal?.marketId ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-desk-muted">Market · </span>
              {signal.asset} {fmtInterval(signal.intervalSec)} · {signal.status}
            </p>
            <p className="break-all font-mono text-xs text-desk-muted">
              {signal.marketId}
            </p>
            <p>
              <span className="text-desk-muted">Edge · </span>
              <span className="font-mono tabular">
                {signal.edge == null
                  ? "-"
                  : `${signal.edge >= 0 ? "+" : ""}${fmtPct(signal.edge)}`}
              </span>
              {signal.recommendedSide && (
                <>
                  {" "}
                  <Badge
                    tone={signal.recommendedSide === "Up" ? "up" : "down"}
                  >
                    {signal.recommendedSide}
                  </Badge>
                </>
              )}
            </p>
            {isConnected && balances && (
              <p className="mt-2 font-mono text-xs text-desk-accent tabular">
                Your outcomes · Up {balances.upBalance} · Down{" "}
                {balances.downBalance}
              </p>
            )}
            {isConnected && !balances && (
              <p className="mt-2 text-xs text-desk-muted">
                Reading outcome balances...
              </p>
            )}
            {!isConnected && (
              <p className="mt-2 text-xs text-desk-muted">
                Connect wallet to see outcome balances.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-desk-muted">No active market focus.</p>
        )}
      </Panel>

      <Panel title="Claimable">
        {claimable.length === 0 ? (
          <StateBlock
            kind="empty"
            title="Nothing claimable"
            detail="Resolved/voided balances with outcome tokens will show here after ticks."
          />
        ) : (
          <ul className="space-y-3">
            {claimable.map((c) => (
              <li
                key={c.marketId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-desk border border-desk-border/70 bg-black/20 px-3 py-3"
              >
                <div>
                  <p className="font-medium">
                    {c.asset} · {c.status}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-desk-muted tabular">
                    Up {c.upBalance} · Down {c.downBalance}
                  </p>
                  {c.oracleGraphUrl && (
                    <a
                      href={c.oracleGraphUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-desk-accent hover:underline"
                    >
                      Oracle graph
                      <ArrowSquareOut size={11} />
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy !== null || !isConnected}
                  onClick={() => void onClaim(c.marketId)}
                  className="rounded-desk-sm bg-desk-accent px-3 py-1.5 text-xs font-semibold text-black transition active:scale-[0.98] disabled:opacity-50"
                >
                  {busy === "claim" ? "..." : isConnected ? "Claim" : "Connect"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Last trade">
        {!lastTrade ? (
          <StateBlock
            kind="empty"
            title="No trades yet"
            detail="Agent fills and copy trades appear here."
          />
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-lg font-semibold">
              <span
                className={
                  lastTrade.side === "Up" ? "text-desk-accent" : "text-desk-down"
                }
              >
                {lastTrade.side}
              </span>{" "}
              · {lastTrade.size} @ {fmtNum(lastTrade.price, 3)}
            </p>
            <p className="text-desk-muted">
              {fmtDateTime(lastTrade.at)} · edge {fmtPct(lastTrade.edge)}
              {lastTrade.dryRun ? " · dry-run" : ""}
            </p>
            <p className="leading-relaxed text-desk-ink/85">{lastTrade.reason}</p>
            {lastTrade.txHash && (
              <a
                href={explorerTxUrl(lastTrade.txHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-desk-accent hover:underline"
              >
                {shortHash(lastTrade.txHash)}
                <ArrowSquareOut size={11} />
              </a>
            )}
          </div>
        )}
      </Panel>

      {toast && <Toast message={toast} />}
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
  tone = "",
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: string;
}) {
  return (
    <div className="rounded-desk-lg border border-desk-border bg-desk-panel px-4 py-3">
      <p className="text-[11px] font-medium text-desk-muted">{label}</p>
      <p
        className={`mt-1 font-mono text-xl font-semibold tabular ${
          accent ? "text-desk-accent" : ""
        } ${tone}`}
      >
        {value}
      </p>
    </div>
  );
}
