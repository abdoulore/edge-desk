/**
 * Shared YES/NO outcome picking for loadMarkets() rows.
 * loadMarkets() keys by MARKET symbol (BTC-…/tUSDC); tradables are …#YES / …#NO
 * nested under outcomes — never top-level map keys.
 */

export type OutcomeLike = { symbol?: string; label?: string; index?: number };

export type PickedOutcomes = {
  upSymbol?: string;
  downSymbol?: string;
  marketSymbol?: string;
};

export function pickOutcomes(m: Record<string, unknown>): PickedOutcomes {
  const info = m.info as
    | { outcomes?: OutcomeLike[]; symbol?: string }
    | undefined;
  const outcomes =
    (m.outcomes as OutcomeLike[] | undefined) || info?.outcomes || undefined;
  const marketSymbol =
    (typeof m.symbol === "string" && m.symbol) ||
    (typeof info?.symbol === "string" && info.symbol) ||
    undefined;

  if (!outcomes?.length) return { marketSymbol };

  const norm = (s?: string) => String(s || "").toUpperCase();
  const byLabel = (...labels: string[]) => {
    const wanted = labels.map((l) => l.toUpperCase());
    return (
      outcomes.find((o) => wanted.includes(norm(o.label)))?.symbol ||
      outcomes.find((o) =>
        wanted.some((l) => norm(o.symbol).endsWith(`#${l}`)),
      )?.symbol
    );
  };

  // Unified SDK: Up == YES (index 0), Down == NO (index 1)
  const upSymbol =
    byLabel("YES", "UP") ||
    outcomes.find((o) => o.index === 0)?.symbol ||
    outcomes[0]?.symbol;
  const downSymbol =
    byLabel("NO", "DOWN") ||
    outcomes.find((o) => o.index === 1)?.symbol ||
    outcomes[1]?.symbol;

  return { upSymbol, downSymbol, marketSymbol };
}

/** Split a tradable (…#YES) into base market symbol + outcome label. */
export function splitOutcomeSymbol(symbol: string): {
  base: string;
  outcome?: "YES" | "NO" | string;
} {
  const i = symbol.indexOf("#");
  if (i === -1) return { base: symbol };
  const outcome = symbol.slice(i + 1).toUpperCase() || undefined;
  return { base: symbol.slice(0, i), outcome };
}

export function marketIdOf(entry: unknown): string {
  if (!entry || typeof entry !== "object") return "";
  const m = entry as Record<string, unknown>;
  const info = m.info as Record<string, unknown> | undefined;
  return String(info?.marketId || m.id || "").toLowerCase();
}

/**
 * Normalize only the asset-prefix / strike segment before the first `/`,
 * carefully mapping lone letter-O digits that look like zero in strike codes
 * (e.g. BTC-O-09SEP → BTC-0-09SEP). Leaves quote and #outcome alone.
 */
export function normalizeMarketKeySegment(symbol: string): string {
  const { base, outcome } = splitOutcomeSymbol(symbol);
  const slash = base.indexOf("/");
  const left = slash === -1 ? base : base.slice(0, slash);
  const right = slash === -1 ? "" : base.slice(slash);
  // Replace O that sits between hyphens as a lone strike token: -O- → -0-
  const normalizedLeft = left.replace(/-O-(?=\d|[A-Z])/gi, "-0-").replace(/-O$/i, "-0");
  const rebuilt = `${normalizedLeft}${right}`;
  return outcome ? `${rebuilt}#${outcome}` : rebuilt;
}

function pickRequestedOutcome(
  picked: PickedOutcomes,
  requestedOutcome?: string,
): string | undefined {
  const o = (requestedOutcome || "YES").toUpperCase();
  if (o === "NO" || o === "DOWN") return picked.downSymbol || picked.upSymbol;
  if (o === "YES" || o === "UP") return picked.upSymbol || picked.downSymbol;
  // Unknown label — prefer exact suffix match on picked symbols
  if (picked.upSymbol?.toUpperCase().endsWith(`#${o}`)) return picked.upSymbol;
  if (picked.downSymbol?.toUpperCase().endsWith(`#${o}`)) return picked.downSymbol;
  return picked.upSymbol || picked.downSymbol;
}

function findKeyCI(
  map: Record<string, unknown>,
  key: string,
): { key: string; entry: Record<string, unknown> } | null {
  if (key in map && map[key] && typeof map[key] === "object") {
    return { key, entry: map[key] as Record<string, unknown> };
  }
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (k.toLowerCase() === lower && v && typeof v === "object") {
      return { key: k, entry: v as Record<string, unknown> };
    }
  }
  return null;
}

export type ResolveMarketSymbolResult =
  | { ok: true; symbol: string; marketKey: string }
  | { ok: false; message: string };

