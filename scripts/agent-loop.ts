import { runAgentTick } from "../src/agent/tick";
import { getConfig } from "../src/lib/config";

async function main() {
  const cfg = getConfig();
  console.log("Edge Desk agent network=" + cfg.network + " dryRun=" + cfg.dryRun);
  while (true) {
    try {
      const signal = await runAgentTick();
      console.log(JSON.stringify({ at: signal.updatedAt, marketId: signal.marketId, upMid: signal.upMid, edge: signal.edge, side: signal.recommendedSide, reason: signal.reason, error: signal.error }));
    } catch (e) {
      console.error(e);
    }
    await new Promise((r) => setTimeout(r, cfg.agentIntervalMs));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
