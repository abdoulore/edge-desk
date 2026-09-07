"use client";

import { http, createConfig } from "wagmi";
import { injected } from "@wagmi/core";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const rpcHttp =
  process.env.NEXT_PUBLIC_HTTP_RPC_URL ||
  somniaShannon.rpcUrls.default.http[0];

export const shannonChain = somniaShannon;

export const wagmiConfig = createConfig({
  chains: [shannonChain],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [shannonChain.id]: http(rpcHttp),
  },
  ssr: true,
});

export const SHANNON_CHAIN_ID = shannonChain.id;
