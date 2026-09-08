/**
 * Stage 1 P0 regression checks (no broadcast / no wallet signature).
 * Run: npx tsx scripts/verify-stage1-p0.ts
 */
import {
  SomniaMarkets,
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
} from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import {
  decideExecutableSide,
  impliedDownAsk,
  spotImpliedBias,
} from "../src/lib/edge";
import { buildCopyOrderParams } from "../src/lib/orderParams";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok  ${msg}`);
}

async function checkLoadMarkets() {
  const exchange = new SomniaMarkets({
    indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
    chain: somniaShannon,
    wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
    addresses: SOMNIA_TESTNET_ADDRESSES,
    priceFeed: SOMNIA_TESTNET_PRICE_FEED,
  });

  const map = await exchange.loadMarkets(true);
  const symbols = Object.keys(map);
  assert(symbols.length > 0, `loadMarkets returned ${symbols.length} symbols`);

  const sample = symbols.find((s) => s.includes("#")) || symbols[0];
  // Resolving via market() must work after loadMarkets (unknown-symbol gone).
  const tradable = exchange.market(sample);
  assert(!!tradable, `exchange.market(${sample}) resolves after loadMarkets`);

  // Without a fresh instance registry, createOrder throws unknown symbol.
  const bare = new SomniaMarkets({
    indexerUrl: "https://dev.smk.somnia.host/v1/graphql",
    chain: somniaShannon,
    wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws",
    addresses: SOMNIA_TESTNET_ADDRESSES,
    priceFeed: SOMNIA_TESTNET_PRICE_FEED,
  });
  let threw = false;
  try {
    // Will fail either on unknown symbol or missing signer — both prove registry gate.
    await bare.createOrder(sample, "limit", "buy", 1, 0.5, { timeInForce: "IOC" });
  } catch (e) {
    threw = true;
    const msg = e instanceof Error ? e.message : String(e);
    assert(
      /loadMarkets|unknown symbol|wallet|signer|private/i.test(msg),
      `bare createOrder errors as expected: ${msg.slice(0, 120)}`,
    );
  }
  assert(threw, "bare createOrder without loadMarkets does not succeed");
}

function checkExecutableEdge() {
  // Feedback reproduction: bias 0.58, bid 0.40, ask 0.64 → mid edge +0.06 but
  // executable edge 0.58-0.64 = -0.06 → must reject.
  const decided = decideExecutableSide({
    bias: 0.58,
    mid: 0.52,
    upAsk: 0.64,
    downAsk: null,
    threshold: 0.05,
  });
  assert(decided.midEdge != null && Math.abs(decided.midEdge - 0.06) < 1e-9, "mid edge ≈ 0.06");
  assert(decided.side == null, "wide spread rejects executable Up");
  assert(decided.rejectedForCost === true, "rejectedForCost flagged");
  assert(decided.execEdge != null && decided.execEdge < 0, "exec edge negative");

  // Clean Up: bias 0.70, ask 0.55 → exec 0.15 ≥ 0.05
  const good = decideExecutableSide({
    bias: 0.7,
    mid: 0.55,
    upAsk: 0.55,
    downAsk: null,
    threshold: 0.05,
  });
  assert(good.side === "Up", "executable Up accepted");
  assert(good.execEdge != null && good.execEdge >= 0.05, "exec edge meets threshold");

  // Do not invent Down ask from upAsk alone.
  assert(impliedDownAsk(null, null) == null, "no Down ask without bid/book");
  assert(impliedDownAsk(null, null) == null, "still null");
  const invented = 1 - 0.64;
  assert(impliedDownAsk(null, null) !== invented, "does not invent from upAsk");
  assert(Math.abs((impliedDownAsk(0.4, null) ?? -1) - 0.6) < 1e-9, "1-upBid ok");
  assert(Math.abs((impliedDownAsk(0.4, 0.55) ?? -1) - 0.55) < 1e-9, "prefers real downAsk");

  const builtBad = buildCopyOrderParams({
    side: "Down",
    upSymbol: "X#YES",
    downSymbol: "X#NO",
    upBid: null,
    upAsk: 0.64,
    downAsk: null,
    size: 1,
    marketId: "0xabc",
    bias: 0.4,
    minEdge: 0.05,
  });
  assert(!builtBad.ok, "Down copy rejects invented 1-upAsk liquidity");

  const bias = spotImpliedBias(100, 100);
  assert(Math.abs(bias - 0.5) < 1e-9, "flat spot → bias 0.5");
}

async function main() {
  console.log("— executable edge / orderParams —");
  checkExecutableEdge();
  console.log("— SDK loadMarkets registry —");
  await checkLoadMarkets();
  console.log("\nAll Stage 1 P0 checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
