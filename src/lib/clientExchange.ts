"use client";

import {
  SomniaMarkets,
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
  type PlaceOrderResult,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { WalletClient } from "viem";

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

export async function placeIocWithWallet(
  exchange: SomniaMarkets,
  symbol: string,
  size: number,
  limitPrice: number,
): Promise<{ txHash?: string }> {
  const order = await exchange.createOrder(symbol, "limit", "buy", size, limitPrice, {
    timeInForce: "IOC",
  });
  const info = order.info as PlaceOrderResult | undefined;
  const receipt = info?.receipt as
    | { transactionHash?: string; status?: string | number }
    | undefined;
  if (receipt?.status === "reverted" || receipt?.status === 0) {
    throw new Error("order reverted on-chain");
  }
  return {
    txHash:
      (info as { hash?: string } | undefined)?.hash || receipt?.transactionHash,
  };
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
): Promise<{ upBalance: string; downBalance: string; outcomeToken?: string } | null> {
  try {
    const exchange = createReadExchange();
    const oc = await exchange.client.getMarketOnchain(marketId as `0x${string}`);
    const anyOc = oc as unknown as {
      yesId: bigint;
      noId: bigint;
      outcomeToken: string;
    };
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
      upBalance: upBal.toString(),
      downBalance: downBal.toString(),
      outcomeToken,
    };
  } catch {
    return null;
  }
}
