import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getExchange } from "@/lib/exchange";
import {
  readActivity,
  readClaimable,
  readMarkets,
  readMeta,
  readSignal,
} from "@/lib/store";
import type { DeskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const cfg = getConfig();
  const signal = await readSignal();
  const meta = await readMeta();
  const activity = await readActivity();
  const claimable = await readClaimable();
  const markets = await readMarkets();

  let wallet: string | undefined;
  try {
    if (cfg.privateKey) {
      wallet = (getExchange() as { walletAddress?: string }).walletAddress;
    }
  } catch {
    /* ignore */
  }

  const lastTickAt = meta.lastTickAt;
  const heartbeatAt = meta.agentHeartbeatAt ?? lastTickAt;
  const staleMs = Math.max(cfg.agentIntervalMs * 2.5, 20_000);
  const agentStalled =
    !heartbeatAt ||
    Date.now() - new Date(heartbeatAt).getTime() > staleMs;

  const body: DeskStatus = {
    ok: true,
    network: cfg.network,
    dryRun: cfg.dryRun,
    wallet,
    signal,
    claimable,
    markets,
    activity,
    config: {
      network: cfg.network,
      dryRun: cfg.dryRun,
      agentTrade: cfg.agentTrade,
      edgeThreshold: cfg.edgeThreshold,
      copySize: cfg.copySize,
      venueId: cfg.venueId,
      preferredAsset: cfg.preferredAsset,
      preferredIntervalSec: cfg.preferredIntervalSec,
      agentIntervalMs: cfg.agentIntervalMs,
    },
    agentRunning: meta.agentRunning && !agentStalled,
    agentStalled,
    paused: Boolean(meta.paused),
    lastTickAt,
    agentHeartbeatAt: meta.agentHeartbeatAt ?? null,
    focusMarketId: meta.focusMarketId ?? null,
    preferredMissing: Boolean(signal?.preferredMissing),
  };

  return NextResponse.json(body);
}
