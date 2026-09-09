import type { FillStatus, Side } from "./types";

/** Classify an order result into signal / submitted / partial / full / zero-fill. */
export function classifyFill(opts: {
  dryRun?: boolean;
  requested: number;
  filled?: number | null;
  /** True when a live tx was accepted but filled qty is unknown. */
  submitted?: boolean;
}): FillStatus {
  if (opts.dryRun) return "signal";
  if (opts.filled == null || !Number.isFinite(opts.filled)) {
    return opts.submitted ? "submitted" : "submitted";
  }
  if (opts.filled <= 0) return "zero-fill";
  if (opts.filled + 1e-9 < opts.requested) return "partial";
  return "full";
}

function formatQty(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "?";
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return n.toFixed(4).replace(/\.?0+$/, "");
}

/** User-facing activity title for a fill status. Internal enums stay unchanged. */
export function fillActivityTitle(
  side: Side,
  status: FillStatus,
  filledQty?: number | null,
): string {
  switch (status) {
    case "signal":
      return `${side} signal`;
    case "submitted":
      return `${side} order submitted`;
    case "zero-fill":
      return `${side} order did not fill`;
    case "partial":
      return filledQty != null && Number.isFinite(filledQty)
        ? `${side} partially filled (${formatQty(filledQty)})`
        : `${side} partially filled`;
    case "full":
      return filledQty != null && Number.isFinite(filledQty)
        ? `${side} order filled (${formatQty(filledQty)})`
        : `${side} order filled`;
    default:
      return `${side} ${status}`;
  }
}

/** User-facing toast / result message. Do not append tx hashes here. */
export function fillUserMessage(
  side: Side,
  status: FillStatus,
  opts: {
    filledQty?: number | null;
    requestedQty?: number | null;
    txHash?: string;
  },
): string {
  const qty = formatQty(opts.filledQty);
  const req =
    opts.requestedQty != null && Number.isFinite(opts.requestedQty)
      ? formatQty(opts.requestedQty)
      : null;
  switch (status) {
    case "signal":
      return `${side} signal generated. No automatic trade was placed.`;
    case "submitted":
      return opts.txHash
        ? `Your ${side} order was submitted. Open the transaction to confirm the final fill.`
        : `${side} order submitted.`;
    case "zero-fill":
      return `Your order was submitted, but nothing filled at the available price.`;
    case "partial":
      return req
        ? `Your ${side} order partially filled: ${qty} of ${req} units.`
        : `Your ${side} order partially filled: ${qty} units.`;
    case "full":
      return `Your ${side} order filled for ${qty} unit${qty === "1" ? "" : "s"}.`;
    default:
      return `${side} ${status}`;
  }
}
