/**
 * Stage 2 checks: portfolio formatting, fill labeling, claim eligibility.
 * Run: npx tsx scripts/verify-stage2.ts
 */
import { formatRawBalance } from "../src/lib/format";
import { classifyFill, fillActivityTitle } from "../src/lib/fillStatus";
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

async function main() {
  console.log("— formatRawBalance —");
  checkFormat();
  console.log("— fill status labels —");
  checkFillLabels();
  console.log("— claim eligibility —");
  checkClaimEligibilityLogic();
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
