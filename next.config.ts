import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@somnia-chain/markets-sdk", "viem"],
};

export default nextConfig;
