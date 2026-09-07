export type Side = "Up" | "Down";

export type MarketStatusLabel =
  | "Listed"
  | "Trading"
  | "Locked"
  | "Settling"
  | "Resolved"
  | "Voided"
  | "Unknown";

export interface LastTrade {
  marketId: string;
  symbol: string;
  side: Side;
  size: number;
  price: number;
  edge: number;
  reason: string;
  txHash?: string;
  dryRun: boolean;
  at: string;
}

export interface DeskSignal {
  marketId: string;
  symbol: string;
  upSymbol: string;
  downSymbol: string;
  asset: string;
  intervalSec: number;
  expiry: number;
  tradingStart?: number;
  status: MarketStatusLabel;
  statusCode: number;
  upBid: number | null;
  upAsk: number | null;
  upMid: number | null;
  spot: number | null;
  reference: number | null;
  spotImpliedBias: number | null;
  edge: number | null;
  recommendedSide: Side | null;
  reason: string;
  oracleQuestionId?: string;
  oracleGraphUrl?: string;
  dryRun: boolean;
  edgeThreshold: number;
  copySize: number;
  updatedAt: string;
  lastTrade: LastTrade | null;
  error?: string;
}

export interface DeskStatus {
  ok: boolean;
  network: string;
  dryRun: boolean;
  wallet?: string;
  signal: DeskSignal | null;
  claimable: ClaimablePosition[];
  agentRunning: boolean;
  lastTickAt: string | null;
}

export interface ClaimablePosition {
  marketId: string;
  asset: string;
  intervalSec: number;
  status: "Resolved" | "Voided";
  upBalance: string;
  downBalance: string;
  winningOutcome?: number;
  oracleQuestionId?: string;
  oracleGraphUrl?: string;
}
