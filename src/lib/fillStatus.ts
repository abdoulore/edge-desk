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

export function fillActivityTitle(
  side: Side,
  status: FillStatus,
  filledQty?: number | null,
): string {
  switch (status) {
    case "signal":
      return `${side} signal (dry)`;
    case "submitted":
      return `${side} submitted`;
    case "zero-fill":
      return `${side} zero-fill`;
    case "partial":
      return `${side} filled qty ${formatQty(filledQty)}`;
    case "full":
      return `${side} filled qty ${formatQty(filledQty)}`;
    default:
      return `${side} ${status}`;
  }
}

function formatQty(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "?";
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return n.toFixed(4).replace(/\.?0+$/, "");
}

export function fillUserMessage(
  side: Side,
  status: FillStatus,
  opts: { filledQty?: number | null; txHash?: string },
): string {
  const short = opts.txHash ? ` · ${opts.txHash.slice(0, 10)}…` : "";
  switch (status) {
    case "signal":
      return `Signal (dry) ${side}${short}`;
    case "submitted":
      return `Submitted ${side}${short}`;
    case "zero-fill":
      return `Zero-fill ${side} — tx mined, filled qty 0${short}`;
    case "partial":
      return `Partial fill ${side} qty ${formatQty(opts.filledQty)}${short}`;
    case "full":
      return `Filled ${side} qty ${formatQty(opts.filledQty)}${short}`;
    default:
      return `${side} ${status}${short}`;
  }
}
