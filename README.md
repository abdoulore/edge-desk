# Edge Desk

Explainable, rule-based trading desk for DreamDEX binary Event Contracts (short Up/Down windows on BTC/ETH) on Somnia Shannon testnet.

**Live:** [desk.moonrider.online](https://desk.moonrider.online/)  
**Repo:** [github.com/abdoulore/edge-desk](https://github.com/abdoulore/edge-desk)

Built for the Somnia × DreamDEX Event Contracts hackathon on DoraHacks. Demo video is on the submission (YouTube), not in this repo.

## Problem

DreamDEX Event Contracts quote odds on the book while spot keeps moving. Those two often diverge. Traders stare at a price and still cannot tell whether there is a real trade, and a midpoint that looks good can disappear once the executable ask eats the edge.

## Solution

Edge Desk watches the active window, compares spot to the window reference, estimates fair Up, and measures the gap versus the book. It only signals when the executable ask still clears a threshold, and every signal includes a plain-English Why.

- No LLM in the core loop (rule-based heuristic)
- Non-custodial: you connect your wallet to copy and claim
- Signal-only by default (`DRY_RUN=true`, `AGENT_TRADE=false`)
- Fair Up / edge is a transparent estimate, not a calibrated win probability

## Try it

1. Open **[desk.moonrider.online](https://desk.moonrider.online/)**
2. Desk → read the Why box
3. Markets → live windows
4. Portfolio → wallet-scoped positions and settled results (connect wallet)
5. Activity → ticks and fills

### Local quickstart

Node 22+. Needs a writable `data/` directory.

```bash
git clone https://github.com/abdoulore/edge-desk.git
cd edge-desk
npm ci
cp .env.example .env
npm run build
npm run start:all   # Next + agent loop
```

Then open `http://localhost:3000`.

For local operator buttons (pause / force tick), set the same value in both `EDGE_DESK_SECRET` and `NEXT_PUBLIC_EDGE_DESK_SECRET`. Never commit real secrets.

Faucet (tUSDC + STT): https://t.me/+XHq0F0JXMyhmMzM0

## Proof (Shannon testnet)

Live fills from funded testnet work (verify on explorer):

- https://shannon-explorer.somnia.network/tx/0x8c35a5ca04cb0635de516cca7e2dd164c36c5f476f126e0d363bef4f6a57b76a
- https://shannon-explorer.somnia.network/tx/0xc216ae7b412ecd934409eaa4479cfe1b641e0151dc85570c347ee1ba5dda0c9f

## How it works

| Piece | Role |
| --- | --- |
| `src/agent/tick.ts` | Edge calc + Why; writes `data/lastSignal.json` |
| `scripts/agent-loop.ts` | Always-on scheduler |
| `GET /api/status` | Read-only status for the UI |
| Desk UI | Polls status; Copy/Claim via connected wallet |

```
spot_implied_bias = clamp(0.5 + k * (spot - reference) / reference, 0.05, 0.95)  # k=8
book_up_mid       = (bestBid + bestAsk) / 2
edge              = spot_implied_bias - book_up_mid
trade Up   if edge  >=  EDGE_THRESHOLD
trade Down if edge  <= -EDGE_THRESHOLD
```

Keyed by `marketId` / symbol (never pool address). Writes gated on on-chain Trading status. Wallet takers use IOC.

Key env knobs (full list in `.env.example`): `EDGE_THRESHOLD`, `COPY_SIZE`, `PREFERRED_ASSET`, `PREFERRED_INTERVAL_SEC`, `AGENT_TRADE` (keep false unless you want server-side IOC).

## Stack

Next.js App Router, TypeScript, Tailwind, `@somnia-chain/markets-sdk`, viem, wagmi v2, React Query. Event contracts via the official SDK only.

Production runs on a VPS behind Cloudflare at desk.moonrider.online (`start:all` + persistent `data/`). Docker / Railway / Render configs in-repo are optional alternatives; this is not a serverless app.

## Known limitations

- Heuristic Fair Up / edge is **not** P(win).
- Top-of-book awareness, not full depth impact modeling.
- Portfolio views can lag on-chain truth; reconcile with wallet + explorer.
- UI does not start the agent; run `start:all` (or Next + agent separately).
- Needs always-on process + persistent disk for `data/*.json`.

## License

MIT. See `LICENSE`.
