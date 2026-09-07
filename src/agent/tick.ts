import type { PlaceOrderResult } from "@somnia-chain/markets-sdk";
import { getConfig } from "@/lib/config";
import {
  bookMid,
  computeEdge,
  decideSide,
  explainReason,
  spotImpliedBias,
} from "@/lib/edge";
import { getExchange, oracleGraphUrl, statusLabel } from "@/lib/exchange";
import {
  getClaimable,
  readSignal,
  setClaimable,
  writeMeta,
  writeSignal,
} from "@/lib/store";
import type {
  ClaimablePosition,
  DeskSignal,
  LastTrade,
  Side,
} from "@/lib/types";

function asNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "bigint") return Number(v);
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickOutcomes(m: Record<string, unknown>): {
  upSymbol?: string;
  downSymbol?: string;
} {
  const outcomes = m.outcomes as Array<{ symbol?: string }> | undefined;
  if (outcomes && outcomes.length >= 2) {
    return { upSymbol: outcomes[0]?.symbol, downSymbol: outcomes[1]?.symbol };
  }
  // loadMarkets-shaped
  const info = m.info as { outcomes?: Array<{ symbol?: string }> } | undefined;
  if (info?.outcomes && info.outcomes.length >= 2) {
    return {
      upSymbol: info.outcomes[0]?.symbol,
      downSymbol: info.outcomes[1]?.symbol,
    };
  }
  return {};
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

  const now = Date.now() / 1000;
  const scored = rows
    .map((m) => {
      const asset = String(m.asset || m.underlying || "").toUpperCase();
      const intervalSec = asNum(m.intervalSec) ?? 0;
      const expiry = asNum(m.expiry) ?? 0;
      const marketId = String(m.marketId || "");
      const secondsLeft = expiry - now;
      return { m, asset, intervalSec, expiry, marketId, secondsLeft };
    })
    .filter((x) => x.marketId && x.secondsLeft > 60);

  scored.sort((a, b) => {
    const prefA =
      (a.asset === cfg.preferredAsset ? 0 : 1) * 10 +
      (a.intervalSec === cfg.preferredIntervalSec ? 0 : 1);
    const prefB =
      (b.asset === cfg.preferredAsset ? 0 : 1) * 10 +
      (b.intervalSec === cfg.preferredIntervalSec ? 0 : 1);
    if (prefA !== prefB) return prefA - prefB;
    return b.secondsLeft - a.secondsLeft;
  });

  return scored;
}

