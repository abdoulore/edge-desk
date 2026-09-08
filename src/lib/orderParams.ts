import type { Side } from "./types";
import { impliedDownAsk } from "./edge";

export interface CopyOrderInput {
  side: Side;
  upSymbol: string;
  downSymbol?: string | null;
  upBid: number | null;
  upAsk: number | null;
  /** Real Down-book ask when available. Never invent from 1 - upAsk. */
  downAsk?: number | null;
  size: number;
  marketId: string;
  edge?: number | null;
  /** Model fair Up probability — used to reject negative executable edge. */
  bias?: number | null;
  /** Minimum acceptable executable edge (defaults to requiring non-negative). */
  minEdge?: number | null;
}

export interface CopyOrderParams {
  symbol: string;
  side: Side;
  size: number;
  limitPrice: number;
  marketId: string;
  edge: number;
  execCost: number;
  execEdge: number;
}

/**
 * Pure limit/symbol selection for Copy — buy at ask + slip.
 * Down price: real downAsk or 1 - upBid only (never 1 - upAsk).
 * Rejects when executable cost destroys min edge.
 */
export function buildCopyOrderParams(
  input: CopyOrderInput,
): { ok: true; params: CopyOrderParams } | { ok: false; message: string } {
  const {
    side,
    upSymbol,
    downSymbol,
    upBid,
    upAsk,
    downAsk,
    size,
    marketId,
    edge,
    bias,
    minEdge,
  } = input;
  if (!side) return { ok: false, message: "No side to copy" };
  if (!(size > 0)) return { ok: false, message: "Invalid size" };

  const floor = minEdge ?? 0;

  if (side === "Up") {
    if (!upSymbol) return { ok: false, message: "Missing Up outcome symbol" };
    if (upAsk == null) return { ok: false, message: "No Up ask to cross" };
    if (bias != null && Number.isFinite(bias)) {
      const execEdge = bias - upAsk;
      if (execEdge < floor) {
        return {
          ok: false,
          message: `Executable Up ask ${upAsk.toFixed(3)} destroys edge (${execEdge.toFixed(3)} < ${floor})`,
        };
      }
    }
    const limitPrice = Math.min(0.99, upAsk + 0.02);
    const execEdge =
      bias != null && Number.isFinite(bias) ? bias - upAsk : edge ?? 0;
    return {
      ok: true,
      params: {
        symbol: upSymbol,
        side,
        size,
        limitPrice,
        marketId,
        edge: edge ?? execEdge,
        execCost: upAsk,
        execEdge,
      },
    };
  }

  if (!downSymbol) return { ok: false, message: "Missing Down outcome symbol" };
  const ask = impliedDownAsk(upBid, downAsk ?? null);
  if (ask == null) {
    return {
      ok: false,
      message: "No Down ask (missing Down book and Up bid — will not invent from Up ask)",
    };
  }
  if (bias != null && Number.isFinite(bias)) {
    const execEdge = 1 - bias - ask;
    if (execEdge < floor) {
      return {
        ok: false,
        message: `Executable Down ask ${ask.toFixed(3)} destroys edge (${execEdge.toFixed(3)} < ${floor})`,
      };
    }
  }
  const limitPrice = Math.min(0.99, ask + 0.02);
  const execEdge =
    bias != null && Number.isFinite(bias) ? 1 - bias - ask : edge ?? 0;
  return {
    ok: true,
    params: {
      symbol: downSymbol,
      side,
      size,
      limitPrice,
      marketId,
      edge: edge ?? execEdge,
      execCost: ask,
      execEdge,
    },
  };
}
