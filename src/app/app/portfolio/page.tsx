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
import {
  fetchWalletPortfolio,
  readFocusedBalances,
} from "@/lib/clientExchange";
import {
  readWalletExecution,
  type WalletExecution,
} from "@/lib/walletExecution";
import {
  explorerTxUrl,
  type ClaimablePosition,
  type WalletOpenPosition,
  type WalletSettledResult,
} from "@/lib/types";
import { formatFillStatusLabel, formatMarketStatus } from "@/lib/uiCopy";
import { isSettledHolding, settledBadgeTone } from "@/lib/settledResults";

export default function PortfolioPage() {
  // All hooks must run unconditionally on every render (React #310).
  const { status, loading, error, refresh } = useDeskStatus({
    pollMs: 10000,
  });
  const { address, isConnected } = useAccount();
  const { busy, claimMarket, lastExecution } = useWalletTrade();
  const [toast, setToast] = useState<string | null>(null);
  const [balances, setBalances] = useState<{
    upBalance: string;
    downBalance: string;
  } | null>(null);
  const [openPositions, setOpenPositions] = useState<WalletOpenPosition[]>([]);
  const [claimable, setClaimable] = useState<ClaimablePosition[]>([]);
  const [settledResults, setSettledResults] = useState<WalletSettledResult[]>(
    [],
  );
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [storedExec, setStoredExec] = useState<WalletExecution | null>(null);

  const marketId = status?.signal?.marketId;
  const lastTickAt = status?.lastTickAt;

  useEffect(() => {
    setStoredExec(readWalletExecution());
  }, [lastExecution, lastTickAt]);

  useEffect(() => {
    let cancelled = false;
    async function loadFocus() {
      if (!isConnected || !address || !marketId) {
        setBalances(null);
        return;
      }
      const row = await readFocusedBalances(marketId, address);
      if (!cancelled) setBalances(row);
    }
    void loadFocus();
    return () => {
      cancelled = true;
    };
  }, [address, isConnected, marketId, lastTickAt]);

  useEffect(() => {
    let cancelled = false;
    async function loadPortfolio() {
      if (!isConnected || !address) {
        setOpenPositions([]);
        setClaimable([]);
        setSettledResults([]);
        setPortfolioError(null);
        return;
      }
      setPortfolioLoading(true);
      setPortfolioError(null);
      const view = await fetchWalletPortfolio(address);
      if (cancelled) return;
      if (!view) {
        setOpenPositions([]);
        setClaimable([]);
        setSettledResults([]);
        setPortfolioError("We couldn't load your positions. Try again.");
      } else {
        setOpenPositions(view.openPositions);
        setClaimable(view.claimable);
        setSettledResults(view.settledResults || []);
      }
      setPortfolioLoading(false);
    }
    void loadPortfolio();
    return () => {
      cancelled = true;
    };
  }, [address, isConnected, lastTickAt, lastExecution]);

  const lastTrade = status?.signal?.lastTrade;
  const signal = status?.signal;
  const walletExec = lastExecution || storedExec;
  const showLoading = loading && !status;
  const showError = Boolean(error && !status);

  if (showLoading) {
    return (
      <StateBlock
        kind="loading"
        title="Loading portfolio..."
        detail="Getting your positions and claimable balances."
      />
    );
  }
  if (showError) {
    return (
      <StateBlock
        kind="error"
        title="Portfolio unavailable"
        detail="We couldn't load portfolio data. Try refreshing."
      />
    );
  }

  async function onClaim(id: string) {
    const res = await claimMarket(id);
    setToast(res.message);
    setTimeout(() => setToast(null), 4000);
    await refresh();
    if (address) {
      const view = await fetchWalletPortfolio(address);
      if (view) {
        setOpenPositions(view.openPositions);
        setClaimable(view.claimable);
        setSettledResults(view.settledResults || []);
      }
    }
  }

  // Open = still-trading holdings only; settled W/L move to Settled results.
  const openNonClaim = openPositions.filter(
    (p) => !p.claimable && !isSettledHolding({ status: p.status, voided: p.voided }),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader kicker="Portfolio" title="Your positions" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Current market" value={signal?.asset || "-"} />
        <MiniStat
          label="Ready to claim"
          value={String(claimable.length)}
          accent={claimable.length > 0}
        />
        <MiniStat
          label="Open positions"
          value={isConnected ? String(openNonClaim.length) : "-"}
        />
        <MiniStat
          label="Settled results"
          value={isConnected ? String(settledResults.length) : "-"}
        />
      </div>

      {!isConnected && (
        <StateBlock
          kind="empty"
          title="Connect your wallet"
          detail="Connect your wallet to see your positions and anything ready to claim. This page shows positions for your connected wallet, not the optional automation wallet."
        />
      )}

      <Panel title="Current market">
        {signal?.marketId ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-desk-muted">Market · </span>
              {signal.asset} {fmtInterval(signal.intervalSec)} ·{" "}
              {formatMarketStatus(signal.status)}
            </p>
            <p className="break-all font-mono text-xs text-desk-muted">
              Market {signal.marketId}
            </p>
            <p>
              <span className="text-desk-muted">Edge · </span>
              <span className="font-mono tabular">
                {signal.edge == null
                  ? "-"
                  : `${signal.edge >= 0 ? "+" : ""}${fmtPct(signal.edge)}`}
              </span>
              {signal.recommendedSide ? (
                <>
                  {" "}
                  <Badge
                    tone={signal.recommendedSide === "Up" ? "up" : "down"}
                  >
                    Buy {signal.recommendedSide}
                  </Badge>
                </>
              ) : (
                <>
                  {" "}
                  <Badge>No signal</Badge>
                </>
              )}
            </p>
            {isConnected && balances && (
              <p className="mt-2 font-mono text-xs text-desk-accent tabular">
                Your balance: Up {balances.upBalance} · Down{" "}
                {balances.downBalance}
              </p>
            )}
            {isConnected && !balances && (
              <p className="mt-2 text-xs text-desk-muted">
                Checking your Up and Down balances...
              </p>
            )}
            {!isConnected && (
              <p className="mt-2 text-xs text-desk-muted">
                Connect your wallet to see your balance in this market.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-desk-muted">
            No market is selected right now.
          </p>
        )}
      </Panel>

      <Panel title="Open positions">
        {!isConnected ? (
          <p className="text-sm text-desk-muted">
            Connect your wallet to see positions across all markets.
          </p>
        ) : portfolioLoading && openPositions.length === 0 ? (
          <StateBlock kind="loading" title="Loading your positions..." />
        ) : portfolioError && openPositions.length === 0 ? (
          <StateBlock
            kind="error"
            title="We couldn't load your positions"
            detail="Try again."
          />
        ) : openNonClaim.length === 0 ? (
          <StateBlock
            kind="empty"
            title="No open positions"
            detail="Positions will appear here after you trade an Up or Down market."
          />
        ) : (
          <ul className="space-y-2">
            {openNonClaim.map((p) => (
              <li
                key={`${p.marketId}-${p.outcomeIndex}`}
                className="rounded-desk border border-desk-border/70 bg-black/20 px-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {p.asset} {fmtInterval(p.intervalSec)} ·{" "}
                    <span
                      className={
                        p.side === "Up" ? "text-desk-accent" : "text-desk-down"
                      }
                    >
                      {p.side}
                    </span>
                  </p>
                  <Badge>{formatMarketStatus(p.status)}</Badge>
                </div>
                <p className="mt-1 text-xs text-desk-muted">
                  Position: {p.balance} {p.side}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-desk-muted/80 tabular">
                  Market {p.marketId.slice(0, 12)}…
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Ready to claim">
        {!isConnected ? (
          <p className="text-sm text-desk-muted">
            Connect your wallet to see settled positions that are ready to claim.
          </p>
        ) : claimable.length === 0 ? (
          <StateBlock
            kind="empty"
            title="Nothing to claim yet"
            detail="Winning and voided positions will appear here after settlement."
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
                    {c.asset} · {formatMarketStatus(c.status)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-desk-muted tabular">
                    Up balance {c.upBalance} · Down {c.downBalance}
                    {c.winningOutcome != null
                      ? ` · Winning side: ${c.winningOutcome === 0 ? "Up" : "Down"}`
                      : ""}
                  </p>
                  {c.oracleGraphUrl && (
                    <a
                      href={c.oracleGraphUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-desk-accent hover:underline"
                    >
                      View resolution
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
                  {busy === "claim" ? "Claiming..." : "Claim"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Settled results">
        {!isConnected ? (
          <p className="text-sm text-desk-muted">
            Connect your wallet to see past settled outcomes for this address.
          </p>
        ) : portfolioLoading && settledResults.length === 0 ? (
          <StateBlock kind="loading" title="Loading settled results..." />
        ) : settledResults.length === 0 ? (
          <StateBlock
            kind="empty"
            title="No settled trades for this wallet yet."
            detail="Wins, losses, claims, and voids for your connected wallet appear here after markets resolve. This is realized settlement only — not a Fair Up win-rate claim."
          />
        ) : (
          <>
            <p className="mb-3 text-xs text-desk-muted">
              Realized settlement for your connected wallet only. Approximate PnL
              uses indexed cost when available; otherwise PnL shows as —.
            </p>
            <ul className="space-y-2">
              {settledResults.map((r) => (
                <li
                  key={r.id}
                  className="rounded-desk border border-desk-border/70 bg-black/20 px-3 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {r.asset}{" "}
                      {r.intervalSec ? fmtInterval(r.intervalSec) : ""}
                      {r.side ? (
                        <>
                          {" "}
                          ·{" "}
                          <span
                            className={
                              r.side === "Up"
                                ? "text-desk-accent"
                                : "text-desk-down"
                            }
                          >
                            {r.side}
                          </span>
                        </>
                      ) : null}
                    </p>
                    <Badge tone={settledBadgeTone(r.kind)}>{r.kind}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-desk-muted">
                    Size {r.size}
                    {r.payoutApprox ? ` · Payout ${r.payoutApprox}` : ""}
                    {" · PnL "}
                    <span
                      className={
                        r.pnlAvailable && (r.pnlApprox ?? 0) > 0
                          ? "text-desk-accent"
                          : r.pnlAvailable && (r.pnlApprox ?? 0) < 0
                            ? "text-desk-down"
                            : ""
                      }
                    >
                      {r.pnlAvailable ? r.pnlLabel : "—"}
                    </span>
                    {!r.pnlAvailable ? (
                      <span className="text-desk-muted/80">
                        {" "}
                        (est. unavailable)
                      </span>
                    ) : null}
                  </p>
                  {r.settledAt && (
                    <p className="mt-0.5 text-[11px] text-desk-muted/80">
                      {fmtDateTime(r.settledAt)}
                    </p>
                  )}
                  {r.txHash && (
                    <a
                      href={explorerTxUrl(r.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-desk-accent hover:underline"
                    >
                      View claim tx{" "}
                      <span className="font-mono">{shortHash(r.txHash)}</span>
                      <ArrowSquareOut size={11} />
                    </a>
                  )}
                  <p className="mt-0.5 font-mono text-[11px] text-desk-muted/80 tabular">
                    Market {r.marketId.slice(0, 12)}…
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="Last wallet trade">
        {!walletExec ? (
          <StateBlock
            kind="empty"
            title="No wallet trades yet"
            detail="Trades you place from this browser will appear here."
          />
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-lg font-semibold">
              <span
                className={
                  walletExec.side === "Up" ? "text-desk-accent" : "text-desk-down"
                }
              >
                {walletExec.side}
              </span>{" "}
              · {formatFillStatusLabel(walletExec.fillStatus)}
              {walletExec.fillStatus === "partial" ||
              walletExec.fillStatus === "full"
                ? ` qty ${walletExec.filledQty}`
                : ""}{" "}
              @ {fmtNum(walletExec.price, 3)}
            </p>
            <p className="text-desk-muted">
              {fmtDateTime(walletExec.at)} · requested {walletExec.requestedQty}
            </p>
            <p className="leading-relaxed text-desk-ink/85">{walletExec.message}</p>
            {walletExec.txHash && (
              <a
                href={explorerTxUrl(walletExec.txHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-desk-accent hover:underline"
              >
                View transaction{" "}
                <span className="font-mono">{shortHash(walletExec.txHash)}</span>
                <ArrowSquareOut size={11} />
              </a>
            )}
          </div>
        )}
      </Panel>

      <Panel title="Latest Edge Desk signal">
        {!lastTrade ? (
          <StateBlock
            kind="empty"
            title="No signals yet"
            detail="The latest qualifying Edge Desk signal will appear here. Automatic trades shown here belong to the optional automation wallet, not your connected wallet."
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
              ·{" "}
              {formatFillStatusLabel(
                lastTrade.fillStatus ||
                  (lastTrade.dryRun ? "signal" : "submitted"),
              )}
              {lastTrade.filledQty != null
                ? ` · filled ${lastTrade.filledQty}`
                : ` · size ${lastTrade.size}`}{" "}
              @ {fmtNum(lastTrade.price, 3)}
            </p>
            <p className="text-desk-muted">
              {fmtDateTime(lastTrade.at)} · edge {fmtPct(lastTrade.edge)}
              {lastTrade.dryRun ? " · signal only" : ""}
            </p>
            <p className="leading-relaxed text-desk-ink/85">{lastTrade.reason}</p>
            {lastTrade.txHash && (
              <a
                href={explorerTxUrl(lastTrade.txHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-desk-accent hover:underline"
              >
                View transaction{" "}
                <span className="font-mono">{shortHash(lastTrade.txHash)}</span>
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