async function readSpot(
  exchange: ReturnType<typeof getExchange>,
  asset: string,
): Promise<number | null> {
  try {
    const p = await exchange.fetchPrice(asset);
    const n = asNum(p && typeof p === "object" ? (p as { price?: unknown }).price : p);
    if (n != null && n > 0) return n;
  } catch {
    /* ignore */
  }

  // External public fallback (read-only) for demo when SDK feed unavailable
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

async function readReference(
  exchange: ReturnType<typeof getExchange>,
  marketId: string,
  row: Record<string, unknown>,
): Promise<number | null> {
  const strike = asNum(row.strike);
  if (strike != null && strike > 0) {
    // strike may be scaled; if huge, treat as 1e18 fixed
    if (strike > 1e9) return strike / 1e18;
    return strike;
  }

  try {
    const client = exchange.client as unknown as {
      getOpeningPrices?: (ids: string[]) => Promise<unknown>;
    };
    if (typeof client.getOpeningPrices === "function") {
      const opens = await client.getOpeningPrices([marketId]);
      if (Array.isArray(opens) && opens[0]) {
        const o = opens[0] as Record<string, unknown>;
        const n =
          asNum(o.openingPrice) ??
          asNum(o.price) ??
          asNum(o.numericValue) ??
          asNum((o.openingAnswer as { numericValue?: unknown } | undefined)?.numericValue);
        if (n != null && n > 0) {
          return n > 1e9 ? n / 1e18 : n;
        }
      } else if (opens && typeof opens === "object") {
        const map = opens as Record<string, unknown>;
        const o = (map[marketId] || Object.values(map)[0]) as Record<string, unknown> | undefined;
        if (o) {
          const n = asNum(o.openingPrice) ?? asNum(o.price) ?? asNum(o.numericValue);
          if (n != null && n > 0) return n > 1e9 ? n / 1e18 : n;
        }
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
      if (n != null && n > 0) return n > 1e9 ? n / 1e18 : n;
    }
  } catch {
    /* ignore */
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

      const qid = String(m.oracleQuestionId || oc.oracleQuestionId || "");
      out.push({
        marketId,
        asset: String(m.asset || "").toUpperCase(),
        intervalSec: asNum(m.intervalSec) ?? 0,
        status: isVoided ? "Voided" : "Resolved",
        upBalance: upBal.toString(),
        downBalance: downBal.toString(),
        winningOutcome: asNum(oc.winningOutcome) ?? undefined,
        oracleQuestionId: qid || undefined,
        oracleGraphUrl: oracleGraphUrl(qid),
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
    return { ok: false, txs: [], message: "PRIVATE_KEY required to claim" };
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
  return { ok: true, txs, message: `Redeemed ${toClaim.length} outcome(s)` };
}

export async function copyLastTrade(): Promise<{
  ok: boolean;
  message: string;
  trade?: LastTrade;
}> {
  const cfg = getConfig();
  const signal = await readSignal();
  if (!signal?.lastTrade && !signal?.recommendedSide) {
    return { ok: false, message: "No last agent trade or recommendation to copy" };
  }

  const side =
    signal.lastTrade?.side ||
    (signal.recommendedSide as Side | null);
  if (!side) return { ok: false, message: "No side to copy" };

  const size = cfg.copySize;
  const symbol = side === "Up" ? signal.upSymbol : signal.downSymbol;
  if (!symbol) return { ok: false, message: "Missing outcome symbol" };

  // Cross the touch: buy Up at ask+slip, buy Down via Down symbol (SDK converts)
  const bid = signal.upBid;
  const ask = signal.upAsk;
  let limit: number;
  if (side === "Up") {
    if (ask == null) return { ok: false, message: "No Up ask to cross" };
    limit = Math.min(0.99, ask + 0.02);
  } else {
    // Buying Down: use Down symbol; price still in Up terms for some APIs —
    // unified createOrder on Down symbol accepts Down price = 1 - up.
    const downAsk = ask != null ? 1 - (bid ?? ask) : null;
    // Prefer crossing via Up book: buy Down ≈ sell Up; use Down symbol with IOC
    const impliedDownAsk = bid != null ? 1 - bid : ask != null ? 1 - ask : null;
    if (impliedDownAsk == null) return { ok: false, message: "No Down price" };
    limit = Math.min(0.99, impliedDownAsk + 0.02);
  }

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
    };
    await writeSignal({ ...signal, lastTrade: trade, updatedAt: trade.at });
    return { ok: true, message: "DRY_RUN copy recorded", trade };
  }

  if (!cfg.privateKey) {
    return { ok: false, message: "PRIVATE_KEY required for copy" };
  }

  // Gate on-chain Trading
  const exchange = getExchange();
  const onchain = await exchange.client.getMarketOnchain(
    signal.marketId as `0x${string}`,
  );
  if (Number((onchain as { status?: number }).status) !== 1) {
    return { ok: false, message: "Market not in Trading status — cannot copy" };
  }

  const result = await placeIoc(exchange, symbol, side, size, limit);
  const trade: LastTrade = {
    marketId: signal.marketId,
    symbol,
    side,
    size,
    price: limit,
    edge: signal.edge ?? 0,
    reason: `Copied agent ${side}`,
    txHash: result.txHash,
    dryRun: false,
    at: new Date().toISOString(),
  };
  await writeSignal({ ...signal, lastTrade: trade, updatedAt: trade.at });
  return { ok: true, message: "Copy order sent", trade };
}

export async function runAgentTick(): Promise<DeskSignal> {
  const cfg = getConfig();
  const exchange = getExchange();
  const updatedAt = new Date().toISOString();

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
  };

  try {
    const candidates = await loadCandidateMarkets(exchange);
    if (candidates.length === 0) {
      signal.reason = "No live binary markets found for this venue — check VENUE_ID / NETWORK.";
      await writeSignal(signal);
      await writeMeta({ agentRunning: true, lastTickAt: updatedAt });
      return signal;
    }

    let chosen: (typeof candidates)[number] | null = null;
    let onchain: Record<string, unknown> | null = null;

    for (const c of candidates) {
      try {
        const oc = await exchange.client.getMarketOnchain(
          c.marketId as `0x${string}`,
        );
        const status = Number((oc as unknown as { status?: number }).status);
        if (status !== 1) continue; // only Trading
        chosen = c;
        onchain = oc as unknown as Record<string, unknown>;
        break;
      } catch {
        continue;
      }
    }

    if (!chosen || !onchain) {
      signal.reason = "Live markets found but none currently on-chain Trading (status=1).";
      await writeSignal(signal);
      await writeMeta({ agentRunning: true, lastTickAt: updatedAt });
      return signal;
    }

    const { upSymbol, downSymbol } = pickOutcomes(chosen.m);
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
      symbol: String(chosen.m.symbol || upSymbol),
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
    };

    // Book
    let upBid: number | null = null;
    let upAsk: number | null = null;
    try {
      const book = await exchange.fetchOrderBook(upSymbol, 5);
      upBid = asNum(book.bids?.[0]?.[0]);
      upAsk = asNum(book.asks?.[0]?.[0]);
    } catch (e) {
      signal.error = `Book read failed: ${e instanceof Error ? e.message : String(e)}`;
    }
    const mid = bookMid(upBid, upAsk);
    signal.upBid = upBid;
    signal.upAsk = upAsk;
    signal.upMid = mid;

    const spot = await readSpot(exchange, signal.asset);
    let reference = await readReference(exchange, chosen.marketId, chosen.m);
    // If no opening reference yet, seed with spot so bias≈0.5 (neutral)
    if (reference == null && spot != null) reference = spot;

    signal.spot = spot;
    signal.reference = reference;

    const bias =
      spot != null && reference != null ? spotImpliedBias(spot, reference) : null;
    signal.spotImpliedBias = bias;

    const { edge } = computeEdge(bias ?? 0.5, mid);
    signal.edge = edge;
    const side = decideSide(edge, cfg.edgeThreshold);
    signal.recommendedSide = side;
    signal.reason = explainReason({
      asset: signal.asset,
      spot,
      reference,
      bias,
      mid,
      edge,
      side,
      threshold: cfg.edgeThreshold,
    });

    // Place when edge clears threshold and market is Trading
    if (side && statusCode === 1 && mid != null) {
      const tradeSymbol = side === "Up" ? upSymbol : downSymbol || upSymbol;
      let limit: number;
      if (side === "Up") {
        if (upAsk == null) {
          signal.reason += " (no ask to cross — skipped)";
        } else {
          limit = Math.min(0.99, upAsk + 0.02);
          if (cfg.dryRun) {
            const trade: LastTrade = {
              marketId: signal.marketId,
              symbol: tradeSymbol!,
              side,
              size: cfg.copySize,
              price: limit,
              edge: edge ?? 0,
              reason: signal.reason,
              dryRun: true,
              at: updatedAt,
            };
            signal.lastTrade = trade;
          } else if (cfg.privateKey) {
            try {
              const res = await placeIoc(
                exchange,
                tradeSymbol!,
                side,
                cfg.copySize,
                limit,
              );
              signal.lastTrade = {
                marketId: signal.marketId,
                symbol: tradeSymbol!,
                side,
                size: cfg.copySize,
                price: limit,
                edge: edge ?? 0,
                reason: signal.reason,
                txHash: res.txHash,
                dryRun: false,
                at: updatedAt,
              };
            } catch (e) {
              signal.error = `Order failed: ${e instanceof Error ? e.message : String(e)}`;
            }
          } else {
            signal.reason += " (no PRIVATE_KEY — signal only)";
          }
        }
      } else {
        // Down: buy via down symbol; limit as Down probability
        const downLimit =
          upBid != null
            ? Math.min(0.99, 1 - upBid + 0.02)
            : upAsk != null
              ? Math.min(0.99, 1 - upAsk + 0.02)
              : null;
        if (downLimit == null || !downSymbol) {
          signal.reason += " (no Down liquidity — skipped)";
        } else if (cfg.dryRun) {
          signal.lastTrade = {
            marketId: signal.marketId,
            symbol: downSymbol,
            side,
            size: cfg.copySize,
            price: downLimit,
            edge: edge ?? 0,
            reason: signal.reason,
            dryRun: true,
            at: updatedAt,
          };
        } else if (cfg.privateKey) {
          try {
            const res = await placeIoc(
              exchange,
              downSymbol,
              side,
              cfg.copySize,
              downLimit,
            );
            signal.lastTrade = {
              marketId: signal.marketId,
              symbol: downSymbol,
              side,
              size: cfg.copySize,
              price: downLimit,
              edge: edge ?? 0,
              reason: signal.reason,
              txHash: res.txHash,
              dryRun: false,
              at: updatedAt,
            };
          } catch (e) {
            signal.error = `Order failed: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
      }
    }

    try {
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
  await writeSignal(signal);
  await writeMeta({
    agentRunning: true,
    lastTickAt: signal.updatedAt,
    lastError: signal.error,
  });
  return signal;
}

export function getDeskClaimable() {
  return getClaimable();
}
