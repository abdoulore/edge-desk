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
import { explorerTxUrl, type ClaimablePosition } from "@/lib/types";
import { fetchWalletPortfolio } from "@/lib/clientExchange";
import {
  hasClientOperatorSecret,
  operatorFetchHeaders,
} from "@/lib/operatorSecret";
import { readWalletExecution } from "@/lib/walletExecution";
import {
  UI_COPY,
  formatFillStatusLabel,
  formatMarketStatus,
  preferredMissingCopy,
  spotSourceSub,
} from "@/lib/uiCopy";
import { toUserMessage } from "@/lib/userError";

export default function Desk() {
  const search = useSearchParams();
  const focusMarket = search.get("market");
  const {
    status,
    loading,
    error,
    busy,
    tick,
    refresh,
    operatorConfigured,
  } = useDeskStatus({
    pollMs: 8000,
  });
  const {
    isConnected,
    address,
    busy: tradeBusy,
    copyFromSignal,
    claimMarket,
    lastExecution,
  } = useWalletTrade();
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [walletClaimable, setWalletClaimable] = useState<ClaimablePosition[]>(
    [],
  );

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
    if (!hasClientOperatorSecret()) {
      setToast(UI_COPY.manualUnavailable);
      return;
    }
    void fetch("/api/focus", {
      method: "POST",
      headers: operatorFetchHeaders(),
      body: JSON.stringify({ marketId: focusMarket }),
    }).then(async (res) => {
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { message?: string };
        setToast(toUserMessage(json.message || `Focus failed (${res.status})`, "focus"));
      }
      await refresh();
    });
  }, [focusMarket, refresh]);

  useEffect(() => {
    let cancelled = false;
    async function loadClaims() {
      if (!isConnected || !address) {
        setWalletClaimable([]);
        return;
      }
      const view = await fetchWalletPortfolio(address);
      if (!cancelled && view) setWalletClaimable(view.claimable);
    }
    void loadClaims();
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, status?.lastTickAt, lastExecution]);

  const signal = status?.signal;
  const claimable =
    isConnected && walletClaimable.length >= 0
      ? walletClaimable
      : [];
  const hasClaimable = claimable.length > 0;
  const walletExec = lastExecution || readWalletExecution();
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
        title={UI_COPY.loadingDesk}
        detail={UI_COPY.loadingDeskDetail}
      />
    );
  }

  if (error && !status) {
    return (
      <StateBlock
        kind="error"
        title={UI_COPY.deskUnavailable}
        detail={UI_COPY.deskUnavailableDetail}
      />
    );
  }

  const preferredLabel = fmtInterval(
    status?.config?.preferredIntervalSec ?? 900,
  );
  const showingLabel = fmtInterval(signal?.intervalSec);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <PageHeader
        kicker="Current market"
        title={`${signal?.asset || "-"} · ${fmtInterval(signal?.intervalSec)}`}
        action={
          <button
            type="button"
            onClick={() => void tick()}
            disabled={actionBusy || !operatorConfigured}
            title={
              operatorConfigured
                ? "Run one signal check now"
                : UI_COPY.manualCheckUnavailableTitle
            }
            className="inline-flex items-center gap-1.5 rounded-desk-sm border border-desk-border bg-desk-panel px-3 py-1.5 text-xs text-desk-muted transition hover:text-desk-ink disabled:opacity-50"
          >
            <Lightning size={13} weight="fill" />
            {busy === "tick"
              ? UI_COPY.checking
              : operatorConfigured
                ? UI_COPY.checkNow
                : UI_COPY.manualCheckUnavailable}
          </button>
        }
      />

      {status?.paused && (
        <Alert tone="warn">{UI_COPY.pausedAlert}</Alert>
      )}

      {status?.agentStalled && !status?.paused && (
        <Alert tone="down">{UI_COPY.stalledAlert}</Alert>
      )}

      {(status?.preferredMissing || signal?.preferredMissing) && (
        <Alert tone="warn">
          {preferredMissingCopy(preferredLabel, showingLabel)}
        </Alert>
      )}

      {focusMarket &&
        signal?.marketId &&
        focusMarket.toLowerCase() !== signal.marketId.toLowerCase() && (
          <Alert tone="warn">{UI_COPY.switchingMarket}</Alert>
        )}

      <Panel>
        <div className="mb-3 flex items-center justify-between text-sm text-desk-muted">
          <span
            className="font-mono text-xs tabular"
            title={signal?.marketId || undefined}
          >
            {signal?.marketId
              ? `Market ${signal.marketId.slice(0, 10)}…${signal.marketId.slice(-4)}`
              : "No market"}
          </span>
          <span className="font-mono text-xs tabular" suppressHydrationWarning>
            {signal?.expiry ? fmtCountdown(signal.expiry, now) : "-"} left
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric
            label="Up midpoint"
            value={fmtPct(signal?.upMid)}
            accent
            title={UI_COPY.upMidpointTooltip}
          />
          <Metric
            label="Edge"
            value={
              signal?.edge == null
                ? "-"
                : `${signal.edge >= 0 ? "+" : ""}${fmtPct(signal.edge)}`
            }
            className={edgeColor}
            title={UI_COPY.edgeTooltip}
          />
          <Metric
            label="Spot price"
            value={fmtNum(signal?.spot, 2)}
            sub={spotSourceSub(signal?.spotSource)}
            title={
              signal?.spotSource === "coingecko"
                ? UI_COPY.coinGeckoDisplayOnly
                : undefined
            }
          />
          <Metric
            label="Opening price"
            value={fmtNum(signal?.reference, 2)}
            title={UI_COPY.openingPriceTooltip}
          />
        </div>

        <div className="mt-4 rounded-desk border border-desk-accent/20 bg-gradient-to-br from-desk-accent/5 to-transparent px-4 py-4">
          <p className="mb-1.5 text-[11px] font-medium text-desk-accent">
            Why Edge Desk sees this
          </p>
          <p className="text-[15px] leading-relaxed text-desk-ink">
            {signal?.reason || UI_COPY.waitingFirstSignal}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge>{formatMarketStatus(signal?.status)}</Badge>
          {signal?.recommendedSide ? (
            <Badge tone={signal.recommendedSide === "Up" ? "up" : "down"}>
              Buy {signal.recommendedSide}
            </Badge>
          ) : (
            <Badge>{UI_COPY.noSignal}</Badge>
          )}
          {signal?.spotImpliedBias != null && (
            <Badge tone="cyan">
              <span title={UI_COPY.fairUpTooltip}>
                Fair Up {fmtPct(signal.spotImpliedBias)}
              </span>
            </Badge>
          )}
          {signal?.spotSource === "coingecko" && (
            <Badge tone="warn">
              <span title={UI_COPY.coinGeckoDisplayOnly}>Display only</span>
            </Badge>
          )}
        </div>
      </Panel>

      {signal?.lastTrade && (
        <Panel title="Latest Edge Desk signal">
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
                {" · "}
                {formatFillStatusLabel(
                  signal.lastTrade.fillStatus ||
                    (signal.lastTrade.dryRun ? "signal" : "submitted"),
                )}
                {signal.lastTrade.filledQty != null
                  ? ` · qty ${signal.lastTrade.filledQty}`
                  : ""}
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
                className="inline-flex shrink-0 items-center gap-1 rounded-desk-sm border border-desk-accent/30 bg-desk-accent/5 px-3 py-2 text-xs text-desk-accent hover:underline"
                title={signal.lastTrade.txHash}
              >
                {UI_COPY.viewTransaction}
                <span className="font-mono opacity-70">
                  {shortHash(signal.lastTrade.txHash)}
                </span>
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
            ? UI_COPY.placingTrade
            : isConnected
              ? UI_COPY.tradeThisSignal
              : UI_COPY.connectToTrade}
        </Btn>
        <Btn
          variant="secondary"
          onClick={() => void onClaim()}
          disabled={actionBusy || !isConnected || !hasClaimable}
          className="w-full py-3.5"
        >
          {tradeBusy === "claim"
            ? UI_COPY.claiming
            : !hasClaimable
              ? UI_COPY.nothingToClaim
              : isConnected
                ? UI_COPY.claim
                : UI_COPY.connectToClaim}
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
            {UI_COPY.viewResolution}
            <ArrowSquareOut size={14} />
          </a>
        )}
        <Link
          href="/app/markets"
          className="rounded-desk-lg border border-desk-border bg-desk-panel px-4 py-3 text-center text-sm text-desk-muted transition hover:text-desk-ink"
        >
          {UI_COPY.browseMarkets}
        </Link>
      </div>

      {walletExec && (
        <Panel title="Last wallet trade">
          <p className="text-sm">
            <span
              className={
                walletExec.side === "Up" ? "text-desk-accent" : "text-desk-down"
              }
            >
              {walletExec.side}
            </span>{" "}
            · {formatFillStatusLabel(walletExec.fillStatus)}
            {walletExec.filledQty != null
              ? ` · qty ${walletExec.filledQty}`
              : ""}{" "}
            · {fmtTime(walletExec.at)}
          </p>
          <p className="mt-1 text-xs text-desk-muted">{walletExec.message}</p>
          {walletExec.txHash && (
            <a
              href={explorerTxUrl(walletExec.txHash)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-desk-accent hover:underline"
            >
              {UI_COPY.viewTransaction}
              <span className="font-mono opacity-70">
                {shortHash(walletExec.txHash)}
              </span>
              <ArrowSquareOut size={11} />
            </a>
          )}
        </Panel>
      )}

      {hasClaimable && (
        <Panel title="Ready to claim">
          <ul className="space-y-2">
            {claimable.map((c) => (
              <li
                key={c.marketId}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div>
                  <p>
                    {c.asset} · {formatMarketStatus(c.status)}
                  </p>
                  <p className="font-mono text-xs text-desk-muted tabular">
                    Market {c.marketId.slice(0, 10)}…
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
            ? "not updating"
            : status?.paused
              ? "paused"
              : status?.dryRun
                ? "signal only"
                : "auto trade"}
        </p>
        <p suppressHydrationWarning>
          Updated {fmtTime(signal?.updatedAt)} ·{" "}
          {new Date(now).toLocaleTimeString()}
        </p>
        {signal?.error && (
          <p className="text-desk-down">{toUserMessage(signal.error)}</p>
        )}
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
