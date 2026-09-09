import type { PlaceOrderResult } from "@somnia-chain/markets-sdk";
import { getConfig } from "@/lib/config";
import {
  bookMid,
  decideExecutableSide,
  explainReason,
  impliedDownAsk,
  spotImpliedBias,
} from "@/lib/edge";
import { getExchange, oracleGraphUrl, statusLabel } from "@/lib/exchange";
import { withMutex } from "@/lib/mutex";
import { buildCopyOrderParams } from "@/lib/orderParams";
import { classifyFill, fillActivityTitle } from "@/lib/fillStatus";
import { formatRawBalance } from "@/lib/format";
import {
  appendActivity,
  getClaimable,
  getMarkets,
  readMeta,
  readSignal,
  setClaimable,
  setMarkets,
  writeMeta,
  writeSignal,
} from "@/lib/store";
import type {
  ClaimablePosition,
  DeskSignal,
  LastTrade,
  MarketSummary,
  Side,
  SpotSource,
} from "@/lib/types";
import { pickOutcomes } from "@/lib/outcomes";

function asNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "bigint") return Number(v);
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Refuse trading when SDK spot observation is older than this (ms). */
const MAX_SPOT_AGE_MS = 5 * 60 * 1000;

type OutcomeEntry = {
  marketSymbol: string;
  upSymbol: string;
  downSymbol?: string;
  row?: Record<string, unknown>;
};

/** listLiveBinaryMarkets rows have yesTokenId/noTokenId but no tradable symbols.
 *  loadMarkets() builds BTC-…/tUSDC#YES · #NO — index those by marketId. */
async function loadOutcomeIndex(
  exchange: ReturnType<typeof getExchange>,
): Promise<Map<string, OutcomeEntry>> {
  const byMarketId = new Map<string, OutcomeEntry>();
  try {
    const map = await exchange.loadMarkets(true);
    for (const m of Object.values(map) as unknown as Record<string, unknown>[]) {
      const info = m.info as Record<string, unknown> | undefined;
      const marketId = String(info?.marketId || m.id || "").toLowerCase();
      if (!marketId) continue;
      const picked = pickOutcomes(m);
      if (!picked.upSymbol) continue;
      byMarketId.set(marketId, {
        marketSymbol: picked.marketSymbol || String(m.symbol || ""),
        upSymbol: picked.upSymbol,
        downSymbol: picked.downSymbol,
        row: m,
      });
    }
  } catch {
    /* non-fatal — callers skip markets without symbols */
  }
  return byMarketId;
}

function attachOutcomes(
  m: Record<string, unknown>,
  entry: OutcomeEntry | undefined,
): Record<string, unknown> {
  if (!entry?.upSymbol) return m;
  return {
    ...m,
    symbol: entry.marketSymbol || m.symbol,
    outcomes: [
      { symbol: entry.upSymbol, label: "YES", index: 0 },
      ...(entry.downSymbol
        ? [{ symbol: entry.downSymbol, label: "NO", index: 1 }]
        : []),
    ],
  };
}

