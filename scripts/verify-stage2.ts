/**
 * Stage 2 checks: portfolio formatting, fill labeling, claim eligibility.
 * Run: npx tsx scripts/verify-stage2.ts
 */
import { formatRawBalance } from "../src/lib/format";
import { classifyFill, fillActivityTitle } from "../src/lib/fillStatus";
import {
  deriveSettledResults,
  estimateBuyCostFromTrades,
  isSettledHolding,
} from "../src/lib/settledResults";
import { readFileSync } from "fs";
import { join } from "path";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok  ${msg}`);
}

function checkFormat() {
  assert(formatRawBalance("1000000", 6) === "1", "1e6 @ 6dp → 1");
  assert(formatRawBalance("1500000", 6) === "1.5", "1.5e6 @ 6dp → 1.5");
  assert(formatRawBalance(0n, 6) === "0", "0n → 0");
  assert(formatRawBalance("123", 0) === "123", "0 decimals passthrough");
  assert(
    formatRawBalance("1000000000000000000", 18) === "1",
    "1e18 @ 18dp → 1",
  );
  // Raw integer strings must NOT be shown as-is for 6dp tokens.
  assert(
    formatRawBalance("2500000", 6) !== "2500000",
    "does not leave raw integer unscaled",
  );
}

function checkFillLabels() {
  assert(classifyFill({ dryRun: true, requested: 1 }) === "signal", "dry → signal");
  assert(
    classifyFill({ requested: 1, filled: 0, submitted: true }) === "zero-fill",
    "filled 0 → zero-fill",
  );
  assert(
    classifyFill({ requested: 2, filled: 1, submitted: true }) === "partial",
    "partial",
  );
  assert(
    classifyFill({ requested: 1, filled: 1, submitted: true }) === "full",
    "full",
  );
  assert(
    classifyFill({ requested: 1, filled: null, submitted: true }) === "submitted",
    "unknown qty → submitted",
  );

  assert(
    fillActivityTitle("Up", "signal") === "Up signal",
    "dry title is signal not fill",
  );
  assert(
    !fillActivityTitle("Up", "signal").toLowerCase().includes("fill (dry)"),
    "does not title dry-run as fill (dry)",
  );
  assert(
    fillActivityTitle("Down", "zero-fill") === "Down order did not fill",
    "zero-fill title",
  );
  assert(
    fillActivityTitle("Up", "full", 1).toLowerCase().includes("filled"),
    "full mentions filled",
  );
}

function checkClaimEligibilityLogic() {
  // Mirror clientExchange isPayoutEligible rules inline for regression.
  function eligible(opts: {
    status: string;
    voided: boolean;
    winningOutcome?: number | null;
    outcomeIndex: number;
    balanceRaw: string;
  }) {
    if (!opts.balanceRaw || opts.balanceRaw === "0") return false;
    const settled =
      opts.voided ||
      opts.status === "Voided" ||
      opts.status === "Resolved" ||
      opts.status === "Finalized";
    if (!settled) return false;
    if (opts.voided || opts.status === "Voided") return true;
    if (opts.winningOutcome == null) return false;
    return Number(opts.winningOutcome) === opts.outcomeIndex;
  }

  assert(
    !eligible({
      status: "Resolved",
      voided: false,
      winningOutcome: 0,
      outcomeIndex: 1,
      balanceRaw: "1000",
    }),
    "losing-only Down not claimable when Up won",
  );
  assert(
    eligible({
      status: "Resolved",
      voided: false,
      winningOutcome: 0,
      outcomeIndex: 0,
      balanceRaw: "1000",
    }),
    "winning Up is claimable",
  );
  assert(
    eligible({
      status: "Voided",
      voided: true,
      winningOutcome: null,
      outcomeIndex: 1,
      balanceRaw: "5",
    }),
    "voided either side claimable",
  );
  assert(
    !eligible({
      status: "Trading",
      voided: false,
      winningOutcome: null,
      outcomeIndex: 0,
      balanceRaw: "1000",
    }),
    "open Trading not claimable",
  );
}


function checkSettledResults() {
  assert(
    isSettledHolding({ status: "Resolved", voided: false }),
    "Resolved is settled",
  );
  assert(
    isSettledHolding({ status: "Finalized", voided: false }),
    "Finalized is settled",
  );
  assert(
    isSettledHolding({ status: "Trading", voided: true }),
    "voided flag is settled",
  );
  assert(
    !isSettledHolding({ status: "Trading", voided: false }),
    "Trading not settled",
  );

  const cost = estimateBuyCostFromTrades(
    [
      {
        marketAddress: "0xabc",
        side: "BUY_YES",
        fillPriceRaw: "500000", // 0.5 @ 6dp
        quantityRaw: "2000000", // 2
        quoteDecimals: 6,
      },
    ],
    "0xABC",
  );
  assert(cost != null && Math.abs(cost - 1) < 1e-9, "buy cost 2 * 0.5 = 1");

  const rows = deriveSettledResults({
    positions: [
      {
        marketId: "0xm1",
        marketAddress: "0xabc",
        asset: "BTC",
        intervalSec: 900,
        status: "Resolved",
        voided: false,
        winningOutcome: 0,
        outcomeIndex: 0,
        side: "Up",
        balance: "2",
        balanceRaw: "2000000",
        quoteDecimals: 6,
        claimable: true,
      },
      {
        marketId: "0xm2",
        marketAddress: "0xdef",
        asset: "ETH",
        intervalSec: 900,
        status: "Resolved",
        voided: false,
        winningOutcome: 0,
        outcomeIndex: 1,
        side: "Down",
        balance: "1",
        balanceRaw: "1000000",
        quoteDecimals: 6,
        claimable: false,
      },
      {
        marketId: "0xm3",
        asset: "BTC",
        intervalSec: 3600,
        status: "Voided",
        voided: true,
        winningOutcome: null,
        outcomeIndex: 0,
        side: "Up",
        balance: "1",
        balanceRaw: "1000000",
        quoteDecimals: 6,
        claimable: true,
      },
    ],
    redeems: [
      {
        id: "r1",
        marketId: "0xm4",
        amount: "1000000",
        payout: "1000000",
        timestamp: "1700000000",
        txHash: "0xtx",
      },
    ],
    trades: [
      {
        marketAddress: "0xabc",
        side: "BUY_YES",
        fillPriceRaw: "400000",
        quantityRaw: "2000000",
        quoteDecimals: 6,
      },
    ],
    localHints: [],
    marketMeta: {
      "0xm4": { asset: "SOL", intervalSec: 900, quoteDecimals: 6 },
    },
  });

  const kinds = rows.map((r) => r.kind).sort();
  assert(
    kinds.includes("Won") &&
      kinds.includes("Lost") &&
      kinds.includes("Void") &&
      kinds.includes("Claimed"),
    "derives Won/Lost/Void/Claimed",
  );
  const won = rows.find((r) => r.kind === "Won");
  assert(won != null && won.pnlAvailable, "Won has approx PnL from trade cost");
  const lost = rows.find((r) => r.kind === "Lost");
  assert(
    lost != null && !lost.pnlAvailable,
    "Lost without cost shows PnL unavailable",
  );
  const claimed = rows.find((r) => r.kind === "Claimed");
  assert(claimed?.asset === "SOL", "Claimed uses market meta asset");
  assert(claimed?.pnlLabel === "—" || claimed?.pnlAvailable === false, "Claimed without cost → no fake PnL");
}

async function main() {
  console.log("— formatRawBalance —");
  checkFormat();
  console.log("— fill status labels —");
  checkFillLabels();
  console.log("— claim eligibility —");
  checkClaimEligibilityLogic();
  console.log("— settled results —");
  checkSettledResults();
  console.log("— activity buffer —");
  const storeSrc = readFileSync(join(__dirname, "../src/lib/store.ts"), "utf8");
  const m = storeSrc.match(/ACTIVITY_LIMIT\s*=\s*(\d+)/);
  const limit = m ? Number(m[1]) : 0;
  assert(limit >= 100, `activity limit >= 100 (got ${limit})`);
  console.log("\nAll Stage 2 checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
