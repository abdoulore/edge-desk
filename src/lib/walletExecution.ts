import type { FillStatus, Side } from "./types";

export interface WalletExecution {
  at: string;
  side: Side;
  marketId: string;
  symbol: string;
  fillStatus: FillStatus;
  filledQty: number;
  requestedQty: number;
  price: number;
  txHash?: string;
  message: string;
}

const KEY = "edge-desk-last-wallet-execution";

export function saveWalletExecution(e: WalletExecution): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(KEY, JSON.stringify(e));
    }
  } catch {
    /* ignore */
  }
}

export function readWalletExecution(): WalletExecution | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WalletExecution;
  } catch {
    return null;
  }
}
