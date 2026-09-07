import type { Side } from "./types";

export interface CopyOrderInput {
  side: Side;
  upSymbol: string;
  downSymbol?: string | null;
  upBid: number | null;
  upAsk: number | null;
  size: number;
  marketId: string;
  edge?: number | null;
}

export interface CopyOrderParams {
  symbol: string;
  side: Side;
  size: number;
  limitPrice: number;
  marketId: string;
  edge: number;
}

/**
 * Pure limit/symbol selection for Copy — mirrors agent IOC cross logic.
 * Buy Up at ask+slip; buy Down via Down symbol at implied Down ask + slip.
 */
export function buildCopyOrderParams(
  input: CopyOrderInput,
): { ok: true; params: CopyOrderParams } | { ok: false; message: string } {
  const { side, upSymbol, downSymbol, upBid, upAsk, size, marketId, edge } = input;
  if (!side) return { ok: false, message: "No side to copy" };
  if (!(size > 0)) return { ok: false, message: "Invalid size" };

  if (side === "Up") {
    if (!upSymbol) return { ok: false, message: "Missing Up outcome symbol" };
    if (upAsk == null) return { ok: false, message: "No Up ask to cross" };
    const limitPrice = Math.min(0.99, upAsk + 0.02);
    return {
      ok: true,
      params: {
        symbol: upSymbol,
        side,
        size,
        limitPrice,
        marketId,
        edge: edge ?? 0,
      },
    };
  }

  if (!downSymbol) return { ok: false, message: "Missing Down outcome symbol" };
  const impliedDownAsk =
    upBid != null ? 1 - upBid : upAsk != null ? 1 - upAsk : null;
  if (impliedDownAsk == null) return { ok: false, message: "No Down price" };
  const limitPrice = Math.min(0.99, impliedDownAsk + 0.02);
  return {
    ok: true,
    params: {
      symbol: downSymbol,
      side,
      size,
      limitPrice,
      marketId,
      edge: edge ?? 0,
    },
  };
}
