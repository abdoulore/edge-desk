import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getExchange } from "@/lib/exchange";
import {
  getClaimable,
  getMarkets,
  readActivity,
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
  let markets = getMarkets();
  if (markets.length === 0) {
    markets = await readMarkets();
  }

  let wallet: string | undefined;
  try {
    if (cfg.privateKey) {
      wallet = (getExchange() as { walletAddress?: string }).walletAddress;
    }
  } catch {
    /* ignore */
  }

  const body: DeskStatus = {
    ok: true,
    network: cfg.network,
    dryRun: cfg.dryRun,
    wallet,
    signal,
    claimable: getClaimable(),
    markets,
    activity,
    config: {
      network: cfg.network,
      dryRun: cfg.dryRun,
      edgeThreshold: cfg.edgeThreshold,
      copySize: cfg.copySize,
      venueId: cfg.venueId,
      preferredAsset: cfg.preferredAsset,
      preferredIntervalSec: cfg.preferredIntervalSec,
      agentIntervalMs: cfg.agentIntervalMs,
    },
    agentRunning: meta.agentRunning,
    lastTickAt: meta.lastTickAt,
  };

  return NextResponse.json(body);
}