/**
 * Resolve a tradable outcome symbol against a loadMarkets() map.
 * Prefers direct / base-key lookup, then marketId + pickOutcomes, then fuzzy.
 */
export function resolveMarketSymbol(
  map: Record<string, unknown>,
  opts: { symbol: string; marketId?: string },
): ResolveMarketSymbolResult {
  const { symbol, marketId } = opts;
  if (!symbol) return { ok: false, message: "Missing outcome symbol" };

  const { base, outcome } = splitOutcomeSymbol(symbol);
  const wantMid = marketId ? marketId.toLowerCase() : "";

  const finish = (
    entry: Record<string, unknown>,
    marketKey: string,
    requested = outcome,
  ): ResolveMarketSymbolResult => {
    const picked = pickOutcomes(entry);
    const resolved =
      pickRequestedOutcome(picked, requested) ||
      (outcome ? `${marketKey}#${outcome}` : picked.marketSymbol || marketKey);
    if (!resolved) {
      return {
        ok: false,
        message: `Unknown symbol ${symbol} after loadMarkets — market mapping missing`,
      };
    }
    if (wantMid) {
      const mid = marketIdOf(entry);
      if (mid && mid !== wantMid) {
        return {
          ok: false,
          message: `Symbol ${symbol} maps to market ${mid}, not ${marketId}`,
        };
      }
    }
    return { ok: true, symbol: resolved, marketKey };
  };

  // 1) Direct key (rare for #YES tradables — map is market-keyed)
  let hit = findKeyCI(map, symbol);
  if (hit) {
    // If the key itself is a tradable, return it; else pick outcome from entry
    if (symbol.includes("#")) return finish(hit.entry, hit.key, outcome);
    return finish(hit.entry, hit.key, outcome || "YES");
  }

  // 2) Base market key (strip #YES/#NO) — primary path for wallet trades
  if (outcome) {
    hit = findKeyCI(map, base);
    if (hit) return finish(hit.entry, hit.key, outcome);
  }

  // 3) Resolve by marketId (agent path parity with loadOutcomeIndex)
  if (wantMid) {
    for (const [k, v] of Object.entries(map)) {
      if (!v || typeof v !== "object") continue;
      const entry = v as Record<string, unknown>;
      if (marketIdOf(entry) !== wantMid) continue;
      return finish(entry, k, outcome || "YES");
    }
  }

  // 4) Scan nested outcomes for exact / case-insensitive tradable match
  const lowerSym = symbol.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (!v || typeof v !== "object") continue;
    const entry = v as Record<string, unknown>;
    const picked = pickOutcomes(entry);
    for (const s of [picked.upSymbol, picked.downSymbol]) {
      if (s && s.toLowerCase() === lowerSym) {
        if (wantMid) {
          const mid = marketIdOf(entry);
          if (mid && mid !== wantMid) continue;
        }
        return { ok: true, symbol: s, marketKey: k };
      }
    }
  }

  // 5) Fuzzy: normalize O/0 in asset-prefix, retry base lookup
  const fuzzy = normalizeMarketKeySegment(symbol);
  if (fuzzy !== symbol) {
    const { base: fBase, outcome: fOut } = splitOutcomeSymbol(fuzzy);
    hit = findKeyCI(map, fuzzy) || (fOut ? findKeyCI(map, fBase) : null);
    if (hit) return finish(hit.entry, hit.key, fOut || outcome || "YES");
  }

  // 6) Fuzzy: same #YES/#NO suffix + shared marketId fragment in key
  if (outcome) {
    const suffix = `#${outcome}`.toLowerCase();
    const needle = base.toLowerCase();
    for (const [k, v] of Object.entries(map)) {
      if (!v || typeof v !== "object") continue;
      const entry = v as Record<string, unknown>;
      if (wantMid && marketIdOf(entry) !== wantMid) continue;
      const picked = pickOutcomes(entry);
      const cand = pickRequestedOutcome(picked, outcome);
      if (!cand) continue;
      if (!cand.toLowerCase().endsWith(suffix)) continue;
      // Require substantial overlap with requested base (expiry token etc.)
      const marketKey = (picked.marketSymbol || k).toLowerCase();
      const expiryHit =
        /-\d{2}[a-z]{3}\d{2}(?:-\d{4})?/i.exec(base)?.[0]?.toLowerCase() || "";
      if (
        marketKey === needle ||
        (expiryHit && marketKey.includes(expiryHit.replace(/^-/, "")))
      ) {
        return { ok: true, symbol: cand, marketKey: k };
      }
    }
  }

  return {
    ok: false,
    message: `Unknown symbol ${symbol} after loadMarkets — market mapping missing`,
  };
}
