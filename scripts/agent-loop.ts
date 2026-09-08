/**
 * Always-on Edge Desk worker. Run alongside `next start` on persistent disk:
 *   npm run agent
 *
 * Loads project-root `.env` so values match Next.js. Public `/api/agent/tick`
 * is secret-gated and must not be used as a second open scheduler.
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { runAgentTick } from "../src/agent/tick";
import { getConfig } from "../src/lib/config";
import { patchMeta, readMeta } from "../src/lib/store";

function loadProjectEnv() {
  const envPath = resolve(__dirname, "../.env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadProjectEnv();

async function beat() {
  const at = new Date().toISOString();
  try {
    await patchMeta({ agentHeartbeatAt: at, agentRunning: true });
  } catch (e) {
    console.error("[agent-loop] heartbeat failed:", e);
  }
}

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
      await beat();
      const meta = await readMeta();
      if (meta.paused) {
        console.log(
          JSON.stringify({ at: new Date().toISOString(), paused: true }),
        );
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
