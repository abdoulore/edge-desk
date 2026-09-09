"use client";

import {
  SomniaMarkets,
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
  type PlaceOrderResult,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { WalletClient } from "viem";
import { formatRawBalance } from "./format";
import { classifyFill } from "./fillStatus";
import { resolveMarketSymbol } from "./outcomes";
import type {
  ClaimablePosition,
  FillStatus,
  Side,
  WalletOpenPosition,
} from "./types";

const INDEXER =
  process.env.NEXT_PUBLIC_INDEXER_URL || "https://dev.smk.somnia.host/v1/graphql";
const WS =
  process.env.NEXT_PUBLIC_WS_RPC_URL ||
  "wss://api.infra.testnet.somnia.network/ws";

/** Browser SomniaMarkets bound to the user's wagmi walletClient. */
export function createWalletExchange(walletClient: WalletClient): SomniaMarkets {
  return new SomniaMarkets({
    indexerUrl: INDEXER,
    chain: somniaShannon,
    wsRpcUrl: WS,
    addresses: SOMNIA_TESTNET_ADDRESSES,
    priceFeed: SOMNIA_TESTNET_PRICE_FEED,
    walletClient,
  });
}

/** Read-only exchange (no signer) for book/balance reads. */
export function createReadExchange(): SomniaMarkets {
  return new SomniaMarkets({
    indexerUrl: INDEXER,
    chain: somniaShannon,
    wsRpcUrl: WS,
    addresses: SOMNIA_TESTNET_ADDRESSES,
    priceFeed: SOMNIA_TESTNET_PRICE_FEED,
  });
}

/**
 * loadMarkets() must run on this exchange instance before createOrder —
 * the SDK resolves symbols from an instance registry.
 * Validates chain binding, optional marketId, and outcome symbol together.
 *
 * loadMarkets() keys by MARKET symbol (BTC-…/tUSDC); wallet signals carry
 * tradable …#YES/#NO. Resolve via base key / marketId / nested outcomes and
 * return the registry tradable symbol for createOrder.
 */
export async function ensureMarketReady(
  exchange: SomniaMarkets,
  opts: { symbol: string; marketId?: string },
): Promise<{ ok: true; symbol: string } | { ok: false; message: string }> {
  const { symbol, marketId } = opts;
  if (!symbol) return { ok: false, message: "Missing outcome symbol" };

  let map: Record<string, unknown>;
  try {
    map = (await exchange.loadMarkets(true)) as Record<string, unknown>;
  } catch (e) {
    return {
      ok: false,
      message: `loadMarkets failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const resolved = resolveMarketSymbol(map, { symbol, marketId });
  if (!resolved.ok) return resolved;

  // Soft chain check — Shannon testnet wallet exchange is fixed at construction.
  try {
    const chainId = (exchange as unknown as { chain?: { id?: number } }).chain?.id;
    if (chainId != null && chainId !== somniaShannon.id) {
      return {
        ok: false,
        message: `Wrong chain ${chainId} — expected Shannon ${somniaShannon.id}`,
      };
    }
  } catch {
    /* ignore */
  }

  return { ok: true, symbol: resolved.symbol };
}

export type PlaceIocResult = {
  txHash?: string;
  filled: number;
  requested: number;
  fillStatus: FillStatus;
  orderStatus?: string;
  /** Registry tradable symbol used for createOrder (may differ from input). */
  symbol: string;
};

export async function placeIocWithWallet(
  exchange: SomniaMarkets,
  symbol: string,
  size: number,
  limitPrice: number,
  marketId?: string,
): Promise<PlaceIocResult> {
  const ready = await ensureMarketReady(exchange, { symbol, marketId });
  if (!ready.ok) throw new Error(ready.message);

  const order = await exchange.createOrder(ready.symbol, "limit", "buy", size, limitPrice, {
    timeInForce: "IOC",
  });
  const info = order.info as PlaceOrderResult | undefined;
  const receipt = info?.receipt as
    | { transactionHash?: string; status?: string | number }
    | undefined;
  if (receipt?.status === "reverted" || receipt?.status === 0) {
    throw new Error("order reverted on-chain");
  }

  const filledRaw = (order as { filled?: unknown }).filled;
  let filled: number | null =
    typeof filledRaw === "number" && Number.isFinite(filledRaw)
      ? filledRaw
      : null;
  if (filled == null) {
    const fromFills = sumFillsHuman(info?.fills, size);
    filled = Number.isFinite(fromFills) ? fromFills : null;
  }

  const txHash =
    (info as { hash?: string } | undefined)?.hash ||
    receipt?.transactionHash ||
    (order as { txHash?: string }).txHash;

  const fillStatus = classifyFill({
    requested: size,
    filled,
    submitted: Boolean(txHash),
  });

  return {
    txHash,
    filled: filled ?? 0,
    requested: size,
    fillStatus,
    orderStatus: (order as { status?: string }).status,
    symbol: ready.symbol,
  };
}

/** Prefer UnifiedOrder.filled; fall back to summing PlaceOrderResult.fills (raw → approx). */
function sumFillsHuman(
  fills: PlaceOrderResult["fills"] | undefined,
  requested: number,
): number {
  if (!fills || fills.length === 0) return 0;
  // quantityFilled is raw; without decimals we cannot convert accurately.
  // If UnifiedOrder.filled was missing, treat any on-receipt fill as unknown→use 0
  // only when fills array empty; otherwise approximate via presence.
  try {
    let raw = 0n;
    for (const f of fills) raw += BigInt(f.quantityFilled);
    if (raw === 0n) return 0;
    // Heuristic: if raw looks like human (small), use as-is; else leave as submitted via NaN path.
    if (raw <= BigInt(Math.ceil(requested * 1000))) {
      return Number(raw);
    }
  } catch {
    /* ignore */
  }
  // Fills present but scale unknown — mark as submitted by returning NaN for caller? 
  // Caller uses classifyFill: null → submitted. Return NaN → treat as null below.
  return Number.NaN;
}

export async function redeemWithWallet(
  exchange: SomniaMarkets,
  marketId: string,
): Promise<{ ok: boolean; txs: string[]; message: string }> {
  const me = exchange.walletAddress;
  if (!me) return { ok: false, txs: [], message: "Wallet not connected" };

  const oc = await exchange.client.getMarketOnchain(marketId as `0x${string}`);
  const anyOc = oc as unknown as {
    isResolved?: boolean;
    isVoided?: boolean;
    status?: number;
    yesId: bigint;
    noId: bigint;
    outcomeToken: string;
    marketAddress: string;
    winningOutcome?: number;
  };
  const isResolved = Boolean(anyOc.isResolved) || Number(anyOc.status) === 4;
  const isVoided = Boolean(anyOc.isVoided) || Number(anyOc.status) === 5;
  if (!isResolved && !isVoided) {
    return { ok: false, txs: [], message: "Market not Resolved/Voided yet" };
  }

  const trader = exchange.trader as unknown as {
    redeem: (args: Record<string, unknown>) => Promise<{
      receipt?: { transactionHash?: string; status?: string };
    }>;
  };

  const outcomeToken = anyOc.outcomeToken as `0x${string}`;
  const upBal = await exchange.client.getOutcomeBalance({
    outcomeToken,
    account: me,
    id: anyOc.yesId,
  });
  const downBal = await exchange.client.getOutcomeBalance({
    outcomeToken,
    account: me,
    id: anyOc.noId,
  });

  const toClaim: Array<{ outcomeIdx: 0 | 1; amount: bigint }> = [];
  if (isVoided) {
    if (upBal > 0n) toClaim.push({ outcomeIdx: 0, amount: upBal });
    if (downBal > 0n) toClaim.push({ outcomeIdx: 1, amount: downBal });
  } else {
    const win = Number(anyOc.winningOutcome);
    if (win === 0 && upBal > 0n) toClaim.push({ outcomeIdx: 0, amount: upBal });
    if (win === 1 && downBal > 0n) toClaim.push({ outcomeIdx: 1, amount: downBal });
  }

  if (toClaim.length === 0) {
    return { ok: true, txs: [], message: "Nothing to claim on this market" };
  }

  const txs: string[] = [];
  for (const c of toClaim) {
    const res = await trader.redeem({
      marketId: marketId as `0x${string}`,
      market: anyOc.marketAddress as `0x${string}`,
      outcomeToken,
      outcomeIdx: c.outcomeIdx,
      amount: c.amount,
    });
    if (res.receipt?.status === "reverted") throw new Error("redeem reverted");
    if (res.receipt?.transactionHash) txs.push(res.receipt.transactionHash);
  }
  return { ok: true, txs, message: `Redeemed ${toClaim.length} outcome(s)` };
}

export async function readFocusedBalances(
  marketId: string,
  account: string,
): Promise<{
  upBalance: string;
  downBalance: string;
  upBalanceRaw: string;
  downBalanceRaw: string;
  quoteDecimals: number;
  outcomeToken?: string;
} | null> {
  try {
    const exchange = createReadExchange();
    const oc = await exchange.client.getMarketOnchain(marketId as `0x${string}`);
    const anyOc = oc as unknown as {
      yesId: bigint;
      noId: bigint;
      outcomeToken: string;
      decimals?: number;
    };
    const decimals = Number(anyOc.decimals ?? 6);
    const outcomeToken = anyOc.outcomeToken as `0x${string}`;
    const acct = account as `0x${string}`;
    const upBal = await exchange.client.getOutcomeBalance({
      outcomeToken,
      account: acct,
      id: anyOc.yesId,
    });
    const downBal = await exchange.client.getOutcomeBalance({
      outcomeToken,
      account: acct,
      id: anyOc.noId,
    });
    return {
      upBalance: formatRawBalance(upBal, decimals),
      downBalance: formatRawBalance(downBal, decimals),
      upBalanceRaw: upBal.toString(),
      downBalanceRaw: downBal.toString(),
      quoteDecimals: decimals,
      outcomeToken,
    };
  } catch {
    return null;
  }
}

function isPayoutEligible(opts: {
  status: string;
  voided: boolean;
  winningOutcome?: number | null;
  outcomeIndex: number;
  balanceRaw: string;
}): boolean {
  if (!opts.balanceRaw || opts.balanceRaw === "0") return false;
  const settled =
    opts.voided ||
    opts.status === "Voided" ||
    opts.status === "Resolved" ||
    opts.status === "Finalized";
  if (!settled) return false;
  if (opts.voided || opts.status === "Voided") return true;
  if (opts.winningOutcome == null) return false;
  return Number(opts.winningOutcome) === opts.outcomeIndex;
}

export type WalletPortfolioView = {
  account: string;
  openPositions: WalletOpenPosition[];
  claimable: ClaimablePosition[];
  tradesTruncated: boolean;
};

/**
 * Connected-wallet portfolio via SDK getPortfolio (paginate trades if needed).
 * Claimable only when payout is eligible (winning side or voided).
 */
export async function fetchWalletPortfolio(
  account: string,
  opts?: { tradesLimit?: number },
): Promise<WalletPortfolioView | null> {
  try {
    const exchange = createReadExchange();
    const portfolio = await exchange.client.getPortfolio(account, {
      ordersLimit: 100,
      tradesLimit: opts?.tradesLimit ?? 50,
    });

    const byMarket = new Map<
      string,
      {
        marketId: string;
        asset: string;
        intervalSec: number;
        status: string;
        voided: boolean;
        winningOutcome?: number | null;
        quoteDecimals: number;
        upRaw: string;
        downRaw: string;
      }
    >();

    const openPositions: WalletOpenPosition[] = [];

    for (const pos of portfolio.positions) {
      const m = pos.market;
      const marketId = String(m.id || "").toLowerCase();
      if (!marketId) continue;
      const decimals = Number(m.quoteDecimals ?? 6);
      const intervalSec = Number(m.intervalSec ?? 0) || 0;
      const status = String(m.status || "Unknown");
      const voided = Boolean(m.voided);
      const winningOutcome =
        m.winningOutcome === undefined || m.winningOutcome === null
          ? null
          : Number(m.winningOutcome);
      const balanceRaw = String(pos.balance || "0");
      const side: Side = pos.outcomeIndex === 0 ? "Up" : "Down";
      const claimable = isPayoutEligible({
        status,
        voided,
        winningOutcome,
        outcomeIndex: pos.outcomeIndex,
        balanceRaw,
      });

      openPositions.push({
        marketId,
        asset: String(m.asset || "").toUpperCase(),
        intervalSec,
        status,
        outcomeIndex: pos.outcomeIndex,
        side,
        balance: formatRawBalance(balanceRaw, decimals),
        balanceRaw,
        quoteDecimals: decimals,
        winningOutcome,
        voided,
        claimable,
      });

      let row = byMarket.get(marketId);
      if (!row) {
        row = {
          marketId,
          asset: String(m.asset || "").toUpperCase(),
          intervalSec,
          status,
          voided,
          winningOutcome,
          quoteDecimals: decimals,
          upRaw: "0",
          downRaw: "0",
        };
        byMarket.set(marketId, row);
      }
      if (pos.outcomeIndex === 0) row.upRaw = balanceRaw;
      else row.downRaw = balanceRaw;
    }

    const claimable: ClaimablePosition[] = [];
    for (const row of byMarket.values()) {
      const settled =
        row.voided ||
        row.status === "Voided" ||
        row.status === "Resolved" ||
        row.status === "Finalized";
      if (!settled) continue;

      const upEligible = isPayoutEligible({
        status: row.status,
        voided: row.voided,
        winningOutcome: row.winningOutcome,
        outcomeIndex: 0,
        balanceRaw: row.upRaw,
      });
      const downEligible = isPayoutEligible({
        status: row.status,
        voided: row.voided,
        winningOutcome: row.winningOutcome,
        outcomeIndex: 1,
        balanceRaw: row.downRaw,
      });
      if (!upEligible && !downEligible) continue;

      claimable.push({
        marketId: row.marketId,
        asset: row.asset,
        intervalSec: row.intervalSec,
        status: row.voided || row.status === "Voided" ? "Voided" : "Resolved",
        upBalance: formatRawBalance(row.upRaw, row.quoteDecimals),
        downBalance: formatRawBalance(row.downRaw, row.quoteDecimals),
        upBalanceRaw: row.upRaw,
        downBalanceRaw: row.downRaw,
        quoteDecimals: row.quoteDecimals,
        winningOutcome: row.winningOutcome ?? undefined,
        payoutEligible: true,
      });
    }

    // Keep non-settled (and losing settled) holdings visible regardless of focus.
    return {
      account: portfolio.account,
      openPositions,
      claimable,
      tradesTruncated: Boolean(portfolio.tradesTruncated),
    };
  } catch {
    return null;
  }
}
