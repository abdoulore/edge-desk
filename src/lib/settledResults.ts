/**
 * Pure helpers: derive wallet-scoped settled W/L/Claimed/Void rows from
 * SDK portfolio positions, redeem actions, and optional cost hints.
 * No trading math changes — realized settlement display only.
 */

import { formatRawBalance } from "./format";
import type { Side, WalletSettledResult, SettledOutcomeKind } from "./types";

export type SettledPositionInput = {
  marketId: string;
  marketAddress?: string;
  asset: string;
  intervalSec: number;
  status: string;
  voided: boolean;
  winningOutcome?: number | null;
  outcomeIndex: number;
  side: Side;
  balance: string;
  balanceRaw: string;
  quoteDecimals: number;
  claimable: boolean;
};

export type SettledRedeemInput = {
  id: string;
  marketId: string | null;
  amount: string;
  payout: string | null;
  timestamp: string;
  txHash: string;
};

export type SettledTradeCostInput = {
  marketAddress: string;
  /** Account side on the fill when known (BUY_YES / BUY_NO / …). */
  side: string | null;
  fillPriceRaw: string;
  quantityRaw: string;
  quoteDecimals: number;
};

export type SettledPnlHint = {
  marketId: string;
  /** Raw cost basis for the outcome still held (collateral units). */
  costBasisRaw?: string | null;
  /** Raw mark / settlement value of remaining balances. */
  markValueRaw?: string | null;
  /** Raw unrealized PnL when the SDK provides it. */
  unrealizedPnlRaw?: string | null;
  quoteDecimals: number;
};

export type LocalCostHint = {
  marketId: string;
  /** Human units: filled qty × limit/fill price ≈ tUSDC spent. */
  costHuman: number;
};

function isSettledMarket(status: string, voided: boolean): boolean {
  return (
    voided ||
    status === "Voided" ||
    status === "Resolved" ||
    status === "Finalized"
  );
}

export function isSettledHolding(opts: {
  status: string;
  voided: boolean;
}): boolean {
  return isSettledMarket(opts.status, opts.voided);
}

function rawToNumber(
  raw: string | bigint | null | undefined,
  decimals: number,
): number | null {
  if (raw == null || raw === "") return null;
  try {
    const n = typeof raw === "bigint" ? raw : BigInt(String(raw).split(".")[0] || "0");
    const d = Math.max(0, Math.min(36, Math.floor(decimals)));
    const base = 10n ** BigInt(d);
    const whole = n / base;
    const frac = n % base;
    const sign = n < 0n ? -1 : 1;
    const absWhole = whole < 0n ? -whole : whole;
    const absFrac = frac < 0n ? -frac : frac;
    const human =
      Number(absWhole) + Number(absFrac) / Number(base);
    if (!Number.isFinite(human)) return null;
    return sign * human;
  } catch {
    return null;
  }
}

function formatPnl(pnl: number | null): {
  pnlApprox: number | null;
  pnlLabel: string;
  pnlAvailable: boolean;
} {
  if (pnl == null || !Number.isFinite(pnl)) {
    return { pnlApprox: null, pnlLabel: "—", pnlAvailable: false };
  }
  const rounded = Math.round(pnl * 1e6) / 1e6;
  const sign = rounded > 0 ? "+" : "";
  return {
    pnlApprox: rounded,
    pnlLabel: `${sign}${formatRawBalance(
      BigInt(Math.round(rounded * 1e6)),
      6,
      4,
    )} tUSDC`,
    pnlAvailable: true,
  };
}

/** Approx collateral spent on buys for a market address from recent fills. */
export function estimateBuyCostFromTrades(
  trades: SettledTradeCostInput[],
  marketAddress: string,
): number | null {
  const addr = marketAddress.toLowerCase();
  let cost = 0;
  let saw = false;
  for (const t of trades) {
    if ((t.marketAddress || "").toLowerCase() !== addr) continue;
    const side = (t.side || "").toUpperCase();
    if (side !== "BUY_YES" && side !== "BUY_NO") continue;
    const qty = rawToNumber(t.quantityRaw, t.quoteDecimals);
    const px = rawToNumber(t.fillPriceRaw, t.quoteDecimals);
    if (qty == null || px == null || qty <= 0 || px < 0) continue;
    // Prices are YES-probability scale. NO buys cost (1 − yesPrice).
    const unit = side === "BUY_NO" ? Math.max(0, 1 - px) : px;
    cost += qty * unit;
    saw = true;
  }
  return saw ? cost : null;
}

