# Edge Desk

Explainable rule-based trading agent + one-screen mobile-first UI for **DreamDEX binary Event Contracts** (Up/Down on BTC/ETH short windows) on **Somnia Shannon testnet** (chain 50312).

Built for the **Somnia x DreamDEX Event Contracts** hackathon. No LLM — every trade comes with a one-sentence plain-English reason.

## Pitch

Event Contract books quote Up as a probability in (0, 1). Spot often moves before the book catches up. Edge Desk watches a live window (prefer BTC 15m), compares spot vs window reference to a fair Up probability, subtracts the book mid, and only crosses with IOC when |edge| >= threshold.

## Architecture

- Agent (`src/agent/tick.ts`): load live binary markets, gate onchain.status === 1, book + spot/reference, edge, IOC when edged, persist data/lastSignal.json.
- APIs: GET /api/status, POST /api/copy, POST /api/claim, POST /api/agent/tick.
- UI: single dark mobile page; client polls tick every ~8s.
- DRY_RUN defaults true. Key by marketId/symbol — never pool address.

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
- @somnia-chain/markets-sdk >= 0.29.0 + viem
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

Open http://localhost:3000

Faucet (tUSDC + STT): https://t.me/+XHq0F0JXMyhmMzM0

### Env

- PRIVATE_KEY — optional in dry-run; required for live IOC / claim
- NETWORK=testnet
- DRY_RUN=true
- EDGE_THRESHOLD=0.05
- COPY_SIZE=1
- VENUE_ID — testnet venue default in .env.example
- PREFERRED_ASSET=BTC
- PREFERRED_INTERVAL_SEC=900

## Gotchas respected

- Gate writes on on-chain status === 1 (Trading)
- Key by marketId / symbol, never pool address
- IOC for takers
- Voided: redeem both sides at 0.5
- Settled via listBinaryMarkets status Finalized

## License

MIT
