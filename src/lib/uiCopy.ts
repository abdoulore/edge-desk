/** Recurring user-facing labels and state copy. Keep terminology consistent. */

export const UI_COPY = {
  loadingDesk: "Loading the desk...",
  loadingDeskDetail: "Getting the latest market and signal data.",
  deskUnavailable: "Signal data is unavailable",
  deskUnavailableDetail:
    "Edge Desk couldn't load the latest market data. Try refreshing the page.",
  waitingFirstSignal: "Waiting for the first market update...",
  checkNow: "Check now",
  checking: "Checking...",
  manualCheckUnavailable: "Manual check unavailable",
  manualCheckUnavailableTitle:
    "Manual signal checks are disabled on this deployment. Signals will continue to update automatically when the signal process is running.",
  pausedAlert: "Signal updates are paused. Resume them in Settings.",
  stalledAlert: "Signals aren't updating. Check that the signal process is running.",
  switchingMarket: "Switching to the selected market...",
  switchMarketFailed:
    "Edge Desk hasn't switched to this market yet. Refresh or choose another active market.",
  tradeThisSignal: "Trade this signal",
  placingTrade: "Placing trade...",
  connectToTrade: "Connect to trade",
  claim: "Claim",
  claiming: "Claiming...",
  nothingToClaim: "Nothing to claim",
  connectToClaim: "Connect to claim",
  viewResolution: "View resolution",
  browseMarkets: "Browse markets",
  viewTransaction: "View transaction",
  fairUpTooltip:
    "Rule-based fair-value estimate from spot relative to the market reference. Not a calibrated probability.",
  edgeTooltip:
    "The difference between Edge Desk's fair-value estimate and the price available to trade.",
  openingPriceTooltip:
    "The price BTC or ETH is compared against when the market resolves.",
  upMidpointTooltip: "The midpoint of the current Up bid and ask.",
  coinGeckoDisplayOnly:
    "This price is shown for reference only and is not used to generate trade signals.",
  noMarkets: "No active markets found",
  noMarketsDetail:
    "Markets will appear here when Edge Desk receives the next market update.",
  noPriceYet: "No price yet",
  currentMarket: "Current",
  noSignal: "No signal",
  signalOnly: "Signal only",
  autoTrade: "Auto trade",
  manualUnavailable: "Manual controls are unavailable on this deployment.",
  switchNetwork: "Switch your wallet to Somnia Shannon to continue.",
  connectWallet: "Connect your wallet",
} as const;

export function formatMarketStatus(status?: string | null): string {
  switch (status) {
    case "Trading":
      return "Open";
    case "Finalized":
      return "Finalized";
    case "Resolved":
      return "Resolved";
    case "Voided":
      return "Voided";
    case "Paused":
      return "Paused";
    case "Expired":
      return "Ended";
    default:
      return status || "-";
  }
}

export function formatActivityKind(kind?: string | null): string {
  switch (kind) {
    case "signal":
      return "Signal";
    case "trade":
      return "Auto trade";
    case "copy":
      return "Wallet trade";
    case "claim":
      return "Claim";
    case "error":
      return "Error";
    case "focus":
      return "Market switch";
    case "tick":
      return "Signal update";
    default:
      return kind || "Event";
  }
}

export function formatFillStatusLabel(status?: string | null): string {
  switch (status) {
    case "signal":
      return "Signal generated";
    case "submitted":
      return "Order submitted";
    case "zero-fill":
      return "Did not fill";
    case "partial":
      return "Partially filled";
    case "full":
      return "Filled";
    default:
      return status || "-";
  }
}

export function formatModeLabel(opts: {
  paused?: boolean;
  dryRun?: boolean;
}): string {
  if (opts.paused) return "PAUSED";
  if (opts.dryRun) return "SIGNAL ONLY";
  return "AUTO TRADE";
}

export function formatModeTitle(opts: {
  paused?: boolean;
  dryRun?: boolean;
}): string {
  if (opts.paused) return "Signal updates are paused.";
  if (opts.dryRun) {
    return "Edge Desk can generate signals, but the server agent will not place trades automatically.";
  }
  return "Automatic server-side trading is enabled.";
}

export function preferredMissingCopy(
  preferredLabel: string,
  showingLabel: string,
): string {
  return `The preferred ${preferredLabel} market isn't available, so Edge Desk is showing the closest active market: ${showingLabel}.`;
}

export function spotSourceSub(source?: string | null): string | undefined {
  if (!source || source === "sdk") return undefined;
  if (source === "coingecko") return "CoinGecko, display only";
  return source;
}
