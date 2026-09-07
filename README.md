# Edge Desk

Explainable rule-based trading agent + product site (landing + multi-page app) for **DreamDEX binary Event Contracts** (Up/Down on BTC/ETH short windows) on **Somnia Shannon testnet** (chain 50312).

Built for the **Somnia x DreamDEX Event Contracts** hackathon. No LLM — every trade comes with a one-sentence plain-English reason.

## Product model

Users bring their own Shannon wallet. The server agent computes edge and reasons; it does not place live IOC unless AGENT_TRADE is explicitly enabled. Copy/Claim use wagmi walletClient with markets-sdk.

## Pitch

Event Contract books quote Up as a probability in (0, 1). Spot often moves before the book catches up. Edge Desk watches a live window (prefer BTC 15m), compares spot vs window reference to a fair Up probability, subtracts the book mid, and only crosses with IOC when |edge| >= threshold.

## Architecture

- Non-custodial: users connect Shannon wallet; Copy/Claim sign client-side.
- Agent (`src/agent/tick.ts`): signal-only by default (edge/reason/markets); mutex; persist data/lastSignal.json.
- APIs: GET /api/status, POST /api/agent/tick (signal), POST /api/focus, POST /api/pause. Custodial copy/claim require EDGE_DESK_SECRET.
- UI polls /api/status only (no dual trading tick). wagmi ConnectButton in AppShell.
- DRY_RUN=true and AGENT_TRADE=false by default. Key by marketId/symbol — never pool address.

## Edge formula

```
spot_implied_bias = clamp(0.5 + k * (spot - reference) / reference, 0.05, 0.95)
                    k = 8
book_up_mid       = (bestBid + bestAsk) / 2
edge              = spot_implied_bias - book_up_mid
trade Up   if edge  >=  EDGE_THRESHOLD
trade Down if edge  <= -EDGE_THRESHOLD
```

## Stack

- Next.js App Router + TypeScript + Tailwind
- @somnia-chain/markets-sdk >= 0.29.0 + viem + wagmi v2 + @tanstack/react-query
- Shannon testnet 50312
- Event contracts via SDK only (no DreamDEX HTTP API)

## Setup

```bash
cd edge-desk
cp .env.example .env
npm install
npm run build
npm run dev
```

Open http://localhost:3000 (landing) or http://localhost:3000/app/desk

Faucet (tUSDC + STT): https://t.me/+XHq0F0JXMyhmMzM0

### Env

- PRIVATE_KEY — optional (not required for users)
- NETWORK=testnet
- DRY_RUN=true
- AGENT_TRADE=false — keep false for signal-only agent
- EDGE_DESK_SECRET — optional; gates custodial copy/claim
- EDGE_THRESHOLD=0.05
- COPY_SIZE=1
- VENUE_ID — testnet venue default in .env.example
- PREFERRED_ASSET=BTC
- PREFERRED_INTERVAL_SEC=900

## Gotchas respected

- Gate writes on on-chain status === 1 (Trading)
- Key by marketId / symbol, never pool address
- IOC for takers (connected wallet)
- Voided: redeem both sides at 0.5
- Settled via listBinaryMarkets status Finalized

## License

MIT
