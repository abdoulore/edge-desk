import { promises as fs } from "fs";
import path from "path";
import type {
  ActivityEvent,
  ClaimablePosition,
  DeskSignal,
  LastTrade,
  MarketSummary,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const SIGNAL_PATH = path.join(DATA_DIR, "lastSignal.json");
const META_PATH = path.join(DATA_DIR, "meta.json");
const ACTIVITY_PATH = path.join(DATA_DIR, "activity.json");
const MARKETS_PATH = path.join(DATA_DIR, "markets.json");

const ACTIVITY_LIMIT = 20;

export interface DeskMeta {
  agentRunning: boolean;
  lastTickAt: string | null;
  lastError?: string;
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readSignal(): Promise<DeskSignal | null> {
  try {
    const raw = await fs.readFile(SIGNAL_PATH, "utf8");
    return JSON.parse(raw) as DeskSignal;
  } catch {
    return null;
  }
}

export async function writeSignal(signal: DeskSignal): Promise<void> {
  await ensureDir();
  await fs.writeFile(SIGNAL_PATH, JSON.stringify(signal, null, 2), "utf8");
}

export async function readMeta(): Promise<DeskMeta> {
  try {
    const raw = await fs.readFile(META_PATH, "utf8");
    return JSON.parse(raw) as DeskMeta;
  } catch {
    return { agentRunning: false, lastTickAt: null };
  }
}

export async function writeMeta(meta: DeskMeta): Promise<void> {
  await ensureDir();
  await fs.writeFile(META_PATH, JSON.stringify(meta, null, 2), "utf8");
}

export async function updateLastTrade(trade: LastTrade): Promise<DeskSignal | null> {
  const signal = await readSignal();
  if (!signal) return null;
  const next = { ...signal, lastTrade: trade, updatedAt: new Date().toISOString() };
  await writeSignal(next);
  return next;
}

/** In-memory claimable cache updated by agent tick */
let claimableCache: ClaimablePosition[] = [];

export function setClaimable(rows: ClaimablePosition[]) {
  claimableCache = rows;
}

export function getClaimable(): ClaimablePosition[] {
  return claimableCache;
}

/** Markets list — memory + disk mirror */
let marketsCache: MarketSummary[] = [];

export function setMarkets(rows: MarketSummary[]) {
  marketsCache = rows;
  void persistMarkets(rows);
}

export function getMarkets(): MarketSummary[] {
  return marketsCache;
}

async function persistMarkets(rows: MarketSummary[]) {
  try {
    await ensureDir();
    await fs.writeFile(MARKETS_PATH, JSON.stringify(rows, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

export async function readMarkets(): Promise<MarketSummary[]> {
  if (marketsCache.length > 0) return marketsCache;
  try {
    const raw = await fs.readFile(MARKETS_PATH, "utf8");
    const rows = JSON.parse(raw) as MarketSummary[];
    marketsCache = rows;
    return rows;
  } catch {
    return [];
  }
}

/** Activity ring buffer — last N events */
let activityCache: ActivityEvent[] | null = null;

export async function readActivity(): Promise<ActivityEvent[]> {
  if (activityCache) return activityCache;
  try {
    const raw = await fs.readFile(ACTIVITY_PATH, "utf8");
    activityCache = JSON.parse(raw) as ActivityEvent[];
    return activityCache;
  } catch {
    activityCache = [];
    return activityCache;
  }
}

export async function appendActivity(
  event: Omit<ActivityEvent, "id"> & { id?: string },
): Promise<ActivityEvent[]> {
  const list = await readActivity();
  const next: ActivityEvent = {
    ...event,
    id: event.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  // Dedupe near-identical tick events within ~2s
  if (
    next.kind === "tick" &&
    list[0]?.kind === "tick" &&
    list[0].marketId === next.marketId &&
    Math.abs(new Date(list[0].at).getTime() - new Date(next.at).getTime()) < 2000
  ) {
    list[0] = { ...list[0], ...next, id: list[0].id };
  } else {
    list.unshift(next);
  }
  activityCache = list.slice(0, ACTIVITY_LIMIT);
  await ensureDir();
  await fs.writeFile(ACTIVITY_PATH, JSON.stringify(activityCache, null, 2), "utf8");
  return activityCache;
}