function classifyHolding(opts: {
  voided: boolean;
  status: string;
  winningOutcome?: number | null;
  outcomeIndex: number;
}): SettledOutcomeKind | null {
  if (!isSettledMarket(opts.status, opts.voided)) return null;
  if (opts.voided || opts.status === "Voided") return "Void";
  if (opts.winningOutcome == null) return null;
  return Number(opts.winningOutcome) === opts.outcomeIndex ? "Won" : "Lost";
}

function pickCost(opts: {
  marketId: string;
  marketAddress?: string;
  pnlHints: SettledPnlHint[];
  trades: SettledTradeCostInput[];
  localHints: LocalCostHint[];
}): number | null {
  const id = opts.marketId.toLowerCase();
  const fromPnl = opts.pnlHints.find((h) => h.marketId.toLowerCase() === id);
  if (fromPnl?.costBasisRaw != null) {
    const c = rawToNumber(fromPnl.costBasisRaw, fromPnl.quoteDecimals);
    if (c != null && c > 0) return c;
  }
  const local = opts.localHints.find((h) => h.marketId.toLowerCase() === id);
  if (local && Number.isFinite(local.costHuman) && local.costHuman > 0) {
    return local.costHuman;
  }
  if (opts.marketAddress) {
    return estimateBuyCostFromTrades(opts.trades, opts.marketAddress);
  }
  return null;
}

function pickUnrealized(opts: {
  marketId: string;
  pnlHints: SettledPnlHint[];
}): number | null {
  const id = opts.marketId.toLowerCase();
  const fromPnl = opts.pnlHints.find((h) => h.marketId.toLowerCase() === id);
  if (!fromPnl) return null;
  if (fromPnl.unrealizedPnlRaw != null) {
    return rawToNumber(fromPnl.unrealizedPnlRaw, fromPnl.quoteDecimals);
  }
  const mark = rawToNumber(fromPnl.markValueRaw, fromPnl.quoteDecimals);
  const cost = rawToNumber(fromPnl.costBasisRaw, fromPnl.quoteDecimals);
  if (mark != null && cost != null) return mark - cost;
  return null;
}

/**
 * Build settled result rows for a connected wallet.
 * Holdings still on the losing/winning/void side + completed Redeems.
 */
