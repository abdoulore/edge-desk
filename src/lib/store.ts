import { promises as fs } from "fs";
import path from "path";
import type {
  ActivityEvent,
  ClaimablePosition,
  DeskSignal,
  LastTrade,
  MarketSummary,
} from "./types";

/** Override for tests; default is <cwd>/data. */
function dataDir(): string {
  return process.env.EDGE_DESK_DATA_DIR || path.join(process.cwd(), "data");
}

function signalPath() {
  return path.join(dataDir(), "lastSignal.json");
}
function metaPath() {
  return path.join(dataDir(), "meta.json");
}
function activityPath() {
  return path.join(dataDir(), "activity.json");
}
function marketsPath() {
  return path.join(dataDir(), "markets.json");
}
function claimablePath() {
  return path.join(dataDir(), "claimable.json");
}

const ACTIVITY_LIMIT = 100;

export interface DeskMeta {
  agentRunning: boolean;
  lastTickAt: string | null;
  /** Updated by the always-on agent loop each cycle (including when paused). */
  agentHeartbeatAt?: string | null;
  lastError?: string;
  paused?: boolean;
  focusMarketId?: string | null;
}

type CacheSlot<T> = {
  mtimeMs: number;
  data: T;
};

let claimableCache: CacheSlot<ClaimablePosition[]> | null = null;
let marketsCache: CacheSlot<MarketSummary[]> | null = null;
let activityCache: CacheSlot<ActivityEvent[]> | null = null;

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

async function fileMtimeMs(filePath: string): Promise<number | null> {
  try {
    const st = await fs.stat(filePath);
    return st.mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Atomic JSON persistence: write temp sibling then rename.
 * Errors are logged and rethrown (never silently swallowed).
 */
export async function writeJsonAtomic(
  filePath: string,
  data: unknown,
): Promise<void> {
  await ensureDir();
  const dir = path.dirname(filePath);
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  const payload = JSON.stringify(data, null, 2);
  try {
    await fs.writeFile(tmp, payload, "utf8");
    await fs.rename(tmp, filePath);
  } catch (err) {
    console.error(`[store] write failed for ${filePath}:`, err);
    try {
      await fs.unlink(tmp);
    } catch {
      /* ignore cleanup */
    }
    throw err;
  }
}

async function readJsonFile<T>(filePath: string): Promise<{
  data: T;
  mtimeMs: number;
} | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const st = await fs.stat(filePath);
    return { data: JSON.parse(raw) as T, mtimeMs: st.mtimeMs };
  } catch {
    return null;
  }
}

/** Reload from disk when mtime changes (cross-process consistency). */
async function readCached<T>(
  filePath: string,
  slot: CacheSlot<T> | null,
  empty: T,
): Promise<{ data: T; slot: CacheSlot<T> }> {
  const mtime = await fileMtimeMs(filePath);
  if (slot && mtime != null && slot.mtimeMs === mtime) {
    return { data: slot.data, slot };
  }
  const loaded = await readJsonFile<T>(filePath);
  if (!loaded) {
    const next: CacheSlot<T> = { mtimeMs: mtime ?? 0, data: empty };
    return { data: empty, slot: next };
  }
  const next: CacheSlot<T> = { mtimeMs: loaded.mtimeMs, data: loaded.data };
  return { data: loaded.data, slot: next };
}

async function rememberWrite<T>(
  filePath: string,
  data: T,
): Promise<CacheSlot<T>> {
  await writeJsonAtomic(filePath, data);
  const mtime = (await fileMtimeMs(filePath)) ?? Date.now();
  return { mtimeMs: mtime, data };
}

export async function readSignal(): Promise<DeskSignal | null> {
  try {
    const raw = await fs.readFile(signalPath(), "utf8");
    return JSON.parse(raw) as DeskSignal;
  } catch {
    return null;
  }
}

export async function writeSignal(signal: DeskSignal): Promise<void> {
  await writeJsonAtomic(signalPath(), signal);
}