async function loadCandidateMarkets(exchange: ReturnType<typeof getExchange>) {
  const cfg = getConfig();
  const client = exchange.client as unknown as {
    listLiveBinaryMarkets?: (opts: Record<string, unknown>) => Promise<unknown[]>;
    listBinaryMarkets?: (opts: Record<string, unknown>) => Promise<unknown[]>;
  };

  let rows: Record<string, unknown>[] = [];
  try {
    if (typeof client.listLiveBinaryMarkets === "function") {
      rows = (await client.listLiveBinaryMarkets({
        venueId: cfg.venueId,
        limit: 50,
      })) as Record<string, unknown>[];
    } else if (typeof client.listBinaryMarkets === "function") {
      rows = (await client.listBinaryMarkets({
        venueId: cfg.venueId,
        status: "Trading",
        limit: 50,
      })) as Record<string, unknown>[];
    }
  } catch (err) {
    // Fallback: loadMarkets map
    try {
      const map = await exchange.loadMarkets(true);
      rows = Object.values(map).map((m) => {
        const anyM = m as {
          info?: Record<string, unknown>;
          symbol?: string;
          active?: boolean;
          outcomes?: unknown;
        };
        return {
          ...(anyM.info || {}),
          symbol: anyM.symbol,
          outcomes: anyM.outcomes,
          active: anyM.active,
        };
      });
    } catch (e2) {
      throw err instanceof Error ? err : e2;
    }
  }

  // Enrich live indexer rows with #YES/#NO tradable symbols from loadMarkets.
  const outcomeIndex = await loadOutcomeIndex(exchange);

  // Prefer BTC 15m: if listLive missed a still-Trading preferred market that
  // loadMarkets knows about, admit only that preferred asset/interval slice.
  if (outcomeIndex.size > 0) {
    const seen = new Set(
      rows.map((r) => String(r.marketId || "").toLowerCase()).filter(Boolean),
    );
    for (const [marketId, entry] of outcomeIndex) {
      if (seen.has(marketId) || !entry.row) continue;
      const info = (entry.row.info as Record<string, unknown> | undefined) || {};
      const status = String(info.status || "").toLowerCase();
      if (status && status !== "trading") continue;
      const asset = String(info.asset || "").toUpperCase();
      const intervalSec = asNum(info.intervalSec) ?? 0;
      if (asset !== cfg.preferredAsset) continue;
      if (intervalSec !== cfg.preferredIntervalSec) continue;
      rows.push({
        ...info,
        symbol: entry.row.symbol ?? entry.marketSymbol,
        outcomes: entry.row.outcomes,
        marketId: info.marketId || marketId,
      });
      seen.add(marketId);
    }
  }

  const now = Date.now() / 1000;
  const scored = rows
    .map((m) => {
      const marketId = String(m.marketId || "");
      const enriched = attachOutcomes(
        m,
        outcomeIndex.get(marketId.toLowerCase()),
      );
      const asset = String(
        enriched.asset || enriched.underlying || "",
      ).toUpperCase();
      const intervalSec = asNum(enriched.intervalSec) ?? 0;
      const expiry = asNum(enriched.expiry) ?? 0;
      const secondsLeft = expiry - now;
      const { upSymbol, downSymbol } = pickOutcomes(enriched);
      return {
        m: enriched,
        asset,
        intervalSec,
        expiry,
        marketId,
        secondsLeft,
        upSymbol,
        downSymbol,
      };
    })
    // Prefer BTC 15m when present; always require a tradeable Up (#YES) symbol.
    .filter((x) => x.marketId && x.secondsLeft > 60 && Boolean(x.upSymbol));

  // Hard-prefer PREFERRED_INTERVAL_SEC (BTC 15m). Skip daily/86400 whenever a
  // preferred-interval Trading candidate exists for the preferred asset.
  const hasPreferredWindow = scored.some(
    (x) =>
      x.asset === cfg.preferredAsset &&
      x.intervalSec === cfg.preferredIntervalSec,
  );
  const pool = hasPreferredWindow
    ? scored.filter((x) => x.intervalSec !== 86400)
    : scored;

  pool.sort((a, b) => {
    const prefA =
      (a.asset === cfg.preferredAsset ? 0 : 1) * 100 +
      (a.intervalSec === cfg.preferredIntervalSec ? 0 : 1) * 10 +
      (a.intervalSec === 86400 ? 1 : 0);
    const prefB =
      (b.asset === cfg.preferredAsset ? 0 : 1) * 100 +
      (b.intervalSec === cfg.preferredIntervalSec ? 0 : 1) * 10 +
      (b.intervalSec === 86400 ? 1 : 0);
    if (prefA !== prefB) return prefA - prefB;
    // Among non-preferred windows, prefer shorter cadences (closer to 15m).
    if (a.intervalSec !== b.intervalSec) return a.intervalSec - b.intervalSec;
    return b.secondsLeft - a.secondsLeft;
  });

  return pool;
}

async function readSpotSdk(
  exchange: ReturnType<typeof getExchange>,
  asset: string,
): Promise<{ spot: number; updatedAtMs: number | null } | null> {
  try {
    const p = await exchange.fetchPrice(asset);
    if (p == null) return null;
    if (typeof p === "object") {
      const row = p as { price?: unknown; timestamp?: unknown; datetime?: unknown };
      const n = asNum(row.price);
      if (n == null || n <= 0) return null;
      let updatedAtMs = asNum(row.timestamp);
      // UnifiedPrice.timestamp is ms; LivePrice.blockTimestamp is unix seconds.
      if (updatedAtMs != null && updatedAtMs > 0 && updatedAtMs < 1e12) {
        updatedAtMs = updatedAtMs * 1000;
      }
      return { spot: n, updatedAtMs };
    }
    const n = asNum(p);
    if (n != null && n > 0) return { spot: n, updatedAtMs: null };
  } catch {
    /* ignore */
  }
  return null;
}