export function deriveSettledResults(input: {
  positions: SettledPositionInput[];
  redeems: SettledRedeemInput[];
  trades?: SettledTradeCostInput[];
  pnlHints?: SettledPnlHint[];
  localHints?: LocalCostHint[];
  /** Optional marketId → { asset, intervalSec, marketAddress, quoteDecimals } for claim-only rows. */
  marketMeta?: Record<
    string,
    {
      asset?: string;
      intervalSec?: number;
      marketAddress?: string;
      quoteDecimals?: number;
    }
  >;
}): WalletSettledResult[] {
  const trades = input.trades || [];
  const pnlHints = input.pnlHints || [];
  const localHints = input.localHints || [];
  const meta = input.marketMeta || {};
  const out: WalletSettledResult[] = [];

  for (const p of input.positions) {
    if (!p.balanceRaw || p.balanceRaw === "0") continue;
    const kind = classifyHolding(p);
    if (!kind) continue;

    const sizeNum = rawToNumber(p.balanceRaw, p.quoteDecimals) ?? 0;
    let pnl: number | null = pickUnrealized({
      marketId: p.marketId,
      pnlHints,
    });
    const cost = pickCost({
      marketId: p.marketId,
      marketAddress: p.marketAddress,
      pnlHints,
      trades,
      localHints,
    });

    if (pnl == null && cost != null) {
      if (kind === "Won") {
        // Winning tokens redeem ~1:1 collateral (fee ignored — approx).
        pnl = sizeNum - cost;
      } else if (kind === "Lost") {
        pnl = -cost;
      } else if (kind === "Void") {
        // Void redeems ~half collateral per token.
        pnl = sizeNum * 0.5 - cost;
      }
    }

    const formatted = formatPnl(pnl);
    out.push({
      id: `hold-${p.marketId}-${p.outcomeIndex}`,
      marketId: p.marketId,
      asset: p.asset || "—",
      intervalSec: p.intervalSec || 0,
      kind,
      side: p.side,
      size: p.balance,
      sizeRaw: p.balanceRaw,
      quoteDecimals: p.quoteDecimals,
      pnlApprox: formatted.pnlApprox,
      pnlLabel: formatted.pnlAvailable ? formatted.pnlLabel : "—",
      pnlAvailable: formatted.pnlAvailable,
      costApprox:
        cost != null
          ? `${formatRawBalance(BigInt(Math.round(cost * 1e6)), 6, 4)} tUSDC`
          : null,
      payoutApprox:
        kind === "Won"
          ? `${p.balance} tUSDC (est.)`
          : kind === "Void"
            ? `${formatRawBalance(
                BigInt(Math.round(sizeNum * 0.5 * 1e6)),
                6,
                4,
              )} tUSDC (est.)`
            : null,
      winningOutcome: p.winningOutcome ?? null,
      voided: p.voided || p.status === "Voided",
    });
  }

  // Completed redemptions → Claimed (wallet-scoped router history).
  for (const r of input.redeems) {
    if (!r.marketId) continue;
    const mid = r.marketId.toLowerCase();
    const m = meta[mid] || meta[r.marketId] || {};
    const decimals = m.quoteDecimals ?? 6;
    const amountHuman = rawToNumber(r.amount, decimals);
    const payoutHuman = rawToNumber(r.payout, decimals);
    const cost = pickCost({
      marketId: mid,
      marketAddress: m.marketAddress,
      pnlHints,
      trades,
      localHints,
    });
    let pnl: number | null = null;
    if (payoutHuman != null && cost != null) pnl = payoutHuman - cost;
    else if (payoutHuman != null && amountHuman != null && cost == null) {
      // Payout known but cost unknown — show payout, leave PnL unavailable.
      pnl = null;
    }
    const formatted = formatPnl(pnl);
    const sizeLabel =
      amountHuman != null
        ? formatRawBalance(r.amount, decimals)
        : formatRawBalance(r.amount || "0", decimals);

    let settledAt: string | undefined;
    try {
      const ts = Number(r.timestamp);
      if (Number.isFinite(ts) && ts > 0) {
        settledAt = new Date(ts * 1000).toISOString();
      }
    } catch {
      /* ignore */
    }

    out.push({
      id: `claim-${r.id}`,
      marketId: mid,
      asset: m.asset || "—",
      intervalSec: m.intervalSec || 0,
      kind: "Claimed",
      size: sizeLabel,
      sizeRaw: r.amount,
      quoteDecimals: decimals,
      pnlApprox: formatted.pnlApprox,
      pnlLabel: formatted.pnlAvailable ? formatted.pnlLabel : "—",
      pnlAvailable: formatted.pnlAvailable,
      costApprox:
        cost != null
          ? `${formatRawBalance(BigInt(Math.round(cost * 1e6)), 6, 4)} tUSDC`
          : null,
      payoutApprox:
        payoutHuman != null
          ? `${formatRawBalance(r.payout || "0", decimals)} tUSDC`
          : null,
      txHash: r.txHash || undefined,
      settledAt,
      voided: false,
    });
  }

  // Newest claimed first; holdings without timestamp after by asset.
  out.sort((a, b) => {
    const ta = a.settledAt ? Date.parse(a.settledAt) : 0;
    const tb = b.settledAt ? Date.parse(b.settledAt) : 0;
    if (tb !== ta) return tb - ta;
    return a.asset.localeCompare(b.asset);
  });

  return out;
}

export function settledBadgeTone(
  kind: SettledOutcomeKind,
): "up" | "down" | "cyan" | "warn" | "neutral" {
  switch (kind) {
    case "Won":
      return "up";
    case "Lost":
      return "down";
    case "Claimed":
      return "cyan";
    case "Void":
      return "warn";
    default:
      return "neutral";
  }
}
