import { promises as fs } from "fs";
import path from "path";
import type { ClaimablePosition, DeskSignal, LastTrade } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const SIGNAL_PATH = path.join(DATA_DIR, "lastSignal.json");
const META_PATH = path.join(DATA_DIR, "meta.json");

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
