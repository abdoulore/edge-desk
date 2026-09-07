import { runAgentTick } from "../src/agent/tick";
import { getConfig } from "../src/lib/config";
import { readMeta } from "../src/lib/store";

async function main() {
  const cfg = getConfig();
  console.log(
    "Edge Desk agent network=" +
      cfg.network +
      " dryRun=" +
      cfg.dryRun +
      " agentTrade=" +
      cfg.agentTrade,
  );
  while (true) {
    try {
      const meta = await readMeta();
      if (meta.paused) {
        console.log(JSON.stringify({ at: new Date().toISOString(), paused: true }));
      } else {
        const signal = await runAgentTick();
        console.log(
          JSON.stringify({
            at: signal.updatedAt,
            marketId: signal.marketId,
            upMid: signal.upMid,
            edge: signal.edge,
            side: signal.recommendedSide,
            spotSource: signal.spotSource,
            preferredMissing: signal.preferredMissing,
            reason: signal.reason,
            error: signal.error,
          }),
        );
      }
    } catch (e) {
      console.error(e);
    }
    await new Promise((r) => setTimeout(r, cfg.agentIntervalMs));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