export async function readMeta(): Promise<DeskMeta> {
  try {
    const raw = await fs.readFile(metaPath(), "utf8");
    return JSON.parse(raw) as DeskMeta;
  } catch {
    return {
      agentRunning: false,
      lastTickAt: null,
      agentHeartbeatAt: null,
      paused: false,
      focusMarketId: null,
    };
  }
}

export async function writeMeta(meta: DeskMeta): Promise<void> {
  await writeJsonAtomic(metaPath(), meta);
}

export async function patchMeta(patch: Partial<DeskMeta>): Promise<DeskMeta> {
  const cur = await readMeta();
  const next = { ...cur, ...patch };
  await writeMeta(next);
  return next;
}

export async function updateLastTrade(
  trade: LastTrade,
): Promise<DeskSignal | null> {
  const signal = await readSignal();
  if (!signal) return null;
  const next = {
    ...signal,
    lastTrade: trade,
    updatedAt: new Date().toISOString(),
  };
  await writeSignal(next);
  return next;
}

/** In-memory claimable cache + disk mirror (mtime-validated). */
export function setClaimable(rows: ClaimablePosition[]) {
  claimableCache = { mtimeMs: claimableCache?.mtimeMs ?? Date.now(), data: rows };
  void persistClaimable(rows);
}

export function getClaimable(): ClaimablePosition[] {
  return claimableCache?.data ?? [];
}

async function persistClaimable(rows: ClaimablePosition[]) {
  try {
    claimableCache = await rememberWrite(claimablePath(), rows);
  } catch (err) {
    console.error("[store] persistClaimable failed:", err);
  }
}

export async function readClaimable(): Promise<ClaimablePosition[]> {
  const { data, slot } = await readCached<ClaimablePosition[]>(
    claimablePath(),
    claimableCache,
    [],
  );
  claimableCache = slot;
  return data;
}

/** Markets list — memory + disk mirror (mtime-validated). */
export function setMarkets(rows: MarketSummary[]) {
  marketsCache = { mtimeMs: marketsCache?.mtimeMs ?? Date.now(), data: rows };
  void persistMarkets(rows);
}

export function getMarkets(): MarketSummary[] {
  return marketsCache?.data ?? [];
}

async function persistMarkets(rows: MarketSummary[]) {
  try {
    marketsCache = await rememberWrite(marketsPath(), rows);
  } catch (err) {
    console.error("[store] persistMarkets failed:", err);
  }
}

export async function readMarkets(): Promise<MarketSummary[]> {
  const { data, slot } = await readCached<MarketSummary[]>(
    marketsPath(),
    marketsCache,
    [],
  );
  marketsCache = slot;
  return data;
}

/** Activity ring buffer — last N events (mtime-validated). */
export async function readActivity(): Promise<ActivityEvent[]> {
  const { data, slot } = await readCached<ActivityEvent[]>(
    activityPath(),
    activityCache,
    [],
  );
  activityCache = slot;
  return data;
}

export async function appendActivity(
  event: Omit<ActivityEvent, "id"> & { id?: string },
): Promise<ActivityEvent[]> {
  const list = await readActivity();
  const next: ActivityEvent = {
    ...event,
    id: event.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  if (
    next.kind === "tick" &&
    list[0]?.kind === "tick" &&
    list[0].marketId === next.marketId &&
    Math.abs(new Date(list[0].at).getTime() - new Date(next.at).getTime()) <
      2000
  ) {
    list[0] = { ...list[0], ...next, id: list[0].id };
  } else {
    list.unshift(next);
  }
  const trimmed = list.slice(0, ACTIVITY_LIMIT);
  activityCache = await rememberWrite(activityPath(), trimmed);
  return activityCache.data;
}

/** Test helper: drop in-memory caches without touching disk. */
export function __resetStoreCachesForTests() {
  claimableCache = null;
  marketsCache = null;
  activityCache = null;
}
