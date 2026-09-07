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

  return {
    network: isTestnet ? "testnet" : "mainnet",
    privateKey: process.env.PRIVATE_KEY || undefined,
    dryRun: envBool("DRY_RUN", true),
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
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
