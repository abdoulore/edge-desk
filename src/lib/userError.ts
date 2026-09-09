/**
 * Convert technical / raw errors into calm user-facing messages.
 * Raw detail is still logged so debugging is not destroyed.
 */

function rawText(error: unknown): string {
  if (error == null) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || String(error);
  if (typeof error === "object" && error !== null && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  try {
    return String(error);
  } catch {
    return "";
  }
}

const PATTERNS: Array<{ test: RegExp; message: string }> = [
  {
    test: /operator secret|edge_desk_secret|x-edge-desk-secret|unauthorized/i,
    message: "This control is unavailable on this deployment.",
  },
  {
    test: /wallet client unavailable/i,
    message: "Your wallet isn't ready yet. Reconnect it and try again.",
  },
  {
    test: /market binding|no market binding/i,
    message: "This signal isn't linked to a tradable market. Refresh and try again.",
  },
  {
    test: /not in Trading|MarketNotTrading|no longer open/i,
    message:
      "This market is no longer open for trading. Refresh to find another active market.",
  },
  {
    test: /wrong chain|switch to somnia|expected Shannon/i,
    message: "Switch your wallet to Somnia Shannon to continue.",
  },
  {
    test: /user rejected|denied|rejected by user|action_rejected/i,
    message: "The trade was rejected by your wallet.",
  },
  {
    test: /insufficient|not enough|balance too low/i,
    message: "Your wallet doesn't have enough balance for this trade.",
  },
  {
    test: /order reverted|execution reverted|transaction failed|reverted/i,
    message: "The transaction failed on-chain. No position was opened.",
  },
  {
    test: /not Resolved\/Voided|not resolved|not voided/i,
    message: "This market isn't ready to claim yet. Wait until it is finalized.",
  },
  {
    test: /nothing claimable|nothing to claim/i,
    message: "No winnings are ready to claim yet.",
  },
  {
    test: /no signal to trade|no current qualifying|no side to/i,
    message: "There is no active trade signal right now.",
  },
  {
    test: /no up ask|no down ask|missing.*ask/i,
    message: "This market does not have enough quotes to trade right now.",
  },
  {
    test: /destroys edge|below.*threshold|executable.*edge/i,
    message:
      "The available price no longer leaves enough edge. Wait for the next signal.",
  },
  {
    test: /connect.*(wallet|shannon)/i,
    message: "Connect your wallet to continue.",
  },
  {
    test: /tick failed|status \d+|fetch failed|failed to fetch|networkerror/i,
    message: "We couldn't reach Edge Desk. Try again shortly.",
  },
];

export function toUserMessage(error: unknown, context?: string): string {
  const raw = rawText(error).trim();
  if (raw) {
    console.error(context ? `[${context}]` : "[userError]", raw, error);
  } else if (error != null) {
    console.error(context ? `[${context}]` : "[userError]", error);
  }

  for (const p of PATTERNS) {
    if (raw && p.test.test(raw)) return p.message;
  }

  switch (context) {
    case "trade":
      return "The trade couldn't be completed. Check your wallet and try again.";
    case "claim":
      return "The claim couldn't be completed. Check your wallet and try again.";
    case "status":
      return "We couldn't load the latest market data. Try refreshing the page.";
    case "pause":
      return "Couldn't update signal controls. Try again.";
    case "focus":
      return "Couldn't switch markets. Refresh and try again.";
    case "tick":
      return "Couldn't refresh the signal. Try again shortly.";
    default:
      break;
  }

  // Safe short raw messages that already read like product copy.
  if (raw && raw.length <= 120 && !/0x[a-f0-9]{8,}/i.test(raw) && !/stack|reverted|Error:|at\s+\w+/i.test(raw)) {
    return raw;
  }

  return "Something went wrong. Try again.";
}
