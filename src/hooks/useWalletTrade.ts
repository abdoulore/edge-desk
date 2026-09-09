"use client";

import { useCallback, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { buildCopyOrderParams } from "@/lib/orderParams";
import {
  createWalletExchange,
  placeIocWithWallet,
  redeemWithWallet,
} from "@/lib/clientExchange";
import { fillUserMessage } from "@/lib/fillStatus";
import {
  saveWalletExecution,
  type WalletExecution,
} from "@/lib/walletExecution";
import { toUserMessage } from "@/lib/userError";
import type { DeskSignal, FillStatus, Side } from "@/lib/types";
import { SHANNON_CHAIN_ID } from "@/wallet/config";

/** Only trade the current market's recommendation — never a stale lastTrade side. */
function resolveTradeSide(
  signal: DeskSignal,
): { ok: true; side: Side } | { ok: false; message: string } {
  const current = signal.recommendedSide as Side | null;
  if (!current) {
    return {
      ok: false,
      message:
        "The current market does not meet the edge threshold. Wait for the next signal.",
    };
  }
  if (
    signal.lastTrade?.side &&
    signal.lastTrade.marketId &&
    signal.marketId &&
    signal.lastTrade.marketId.toLowerCase() !== signal.marketId.toLowerCase()
  ) {
    // Stale lastTrade from another window — ignore it; still use recommendedSide.
  }
  return { ok: true, side: current };
}

export type WalletTradeResult = {
  ok: boolean;
  message: string;
  txHash?: string;
  fillStatus?: FillStatus;
  filledQty?: number;
  requestedQty?: number;
};

export function useWalletTrade() {
  const { address, isConnected, chainId } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: SHANNON_CHAIN_ID });
  const [busy, setBusy] = useState<"copy" | "claim" | null>(null);
  const [lastExecution, setLastExecution] = useState<WalletExecution | null>(
    null,
  );

  const copyFromSignal = useCallback(
    async (signal: DeskSignal | null | undefined): Promise<WalletTradeResult> => {
      if (!signal) {
        return { ok: false, message: "There is no active trade signal right now." };
      }
      if (!isConnected || !address) {
        return { ok: false, message: "Connect your wallet to trade." };
      }
      if (chainId !== SHANNON_CHAIN_ID) {
        return {
          ok: false,
          message: "Switch your wallet to Somnia Shannon to continue.",
        };
      }
      if (!walletClient) {
        return {
          ok: false,
          message: "Your wallet isn't ready yet. Reconnect it and try again.",
        };
      }
      if (!signal.marketId) {
        return {
          ok: false,
          message:
            "This signal isn't linked to a tradable market. Refresh and try again.",
        };
      }

      const resolved = resolveTradeSide(signal);
      if (!resolved.ok) return resolved;
      const { side } = resolved;

      const built = buildCopyOrderParams({
        side,
        upSymbol: signal.upSymbol,
        downSymbol: signal.downSymbol,
        upBid: signal.upBid,
        upAsk: signal.upAsk,
        downAsk: signal.downAsk ?? null,
        size: signal.copySize,
        marketId: signal.marketId,
        edge: signal.edge,
        bias: signal.spotImpliedBias,
        minEdge: signal.edgeThreshold,
      });
      if (!built.ok) return { ok: false, message: built.message };

      setBusy("copy");
      try {
        const exchange = createWalletExchange(walletClient);
        const onchain = await exchange.client.getMarketOnchain(
          signal.marketId as `0x${string}`,
        );
        if (Number((onchain as { status?: number }).status) !== 1) {
          return {
            ok: false,
            message:
              "This market is no longer open for trading. Refresh to find another active market.",
          };
        }
        const result = await placeIocWithWallet(
          exchange,
          built.params.symbol,
          built.params.size,
          built.params.limitPrice,
          signal.marketId,
        );

        const fillStatus = result.fillStatus;
        const filledQty = Number.isFinite(result.filled) ? result.filled : 0;
        const message = fillUserMessage(side, fillStatus, {
          filledQty: Number.isFinite(result.filled) ? result.filled : null,
          requestedQty: built.params.size,
          txHash: result.txHash,
        });

        const exec: WalletExecution = {
          at: new Date().toISOString(),
          side,
          marketId: signal.marketId,
          symbol: result.symbol || built.params.symbol,
          fillStatus,
          filledQty,
          requestedQty: built.params.size,
          price: built.params.limitPrice,
          txHash: result.txHash,
          message,
        };
        saveWalletExecution(exec);
        setLastExecution(exec);

        // Zero-fill is not a successful fill — ok=false so UI doesn't celebrate.
        const ok = fillStatus !== "zero-fill";
        return {
          ok,
          message,
          txHash: result.txHash,
          fillStatus,
          filledQty: Number.isFinite(result.filled) ? result.filled : undefined,
          requestedQty: built.params.size,
        };
      } catch (e) {
        return {
          ok: false,
          message: toUserMessage(e, "trade"),
        };
      } finally {
        setBusy(null);
      }
    },
    [address, chainId, isConnected, walletClient],
  );

  const claimMarket = useCallback(
    async (marketId?: string) => {
      if (!marketId) {
        return { ok: false, message: "No winnings are ready to claim yet." };
      }
      if (!isConnected || !address) {
        return { ok: false, message: "Connect your wallet to claim." };
      }
      if (chainId !== SHANNON_CHAIN_ID) {
        return {
          ok: false,
          message: "Switch your wallet to Somnia Shannon to continue.",
        };
      }
      if (!walletClient) {
        return {
          ok: false,
          message: "Your wallet isn't ready yet. Reconnect it and try again.",
        };
      }
      setBusy("claim");
      try {
        const exchange = createWalletExchange(walletClient);
        return await redeemWithWallet(exchange, marketId);
      } catch (e) {
        return {
          ok: false,
          message: toUserMessage(e, "claim"),
        };
      } finally {
        setBusy(null);
      }
    },
    [address, chainId, isConnected, walletClient],
  );

  return {
    address,
    isConnected,
    busy,
    lastExecution,
    copyFromSignal,
    claimMarket,
  };
}
