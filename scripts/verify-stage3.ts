/**
 * Stage 3 checks: atomic JSON writes + cross-writer cache invalidation.
 * Run: npx tsx scripts/verify-stage3.ts
 */
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok  ${msg}`);
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "edge-desk-s3-"));
  process.env.EDGE_DESK_DATA_DIR = dir;

  // Fresh module load so DATA_DIR / caches pick up the env override.
  const store = await import("../src/lib/store");
  store.__resetStoreCachesForTests();

  console.log("— atomic write helper —");
  const target = join(dir, "probe.json");
  await store.writeJsonAtomic(target, { hello: "world", n: 1 });
  const raw = readFileSync(target, "utf8");
  assert(JSON.parse(raw).hello === "world", "atomic write persists JSON");
  // No leftover temp siblings beside the final file.
  const { readdirSync } = await import("fs");
  const leftovers = readdirSync(dir).filter((f) => f.includes(".tmp"));
  assert(leftovers.length === 0, "no leftover .tmp files after atomic write");

  console.log("— activity cache invalidation across external update —");
  await store.appendActivity({
    kind: "tick",
    at: new Date().toISOString(),
    title: "seed",
  });
  let activity = await store.readActivity();
  assert(activity.length === 1 && activity[0].title === "seed", "seed activity readable");

  // Simulate another process rewriting the backing file after our cache warmed.
  const activityPath = join(dir, "activity.json");
  const external = [
    {
      id: "external-1",
      kind: "trade",
      at: new Date().toISOString(),
      title: "from-other-process",
    },
  ];
  // Ensure mtime advances even on fast FS.
  await new Promise((r) => setTimeout(r, 20));
  await store.writeJsonAtomic(activityPath, external);

  // Without invalidation this would still return the stale seeded cache.
  activity = await store.readActivity();
  assert(
    activity.length === 1 && activity[0].title === "from-other-process",
    "readActivity refreshes when file mtime/content changes",
  );

  console.log("— claimable / markets invalidation —");
  store.setClaimable([]);
  // wait for fire-and-forget persist
  await new Promise((r) => setTimeout(r, 30));
  await store.readClaimable();
  await new Promise((r) => setTimeout(r, 20));
  await store.writeJsonAtomic(join(dir, "claimable.json"), [
    {
      marketId: "m1",
      asset: "BTC",
      intervalSec: 900,
      status: "Resolved",
      upBalance: "1",
      downBalance: "0",
    },
  ]);
  const claimable = await store.readClaimable();
  assert(
    claimable.length === 1 && claimable[0].marketId === "m1",
    "readClaimable sees external writer update",
  );

  store.setMarkets([]);
  await new Promise((r) => setTimeout(r, 30));
  await store.readMarkets();
  await new Promise((r) => setTimeout(r, 20));
  await store.writeJsonAtomic(join(dir, "markets.json"), [
    {
      marketId: "m2",
      asset: "ETH",
      intervalSec: 900,
      expiry: 0,
      status: "Trading",
      statusCode: 1,
      upMid: 0.5,
    },
  ]);
  const markets = await store.readMarkets();
  assert(
    markets.length === 1 && markets[0].marketId === "m2",
    "readMarkets sees external writer update",
  );

  console.log("— activity limit still 100 —");
  const storeSrc = readFileSync(join(__dirname, "../src/lib/store.ts"), "utf8");
  const m = storeSrc.match(/ACTIVITY_LIMIT\s*=\s*(\d+)/);
  assert(m && Number(m[1]) >= 100, `activity limit >= 100 (got ${m && m[1]})`);
  assert(storeSrc.includes("writeJsonAtomic"), "store exports/uses writeJsonAtomic");
  assert(storeSrc.includes("mtimeMs") || storeSrc.includes("mtime"), "store tracks file mtime for cache");

  console.log("— agent-loop loads .env —");
  const loopSrc = readFileSync(join(__dirname, "agent-loop.ts"), "utf8");
  assert(loopSrc.includes("loadProjectEnv") || loopSrc.includes(".env"), "agent-loop loads project .env");
  assert(loopSrc.includes("agentHeartbeatAt"), "agent-loop writes heartbeat");

  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  console.log("\nAll Stage 3 checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