/** Display-only fallback — never drives recommendedSide / agent trades. */
async function readSpotCoinGecko(asset: string): Promise<number | null> {
  try {
    const id = asset === "ETH" ? "ethereum" : "bitcoin";
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
    );
    if (res.ok) {
      const json = (await res.json()) as Record<string, { usd?: number }>;
      const n = json[id]?.usd;
      if (n && n > 0) return n;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function readSpotLabeled(
  exchange: ReturnType<typeof getExchange>,
  asset: string,
): Promise<{
  spot: number | null;
  source: SpotSource;
  updatedAtMs: number | null;
}> {
  const sdk = await readSpotSdk(exchange, asset);
  if (sdk != null) {
    return { spot: sdk.spot, source: "sdk", updatedAtMs: sdk.updatedAtMs };
  }
  const cg = await readSpotCoinGecko(asset);
  if (cg != null) return { spot: cg, source: "coingecko", updatedAtMs: null };
  return { spot: null, source: "none", updatedAtMs: null };
}

/** OracleHub / explorer answers use 2 decimal places (ORACLE_PRICE_DECIMALS). */
const ORACLE_PRICE_SCALE = 100;

/**
 * Convert a raw oracle numericValue / strike into human USD units (same as spot).
 * Prefer opening-price scale (/100). Reject values that are clearly 50–200× spot.
 */
function normalizeOraclePrice(
  raw: number,
  spot?: number | null,
): number | null {
  if (!Number.isFinite(raw) || raw <= 0) return null;

  let human: number;
  if (raw >= 1e14) {
    // Price-feed adapter answers are 1e18-scaled.
    human = raw / 1e18;
  } else {
    // OracleHub reference/strike: cents-style 2-decimal encoding.
    human = raw / ORACLE_PRICE_SCALE;
  }

  if (spot != null && spot > 0) {
    const ratio = human / spot;
    // Already sensible vs spot.
    if (ratio >= 0.2 && ratio <= 5) return human;
    // Classic bug: forgot /100 → ~100× spot. Repair once.
    const repaired = human / ORACLE_PRICE_SCALE;
    const repairedRatio = repaired / spot;
    if (ratio >= 50 && ratio <= 200 && repairedRatio >= 0.2 && repairedRatio <= 5) {
      return repaired;
    }
    // Raw looked already-human (no /100 needed).
    const rawRatio = raw / spot;
    if (rawRatio >= 0.2 && rawRatio <= 5) return raw;
    // Still mangled (50–200× or worse) — refuse rather than fake a −99% move.
    if (ratio > 20 || ratio < 0.05) return null;
  }

  return human;
}

function extractOracleNumeric(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") {
    return asNum(v);
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return (
      asNum(o.openingPrice) ??
      asNum(o.price) ??
      asNum(o.numericValue) ??
      asNum((o.openingAnswer as { numericValue?: unknown } | undefined)?.numericValue) ??
      null
    );
  }
  return null;
}

async function readReference(
  exchange: ReturnType<typeof getExchange>,
  marketId: string,
  row: Record<string, unknown>,
  spot?: number | null,
): Promise<number | null> {
  // Prefer the window opening price (reference-mode markets have strike 0).
  try {
    const client = exchange.client as unknown as {
      getOpeningPrices?: (ids: string[]) => Promise<unknown>;
    };
    if (typeof client.getOpeningPrices === "function") {
      const opens = await client.getOpeningPrices([marketId]);
      if (Array.isArray(opens) && opens[0] != null) {
        const n = extractOracleNumeric(opens[0]);
        const human = n != null ? normalizeOraclePrice(n, spot) : null;
        if (human != null) return human;
      } else if (opens && typeof opens === "object") {
        const map = opens as Record<string, unknown>;
        const key = marketId.toLowerCase();
        const rawVal =
          map[key] ??
          map[marketId] ??
          Object.values(map).find((v) => v != null);
        const n = extractOracleNumeric(rawVal);
        const human = n != null ? normalizeOraclePrice(n, spot) : null;
        if (human != null) return human;
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const client = exchange.client as unknown as {
      getMarketResolution?: (id: string) => Promise<Record<string, unknown>>;
    };
    if (typeof client.getMarketResolution === "function") {
      const res = await client.getMarketResolution(marketId);
      const opening = res?.openingAnswer as { numericValue?: unknown } | undefined;
      const n = asNum(opening?.numericValue);
      const human = n != null ? normalizeOraclePrice(n, spot) : null;
      if (human != null) return human;
    }
  } catch {
    /* ignore */
  }

  // Fixed-strike markets: strike itself is the threshold (same oracle scale).
  const strike = asNum(row.strike);
  if (strike != null && strike > 0) {
    const human = normalizeOraclePrice(strike, spot);
    if (human != null) return human;
  }

  return null;
}

async function placeIoc(
  exchange: ReturnType<typeof getExchange>,
  symbol: string,
  side: Side,
  size: number,
  limitPrice: number,
): Promise<{ txHash?: string; filled?: number }> {
  const order = await exchange.createOrder(
    symbol,
    "limit",
    "buy",
    size,
    limitPrice,
    { timeInForce: "IOC" },
  );
  const info = order.info as PlaceOrderResult | undefined;
  const receipt = info?.receipt as { transactionHash?: string; status?: string | number } | undefined;
  if (receipt?.status === "reverted" || receipt?.status === 0) {
    throw new Error("order reverted on-chain");
  }
  return {
    txHash: (info as { hash?: string } | undefined)?.hash || receipt?.transactionHash,
    filled: asNum((order as { filled?: unknown }).filled) ?? undefined,
  };
}

export async function scanClaimable(
  exchange: ReturnType<typeof getExchange>,
): Promise<ClaimablePosition[]> {
  const cfg = getConfig();
  const me = (exchange as unknown as { walletAddress?: string }).walletAddress;
  if (!me) return [];

  const client = exchange.client as unknown as {
    listBinaryMarkets?: (opts: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    getMarketOnchain: (id: `0x${string}`) => Promise<Record<string, unknown>>;
    getOutcomeBalance: (args: {
      outcomeToken: string;
      account: string;
      id: bigint | string;
    }) => Promise<bigint>;
  };

  if (typeof client.listBinaryMarkets !== "function") return [];

  let settled: Record<string, unknown>[] = [];
  try {
    settled = await client.listBinaryMarkets({
      venueId: cfg.venueId,
      status: "Finalized",
      limit: 40,
    });
  } catch {
    return [];
  }

  settled = [...settled].sort(
    (a, b) => (asNum(b.expiry) ?? 0) - (asNum(a.expiry) ?? 0),
  );

  const out: ClaimablePosition[] = [];
  for (const m of settled.slice(0, 15)) {
    const marketId = String(m.marketId || "");
    if (!marketId) continue;
    try {
      const oc = await client.getMarketOnchain(marketId as `0x${string}`);
      const isResolved = Boolean(oc.isResolved) || Number(oc.status) === 4;
      const isVoided = Boolean(oc.isVoided) || Number(oc.status) === 5;
      if (!isResolved && !isVoided) continue;

      const upBal = await client.getOutcomeBalance({
        outcomeToken: String(oc.outcomeToken),
        account: me,
        id: oc.yesId as bigint,
      });
      const downBal = await client.getOutcomeBalance({
        outcomeToken: String(oc.outcomeToken),
        account: me,
        id: oc.noId as bigint,
      });
      if (upBal === 0n && downBal === 0n) continue;

      const win = asNum(oc.winningOutcome);
      const decimals = Number((oc as { decimals?: number }).decimals ?? 6);
      // Only mark claimable when payout is eligible (voided any side, or winning side).
      let eligibleUp = false;
      let eligibleDown = false;
      if (isVoided) {
        eligibleUp = upBal > 0n;
        eligibleDown = downBal > 0n;
      } else if (win === 0) {
        eligibleUp = upBal > 0n;
      } else if (win === 1) {
        eligibleDown = downBal > 0n;
      }
      if (!eligibleUp && !eligibleDown) continue;

      const qid = String(m.oracleQuestionId || oc.oracleQuestionId || "");
      out.push({
        marketId,
        asset: String(m.asset || "").toUpperCase(),
        intervalSec: asNum(m.intervalSec) ?? 0,
        status: isVoided ? "Voided" : "Resolved",
        upBalance: formatRawBalance(upBal, decimals),
        downBalance: formatRawBalance(downBal, decimals),
        upBalanceRaw: upBal.toString(),
        downBalanceRaw: downBal.toString(),
        quoteDecimals: decimals,
        winningOutcome: win ?? undefined,
        oracleQuestionId: qid || undefined,
        oracleGraphUrl: oracleGraphUrl(qid),
        payoutEligible: true,
      });
    } catch {
      /* skip row */
    }
  }
  return out;
}

export async function claimMarket(marketId: string): Promise<{
  ok: boolean;
  txs: string[];
  message: string;
}> {
  const cfg = getConfig();
  if (cfg.dryRun) {
    return { ok: true, txs: [], message: "DRY_RUN: would redeem claimable outcomes" };
  }
  if (!cfg.privateKey) {
    return { ok: false, txs: [], message: "PRIVATE_KEY required for server claim — use connected wallet instead" };
  }

  const exchange = getExchange();
  const me = (exchange as unknown as { walletAddress?: string }).walletAddress;
  if (!me) return { ok: false, txs: [], message: "No wallet on exchange" };

  const oc = await exchange.client.getMarketOnchain(marketId as `0x${string}`);
  const isResolved = Boolean((oc as unknown as { isResolved?: boolean }).isResolved) || Number((oc as unknown as { status?: number }).status) === 4;
  const isVoided = Boolean((oc as unknown as { isVoided?: boolean }).isVoided) || Number((oc as unknown as { status?: number }).status) === 5;
  if (!isResolved && !isVoided) {
    return { ok: false, txs: [], message: "Market not Resolved/Voided yet" };
  }

  const trader = exchange.trader as unknown as {
    redeem: (args: Record<string, unknown>) => Promise<{ receipt?: { transactionHash?: string; status?: string } }>;
  };

  const yesId = (oc as unknown as { yesId: bigint }).yesId;
  const noId = (oc as unknown as { noId: bigint }).noId;
  const outcomeToken = (oc as unknown as { outcomeToken: string }).outcomeToken as `0x${string}`;
  const marketAddress = (oc as unknown as { marketAddress: string }).marketAddress as `0x${string}`;
  const account = me as `0x${string}`;

  const upBal = await exchange.client.getOutcomeBalance({
    outcomeToken,
    account,
    id: yesId,
  });
  const downBal = await exchange.client.getOutcomeBalance({
    outcomeToken,
    account,
    id: noId,
  });

  const toClaim: Array<{ outcomeIdx: 0 | 1; amount: bigint }> = [];
  if (isVoided) {
    if (upBal > 0n) toClaim.push({ outcomeIdx: 0, amount: upBal });
    if (downBal > 0n) toClaim.push({ outcomeIdx: 1, amount: downBal });
  } else {
    const win = Number((oc as unknown as { winningOutcome?: number }).winningOutcome);
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
      market: marketAddress,
      outcomeToken,
      outcomeIdx: c.outcomeIdx,
      amount: c.amount,
    });
    if (res.receipt?.status === "reverted") {
      throw new Error("redeem reverted");
    }
    if (res.receipt?.transactionHash) txs.push(res.receipt.transactionHash);
  }
  await appendActivity({
    kind: "claim",
    at: new Date().toISOString(),
    title: `Claimed ${toClaim.length} outcome(s)`,
    detail: txs.length ? `txs: ${txs.join(", ")}` : undefined,
    marketId,
    txHash: txs[0],
  });
  return { ok: true, txs, message: `Redeemed ${toClaim.length} outcome(s)` };
}

export async function copyLastTrade(): Promise<{
  ok: boolean;
  message: string;
  trade?: LastTrade;
}> {
  const cfg = getConfig();
  const signal = await readSignal();
  // Only current recommendedSide on the current market — never a stale lastTrade side.
  const side = signal?.recommendedSide as Side | null;
  if (!signal || !side) {
    return {
      ok: false,
      message: "No current qualifying recommendation to trade",
    };
  }
  if (
    signal.lastTrade?.marketId &&
    signal.marketId &&
    signal.lastTrade.marketId.toLowerCase() !== signal.marketId.toLowerCase()
  ) {
    // Ignore mismatched lastTrade; side already comes from recommendedSide only.
  }

  const built = buildCopyOrderParams({
    side,
    upSymbol: signal.upSymbol,
    downSymbol: signal.downSymbol,
    upBid: signal.upBid,
    upAsk: signal.upAsk,
    downAsk: signal.downAsk ?? null,
    size: cfg.copySize,
    marketId: signal.marketId,
    edge: signal.edge,
    bias: signal.spotImpliedBias,
    minEdge: signal.edgeThreshold ?? cfg.edgeThreshold,
  });
  if (!built.ok) return { ok: false, message: built.message };
  const { symbol, size, limitPrice: limit } = built.params;

  if (cfg.dryRun) {
    const trade: LastTrade = {
      marketId: signal.marketId,
      symbol,
      side,
      size,
      price: limit,
      edge: signal.edge ?? 0,
      reason: `Copy (dry-run): mirror agent ${side} @ ${limit.toFixed(3)}`,
      dryRun: true,
      at: new Date().toISOString(),
      filledQty: 0,
      fillStatus: "signal",
    };
    await writeSignal({ ...signal, lastTrade: trade, updatedAt: trade.at });
    await appendActivity({
      kind: "copy",
      at: trade.at,
      title: `Copy ${trade.side} signal (dry)`,
      detail: trade.reason,
      marketId: trade.marketId,
      asset: signal.asset,
      side: trade.side,
      edge: trade.edge,
      dryRun: true,
      fillStatus: "signal",
      filledQty: 0,
    });
    return { ok: true, message: "DRY_RUN copy recorded as signal (dry)", trade };
  }

  if (!cfg.privateKey) {
    return { ok: false, message: "PRIVATE_KEY required for server copy — use connected wallet instead" };
  }

  const exchange = getExchange();
  const onchain = await exchange.client.getMarketOnchain(
    signal.marketId as `0x${string}`,
  );
  if (Number((onchain as { status?: number }).status) !== 1) {
    return { ok: false, message: "Market not in Trading status — cannot copy" };
  }

  const result = await placeIoc(exchange, symbol, side, size, limit);
  const filledQty =
    result.filled != null && Number.isFinite(result.filled) ? result.filled : null;
  const fillStatus = classifyFill({
    requested: size,
    filled: filledQty,
    submitted: Boolean(result.txHash),
  });
  const trade: LastTrade = {
    marketId: signal.marketId,
    symbol,
    side,
    size,
    price: limit,
    edge: signal.edge ?? 0,
    reason:
      fillStatus === "zero-fill"
        ? `Copy ${side} submitted but filled qty 0`
        : `Copied agent ${side}`,
    txHash: result.txHash,
    dryRun: false,
    at: new Date().toISOString(),
    filledQty: filledQty ?? undefined,
    fillStatus,
  };
  await writeSignal({ ...signal, lastTrade: trade, updatedAt: trade.at });
  await appendActivity({
    kind: "copy",
    at: trade.at,
    title: `Copy ${fillActivityTitle(trade.side, fillStatus, filledQty)}`,
    detail: trade.reason,
    marketId: trade.marketId,
    asset: signal.asset,
    side: trade.side,
    edge: trade.edge,
    txHash: trade.txHash,
    dryRun: false,
    fillStatus,
    filledQty: filledQty ?? undefined,
  });
  const ok = fillStatus !== "zero-fill";
  return {
    ok,
    message:
      fillStatus === "zero-fill"
        ? "Copy tx mined with zero fill"
        : fillStatus === "partial"
          ? `Copy partial fill qty ${filledQty}`
          : fillStatus === "full"
            ? `Copy filled qty ${filledQty}`
            : "Copy order submitted",
    trade,
  };
}

export async function runAgentTick(): Promise<DeskSignal> {
  return withMutex(() => runAgentTickUnlocked());
}

async function runAgentTickUnlocked(): Promise<DeskSignal> {
  const cfg = getConfig();
  const meta = await readMeta();
  const updatedAt = new Date().toISOString();

  if (meta.paused) {
    const prev = await readSignal();
    const pausedSignal: DeskSignal = {
      ...(prev || {
        marketId: "",
        symbol: "",
        upSymbol: "",
        downSymbol: "",
        asset: cfg.preferredAsset,
        intervalSec: cfg.preferredIntervalSec,
        expiry: 0,
        status: "Unknown" as const,
        statusCode: -1,
        upBid: null,
        upAsk: null,
        upMid: null,
        spot: null,
        reference: null,
        spotImpliedBias: null,
        edge: null,
        recommendedSide: null,
        reason: "Agent paused",
        dryRun: cfg.dryRun,
        edgeThreshold: cfg.edgeThreshold,
        copySize: cfg.copySize,
        lastTrade: null,
      }),
      reason: "Agent paused — signal loop idle (resume in Settings).",
      dryRun: cfg.dryRun,
      updatedAt,
      preferredMissing: prev?.preferredMissing,
    };
    await writeSignal(pausedSignal);
    await writeMeta({
      ...meta,
      agentRunning: true,
      lastTickAt: updatedAt,
      lastError: undefined,
    });
    return pausedSignal;
  }

  const exchange = getExchange();
  const focusMarketId = (meta.focusMarketId || "").toLowerCase() || null;

  let tradedThisTick = false;
  let signal: DeskSignal = {
    marketId: "",
    symbol: "",
    upSymbol: "",
    downSymbol: "",
    asset: cfg.preferredAsset,
    intervalSec: cfg.preferredIntervalSec,
    expiry: 0,
    status: "Unknown",
    statusCode: -1,
    upBid: null,
    upAsk: null,
    upMid: null,
    spot: null,
    spotSource: "none",
    reference: null,
    spotImpliedBias: null,
    edge: null,
    recommendedSide: null,
    reason: "Scanning live binary markets…",
    dryRun: cfg.dryRun,
    edgeThreshold: cfg.edgeThreshold,
    copySize: cfg.copySize,
    updatedAt,
    lastTrade: (await readSignal())?.lastTrade ?? null,
    preferredMissing: false,
  };

  try {
    const candidates = await loadCandidateMarkets(exchange);

    const preferredMissing = !candidates.some(
      (c) =>
        c.asset === cfg.preferredAsset &&
        c.intervalSec === cfg.preferredIntervalSec,
    );
    signal.preferredMissing = preferredMissing;

    // Enrich markets list with per-row book mids (best-effort, capped).
    const marketRows: MarketSummary[] = [];
    for (const c of candidates.slice(0, 24)) {
      let upMid: number | null = null;
      let midFresh = false;
      const upSym = c.upSymbol;
      if (upSym) {
        try {
          const book = await exchange.fetchOrderBook(upSym, 3);
          const bid = asNum(book.bids?.[0]?.[0]);
          const ask = asNum(book.asks?.[0]?.[0]);
          upMid = bookMid(bid, ask);
          midFresh = upMid != null;
        } catch {
          upMid = null;
        }
      }
      marketRows.push({
        marketId: c.marketId,
        asset: c.asset || cfg.preferredAsset,
        intervalSec: c.intervalSec,
        expiry: c.expiry,
        status: "Trading",
        statusCode: 1,
        upMid,
        midFresh,
        symbol: String(c.m.symbol || ""),
        upSymbol: upSym,
        secondsLeft: Math.max(0, Math.floor(c.secondsLeft)),
      });
    }
    setMarkets(marketRows);

    if (candidates.length === 0) {
      signal.reason =
        "No live binary markets found for this venue — check VENUE_ID / NETWORK.";
      await writeSignal(signal);
      await writeMeta({
        ...meta,
        agentRunning: true,
        lastTickAt: updatedAt,
      });
      await appendActivity({
        kind: "tick",
        at: updatedAt,
        title: "No live markets",
        detail: signal.reason,
      });
      return signal;
    }

    let chosen: (typeof candidates)[number] | null = null;
    let onchain: Record<string, unknown> | null = null;
    let skippedNoSymbol = 0;

    // Prefer explicit ?market= focus when still Trading.
    const ordered = [...candidates];
    if (focusMarketId) {
      ordered.sort((a, b) => {
        const af = a.marketId.toLowerCase() === focusMarketId ? 0 : 1;
        const bf = b.marketId.toLowerCase() === focusMarketId ? 0 : 1;
        return af - bf;
      });
    }

    for (const c of ordered) {
      try {
        const oc = await exchange.client.getMarketOnchain(
          c.marketId as `0x${string}`,
        );
        const status = Number((oc as unknown as { status?: number }).status);
        if (status !== 1) continue;
        const { upSymbol } = pickOutcomes(c.m);
        if (!upSymbol && !c.upSymbol) {
          skippedNoSymbol += 1;
          continue;
        }
        chosen = c;
        onchain = oc as unknown as Record<string, unknown>;
        break;
      } catch {
        continue;
      }
    }

    if (!chosen || !onchain) {
      signal.reason =
        skippedNoSymbol > 0
          ? "Trading markets found but none have resolvable Up/Down (#YES/#NO) symbols."
          : "Live markets found but none currently on-chain Trading (status=1).";
      await writeSignal(signal);
      await writeMeta({
        ...meta,
        agentRunning: true,
        lastTickAt: updatedAt,
      });
      return signal;
    }

    const picked = pickOutcomes(chosen.m);
    const upSymbol = picked.upSymbol || chosen.upSymbol;
    const downSymbol = picked.downSymbol || chosen.downSymbol;
    if (!upSymbol) {
      signal.reason = "Selected market has no Up outcome symbol.";
      signal.marketId = chosen.marketId;
      await writeSignal(signal);
      return signal;
    }

    const statusCode = Number(onchain.status);
    const qid = String(
      chosen.m.oracleQuestionId || onchain.oracleQuestionId || "",
    );

    signal = {
      ...signal,
      marketId: chosen.marketId,
      symbol: String(picked.marketSymbol || chosen.m.symbol || upSymbol),
      upSymbol,
      downSymbol: downSymbol || "",
      asset: chosen.asset || cfg.preferredAsset,
      intervalSec: chosen.intervalSec,
      expiry: chosen.expiry,
      tradingStart: asNum(chosen.m.tradingStart) ?? undefined,
      status: statusLabel(statusCode),
      statusCode,
      oracleQuestionId: qid || undefined,
      oracleGraphUrl: oracleGraphUrl(qid),
      preferredMissing,
    };

    // Drop lastTrade when the focused market window changes.
    if (
      signal.lastTrade &&
      signal.lastTrade.marketId.toLowerCase() !== chosen.marketId.toLowerCase()
    ) {
      signal.lastTrade = null;
    }

    let upBid: number | null = null;
    let upAsk: number | null = null;
    let downAsk: number | null = null;
    try {
      const book = await exchange.fetchOrderBook(upSymbol, 5);
      upBid = asNum(book.bids?.[0]?.[0]);
      upAsk = asNum(book.asks?.[0]?.[0]);
    } catch (e) {
      signal.error = `Book read failed: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (downSymbol) {
      try {
        const dbook = await exchange.fetchOrderBook(downSymbol, 5);
        downAsk = asNum(dbook.asks?.[0]?.[0]);
      } catch {
        /* optional */
      }
    }
    const downAskExec = impliedDownAsk(upBid, downAsk);
    const mid = bookMid(upBid, upAsk);
    signal.upBid = upBid;
    signal.upAsk = upAsk;
    signal.downAsk = downAskExec;
    signal.upMid = mid;

    const {
      spot,
      source: spotSource,
      updatedAtMs: spotUpdatedAtMs,
    } = await readSpotLabeled(exchange, signal.asset);
    signal.spotSource = spotSource;
    signal.spotUpdatedAt =
      spotUpdatedAtMs != null ? new Date(spotUpdatedAtMs).toISOString() : null;

    // Only SDK spot drives edge / recommendations. CoinGecko is display-only.
    let spotForEdge = spotSource === "sdk" ? spot : null;
    const spotStale =
      spotForEdge != null &&
      spotUpdatedAtMs != null &&
      Date.now() - spotUpdatedAtMs > MAX_SPOT_AGE_MS;
    if (spotStale) {
      spotForEdge = null;
    }

    // Never fabricate reference from current spot — wait for opening/strike.
    const reference = await readReference(
      exchange,
      chosen.marketId,
      chosen.m,
      spotForEdge ?? spot,
    );

    signal.spot = spot;
    signal.reference = reference;

    if (spotSource !== "sdk" || spotStale) {
      signal.spotImpliedBias = null;
      signal.edge = null;
      signal.recommendedSide = null;
      if (spotStale) {
        signal.reason = `${signal.asset} SDK spot is stale (${signal.spotUpdatedAt}) — refusing to trade on old prices.`;
      } else {
        const feedLabel =
          spotSource === "coingecko"
            ? "CoinGecko (display only)"
            : "no SDK spot feed";
        signal.reason =
          mid == null
            ? `${signal.asset} book empty and ${feedLabel} — neutral, no trade signal.`
            : `${signal.asset} spot from ${feedLabel}; refusing to invent edge for trading. Book mid ${((mid ?? 0) * 100).toFixed(1)}%. Connect SDK price feed for signals.`;
      }
    } else if (reference == null) {
      signal.spotImpliedBias = null;
      signal.edge = null;
      signal.recommendedSide = null;
      signal.reason = `Waiting for ${signal.asset} opening/strike reference — no trade until settlement boundary is known.`;
    } else if (spotForEdge == null) {
      signal.spotImpliedBias = null;
      signal.edge = null;
      signal.recommendedSide = null;
      signal.reason = `Waiting for ${signal.asset} SDK spot — no trade signal.`;
    } else {
      const bias = spotImpliedBias(spotForEdge, reference);
      signal.spotImpliedBias = bias;
      const decided = decideExecutableSide({
        bias,
        mid,
        upAsk,
        downAsk: downAskExec,
        threshold: cfg.edgeThreshold,
      });
      const side = decided.side;
      // Surface model mid edge for honesty; recommendation uses executable.
      signal.edge = side != null ? decided.execEdge : decided.midEdge;
      signal.recommendedSide = side;
      signal.reason = explainReason({
        asset: signal.asset,
        spot: spotForEdge,
        reference,
        bias,
        mid,
        edge: decided.midEdge,
        side,
        threshold: cfg.edgeThreshold,
        execCost: decided.execCost,
        execEdge: decided.execEdge,
        rejectedForCost: decided.rejectedForCost,
      });
      if (preferredMissing) {
        signal.reason += ` (preferred ${cfg.preferredAsset} ${cfg.preferredIntervalSec}s window not live — showing best available)`;
      }

      // Server agent is signal-only unless AGENT_TRADE=true and DRY_RUN=false.
      // Record a dry "would trade" lastTrade for Copy UX without sending orders.
      if (side && statusCode === 1 && mid != null) {
        const tradeSymbol = side === "Up" ? upSymbol : downSymbol || upSymbol;
        let limit: number | null = null;
        if (side === "Up") {
          if (upAsk != null) limit = Math.min(0.99, upAsk + 0.02);
          else signal.reason += " (no ask to cross — skipped)";
        } else {
          if (downAskExec != null && downSymbol) {
            limit = Math.min(0.99, downAskExec + 0.02);
          } else {
            signal.reason += " (no Down liquidity — skipped)";
          }
        }

        if (limit != null && tradeSymbol) {
          const tradeEdge = decided.execEdge ?? decided.midEdge ?? 0;
          if (cfg.dryRun || !cfg.agentTrade) {
            const tradeAt = new Date().toISOString();
            signal.lastTrade = {
              marketId: signal.marketId,
              symbol: tradeSymbol,
              side,
              size: cfg.copySize,
              price: limit,
              edge: tradeEdge,
              reason: signal.reason,
              dryRun: true,
              at: tradeAt,
              filledQty: 0,
              fillStatus: "signal",
            };
            tradedThisTick = true;
          } else if (cfg.privateKey) {
            try {
              const res = await placeIoc(
                exchange,
                tradeSymbol,
                side,
                cfg.copySize,
                limit,
              );
              const tradeAt = new Date().toISOString();
              const filledQty =
                res.filled != null && Number.isFinite(res.filled)
                  ? res.filled
                  : null;
              const fillStatus = classifyFill({
                requested: cfg.copySize,
                filled: filledQty,
                submitted: Boolean(res.txHash),
              });
              signal.lastTrade = {
                marketId: signal.marketId,
                symbol: tradeSymbol,
                side,
                size: cfg.copySize,
                price: limit,
                edge: tradeEdge,
                reason:
                  fillStatus === "zero-fill"
                    ? `${signal.reason} (zero-fill)`
                    : signal.reason,
                txHash: res.txHash,
                dryRun: false,
                at: tradeAt,
                filledQty: filledQty ?? undefined,
                fillStatus,
              };
              tradedThisTick = true;
            } catch (e) {
              signal.error = `Order failed: ${e instanceof Error ? e.message : String(e)}`;
            }
          } else {
            signal.reason += " (signal-only — connect wallet to trade)";
          }
        }
      }
    }

    try {
      // Claimable scan is server-wallet scoped; keep for demo ops when key present.
      const claimable = await scanClaimable(exchange);
      setClaimable(claimable);
    } catch {
      /* non-fatal */
    }
  } catch (e) {
    signal.error = e instanceof Error ? e.message : String(e);
    signal.reason = `Agent tick error: ${signal.error}`;
  }

  signal.updatedAt = new Date().toISOString();
  signal.dryRun = cfg.dryRun;

  if (signal.marketId) {
    const existing = getMarkets();
    const row: MarketSummary = {
      marketId: signal.marketId,
      asset: signal.asset,
      intervalSec: signal.intervalSec,
      expiry: signal.expiry,
      status: signal.status,
      statusCode: signal.statusCode,
      upMid: signal.upMid,
      midFresh: signal.upMid != null,
      symbol: signal.symbol,
      upSymbol: signal.upSymbol,
      secondsLeft: signal.expiry
        ? Math.max(0, Math.floor(signal.expiry - Date.now() / 1000))
        : undefined,
    };
    const others = existing.filter(
      (m) => m.marketId.toLowerCase() !== signal.marketId.toLowerCase(),
    );
    setMarkets([row, ...others].slice(0, 24));
  }

  await writeSignal(signal);
  await writeMeta({
    ...meta,
    agentRunning: true,
    lastTickAt: signal.updatedAt,
    lastError: signal.error,
  });

  // Fix: don't compare lastTrade.at === updatedAt (rewritten later). Use flag.
  if (tradedThisTick && signal.lastTrade) {
    const fs =
      signal.lastTrade.fillStatus ||
      (signal.lastTrade.dryRun ? "signal" : "submitted");
    await appendActivity({
      kind: "trade",
      at: signal.lastTrade.at,
      title: fillActivityTitle(
        signal.lastTrade.side,
        fs,
        signal.lastTrade.filledQty,
      ),
      detail: signal.lastTrade.reason,
      marketId: signal.lastTrade.marketId,
      asset: signal.asset,
      side: signal.lastTrade.side,
      edge: signal.lastTrade.edge,
      txHash: signal.lastTrade.txHash,
      dryRun: signal.lastTrade.dryRun,
      fillStatus: fs,
      filledQty: signal.lastTrade.filledQty,
    });
  } else if (signal.error) {
    await appendActivity({
      kind: "error",
      at: signal.updatedAt,
      title: "Tick error",
      detail: signal.error,
      marketId: signal.marketId || undefined,
      asset: signal.asset,
    });
  } else {
    await appendActivity({
      kind: "tick",
      at: signal.updatedAt,
      title: signal.recommendedSide
        ? `Signal ${signal.recommendedSide}`
        : `${signal.asset || "Market"} scan`,
      detail: signal.reason,
      marketId: signal.marketId || undefined,
      asset: signal.asset,
      side: signal.recommendedSide ?? undefined,
      edge: signal.edge,
    });
  }

  return signal;
}

export function getDeskClaimable() {
  return getClaimable();
}
