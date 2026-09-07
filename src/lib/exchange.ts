import {
  SomniaMarkets,
  SOMNIA_MAINNET_ADDRESSES,
  SOMNIA_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED,
} from "@somnia-chain/markets-sdk";
import { somniaMainnet, somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { getConfig } from "./config";

let cached: SomniaMarkets | null = null;
let cachedKey: string | null = null;

export function getExchange(): SomniaMarkets {
  const cfg = getConfig();
  const key = `${cfg.network}:${cfg.privateKey ? "signed" : "ro"}:${cfg.indexerUrl}`;
  if (cached && cachedKey === key) return cached;

  const isTestnet = cfg.network === "testnet";
  const exchange = new SomniaMarkets({
    indexerUrl: cfg.indexerUrl,
    chain: isTestnet ? somniaShannon : somniaMainnet,
    wsRpcUrl: cfg.wsRpcUrl,
    addresses: isTestnet ? SOMNIA_TESTNET_ADDRESSES : SOMNIA_MAINNET_ADDRESSES,
    // Spot index for edge math (testnet price-feed indexer).
    ...(isTestnet ? { priceFeed: SOMNIA_TESTNET_PRICE_FEED } : {}),
    ...(cfg.privateKey ? { privateKey: cfg.privateKey as `0x${string}` } : {}),
  });

  cached = exchange;
  cachedKey = key;
  return exchange;
}

export function statusLabel(code: number): import("./types").MarketStatusLabel {
  switch (code) {
    case 0:
      return "Listed";
    case 1:
      return "Trading";
    case 2:
      return "Locked";
    case 3:
      return "Settling";
    case 4:
      return "Resolved";
    case 5:
      return "Voided";
    default:
      return "Unknown";
  }
}

export function oracleGraphUrl(questionId?: string | null): string | undefined {
  if (!questionId) return undefined;
  const id = String(questionId);
  if (!id || id === "0x" || id === "0x0") return undefined;
  return `https://prd.oracle.somnia.host/questions/${id}?view=graph`;
}
