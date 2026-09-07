export function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export function envNum(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function getConfig() {
  const network = (process.env.NETWORK || "testnet").toLowerCase();
  const isTestnet = network !== "mainnet";

  // Agent live trading is off by default. Even if DRY_RUN=false, AGENT_TRADE
  // must be explicitly true for the server agent to place IOC from PRIVATE_KEY.
  const agentTrade = envBool("AGENT_TRADE", false);
  const dryRunEnv = envBool("DRY_RUN", true);
  // Effective dry-run for the server agent: always dry unless AGENT_TRADE=true
  // and DRY_RUN=false. Product default is signal-only.
  const dryRun = !agentTrade || dryRunEnv;

  return {
    network: isTestnet ? ("testnet" as const) : ("mainnet" as const),
    /** Optional — only needed for gated server mutations / optional agent live trade. */
    privateKey: process.env.PRIVATE_KEY || undefined,
    dryRun,
    /** Explicit gate for server-side agent IOC. Default false. */
    agentTrade,
    edgeThreshold: envNum("EDGE_THRESHOLD", 0.05),
    copySize: envNum("COPY_SIZE", 1),
    venueId:
      process.env.VENUE_ID ||
      (isTestnet
        ? "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c"
        : "0x458b30c2d72bfd2c6317304a4594ecbafe5f729d3111b65fdc3a33bd48e5432d"),
    indexerUrl:
      process.env.INDEXER_URL ||
      (isTestnet
        ? "https://dev.smk.somnia.host/v1/graphql"
        : "https://prd.smk.somnia.host/v1/graphql"),
    wsRpcUrl:
      process.env.WS_RPC_URL ||
      (isTestnet
        ? "wss://api.infra.testnet.somnia.network/ws"
        : "wss://api.infra.mainnet.somnia.network/ws"),
    httpRpcUrl:
      process.env.HTTP_RPC_URL ||
      (isTestnet
        ? "https://api.infra.testnet.somnia.network"
        : "https://api.infra.mainnet.somnia.network"),
    preferredAsset: (process.env.PREFERRED_ASSET || "BTC").toUpperCase(),
    preferredIntervalSec: envNum("PREFERRED_INTERVAL_SEC", 900),
    agentIntervalMs: envNum("AGENT_INTERVAL_MS", 8000),
    /** When set, custodial POST /api/copy|/api/claim require this header. */
    edgeDeskSecret: process.env.EDGE_DESK_SECRET || undefined,
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
