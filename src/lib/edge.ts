/**
 * Edge formula (explainable, no ML):
 *
 * 1. spot_implied_bias maps how far spot sits above/below the window reference
 *    (opening / strike) into a fair Up probability around 0.5.
 *    bias = clamp(0.5 + k * (spot - reference) / reference, 0.05, 0.95)
 *    with k = 8 (≈ ±1.25% move → ±10pp probability).
 *
 * 2. book_up_mid = (bestBid + bestAsk) / 2, or whichever side exists.
 *
 * 3. edge = spot_implied_bias - book_up_mid
 *    Trade Up when edge >= EDGE_THRESHOLD (book underprices Up).
 *    Trade Down when edge <= -EDGE_THRESHOLD (book overprices Up).
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
}): string {
  const { asset, spot, reference, bias, mid, edge, side, threshold } = args;
  if (spot == null || reference == null) {
    return `Waiting for ${asset} spot/reference prices to compute edge.`;
  }
  if (mid == null) {
    return `${asset} book is empty — no mid to compare against spot bias.`;
  }
  if (bias == null || edge == null) {
    return `Could not compute edge for ${asset}.`;
  }
  const movePct = (((spot - reference) / reference) * 100).toFixed(2);
  const dir = spot >= reference ? "above" : "below";
  if (!side) {
    return `Spot is ${movePct}% ${dir} reference (fair Up ${(bias * 100).toFixed(1)}%) vs book mid ${(mid * 100).toFixed(1)}% — |edge| ${(Math.abs(edge) * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}% threshold, so no trade.`;
  }
  if (side === "Up") {
    return `Spot is ${movePct}% ${dir} reference so fair Up is ${(bias * 100).toFixed(1)}%, but book mid is only ${(mid * 100).toFixed(1)}% — buying Up for +${(edge * 100).toFixed(1)}% edge.`;
  }
  return `Spot is ${movePct}% ${dir} reference so fair Up is ${(bias * 100).toFixed(1)}%, but book mid is ${(mid * 100).toFixed(1)}% — buying Down for +${(Math.abs(edge) * 100).toFixed(1)}% edge.`;
}
