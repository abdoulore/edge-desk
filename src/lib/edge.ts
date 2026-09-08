/**
 * Edge formula (explainable, no ML):
 *
 * 1. spot_implied_bias maps how far spot sits above/below the window reference
 *    (opening / strike) into a fair Up probability around 0.5.
 *    bias = clamp(0.5 + k * (spot - reference) / reference, 0.05, 0.95)
 *    with k = 8 (≈ ±1.25% move → ±10pp probability).
 *
 * 2. book_up_mid = (bestBid + bestAsk) / 2, or whichever side exists.
 *    Mid gap is informational only — never treated as executable value.
 *
 * 3. Executable edge uses the ask for the side being bought:
 *    Up:   bias - upAsk
 *    Down: (1 - bias) - downAsk
 *    where downAsk is the real Down-book ask, or 1 - upBid when Up bids
 *    exist (complementary). Never invent Down ask from 1 - upAsk.
 */

export const BIAS_K = 8;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function spotImpliedBias(spot: number, reference: number, k = BIAS_K): number {
  if (!Number.isFinite(spot) || !Number.isFinite(reference) || reference <= 0) {
    return 0.5;
  }
  const move = (spot - reference) / reference;
  return clamp(0.5 + k * move, 0.05, 0.95);
}

export function bookMid(bid: number | null, ask: number | null): number | null {
  if (bid != null && ask != null) return (bid + ask) / 2;
  if (bid != null) return bid;
  if (ask != null) return ask;
  return null;
}

export function computeEdge(
  bias: number,
  mid: number | null,
): { edge: number | null; side: "Up" | "Down" | null } {
  if (mid == null || !Number.isFinite(mid)) return { edge: null, side: null };
  const edge = bias - mid;
  return { edge, side: null };
}

/**
 * Implied Down ask from the Up book: only 1 - upBid is valid (someone bidding
 * Up is offering to sell Down synthetically). Never derive from upAsk.
 */
export function impliedDownAsk(
  upBid: number | null,
  downAsk: number | null = null,
): number | null {
  if (downAsk != null && Number.isFinite(downAsk) && downAsk > 0 && downAsk < 1) {
    return downAsk;
  }
  if (upBid != null && Number.isFinite(upBid)) return 1 - upBid;
  return null;
}

/** Executable edge for buying the given side at the ask for `size` (top of book). */
export function executableEdge(args: {
  bias: number;
  side: "Up" | "Down";
  upAsk: number | null;
  downAsk: number | null;
}): { edge: number | null; cost: number | null } {
  const { bias, side, upAsk, downAsk } = args;
  if (!Number.isFinite(bias)) return { edge: null, cost: null };
  if (side === "Up") {
    if (upAsk == null || !Number.isFinite(upAsk)) return { edge: null, cost: null };
    return { edge: bias - upAsk, cost: upAsk };
  }
  if (downAsk == null || !Number.isFinite(downAsk)) return { edge: null, cost: null };
  return { edge: 1 - bias - downAsk, cost: downAsk };
}

/**
 * Candidate side from model-mid gap, then require executable ask edge ≥ threshold.
 * Returns null when mid looks fine but the ask destroys minimum edge.
 */
export function decideExecutableSide(args: {
  bias: number | null;
  mid: number | null;
  upAsk: number | null;
  downAsk: number | null;
  threshold: number;
}): {
  side: "Up" | "Down" | null;
  midEdge: number | null;
  execEdge: number | null;
  execCost: number | null;
  rejectedForCost: boolean;
} {
  const { bias, mid, upAsk, downAsk, threshold } = args;
  if (bias == null || mid == null) {
    return {
      side: null,
      midEdge: null,
      execEdge: null,
      execCost: null,
      rejectedForCost: false,
    };
  }
  const midEdge = bias - mid;
  let candidate: "Up" | "Down" | null = null;
  if (midEdge >= threshold) candidate = "Up";
  else if (midEdge <= -threshold) candidate = "Down";
  if (!candidate) {
    return {
      side: null,
      midEdge,
      execEdge: null,
      execCost: null,
      rejectedForCost: false,
    };
  }
  const { edge: execEdge, cost: execCost } = executableEdge({
    bias,
    side: candidate,
    upAsk,
    downAsk,
  });
  if (execEdge == null || execCost == null) {
    return {
      side: null,
      midEdge,
      execEdge: null,
      execCost: null,
      rejectedForCost: false,
    };
  }
  if (execEdge < threshold) {
    return {
      side: null,
      midEdge,
      execEdge,
      execCost,
      rejectedForCost: true,
    };
  }
  return {
    side: candidate,
    midEdge,
    execEdge,
    execCost,
    rejectedForCost: false,
  };
}

export function decideSide(
  edge: number | null,
  threshold: number,
): "Up" | "Down" | null {
  if (edge == null) return null;
  if (edge >= threshold) return "Up";
  if (edge <= -threshold) return "Down";
  return null;
}

export function explainReason(args: {
  asset: string;
  spot: number | null;
  reference: number | null;
  bias: number | null;
  mid: number | null;
  edge: number | null;
  side: "Up" | "Down" | null;
  threshold: number;
  execCost?: number | null;
  execEdge?: number | null;
  rejectedForCost?: boolean;
}): string {
  const {
    asset,
    spot,
    reference,
    bias,
    mid,
    edge,
    side,
    threshold,
    execCost,
    execEdge,
    rejectedForCost,
  } = args;
  if (spot == null || reference == null) {
    return `Waiting for ${asset} opening/strike reference — no trade until settlement boundary is known.`;
  }
  if (mid == null) {
    return `${asset} book is empty — no mid to compare against spot bias.`;
  }
  if (bias == null || edge == null) {
    return `Could not compute edge for ${asset}.`;
  }
  const movePct = (((spot - reference) / reference) * 100).toFixed(2);
  const dir = spot >= reference ? "above" : "below";
  if (rejectedForCost && execCost != null && execEdge != null) {
    return `Spot is ${movePct}% ${dir} reference (fair Up ${(bias * 100).toFixed(1)}%) vs book mid ${(mid * 100).toFixed(1)}% (model edge ${(edge * 100).toFixed(1)}%), but executable ask ${(execCost * 100).toFixed(1)}% leaves only ${(execEdge * 100).toFixed(1)}% — below ${(threshold * 100).toFixed(0)}% threshold, so no trade.`;
  }
  if (!side) {
    return `Spot is ${movePct}% ${dir} reference (fair Up ${(bias * 100).toFixed(1)}%) vs book mid ${(mid * 100).toFixed(1)}% — |model edge| ${(Math.abs(edge) * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}% threshold, so no trade.`;
  }
  const execBit =
    execCost != null && execEdge != null
      ? ` Executable ask ${(execCost * 100).toFixed(1)}% → +${(execEdge * 100).toFixed(1)}% net.`
      : "";
  if (side === "Up") {
    return `Spot is ${movePct}% ${dir} reference so fair Up is ${(bias * 100).toFixed(1)}%, book mid ${(mid * 100).toFixed(1)}% (model +${(edge * 100).toFixed(1)}%).${execBit} Buying Up.`;
  }
  return `Spot is ${movePct}% ${dir} reference so fair Up is ${(bias * 100).toFixed(1)}%, book mid ${(mid * 100).toFixed(1)}% (model ${((edge ?? 0) * 100).toFixed(1)}%).${execBit} Buying Down.`;
}
