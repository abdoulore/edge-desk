# Edge Desk

Explainable, rule-based trading desk for **DreamDEX binary Event Contracts** (Up/Down on BTC/ETH short windows) on **Somnia Shannon testnet** (chain ID `50312`).

Built for the **Somnia × DreamDEX Event Contracts** hackathon ([DoraHacks](https://dorahacks.io/hackathon/event-contracts/detail); extended deadline **11 Sep 2026**). No LLM — every signal includes a one-sentence plain-English reason.

## What it is

Users connect their own Shannon wallet. The server agent computes spot-vs-book edge and a reason string; it does **not** place live IOC unless `AGENT_TRADE=true` is set explicitly. **Copy** and **Claim** run client-side via wagmi + `@somnia-chain/markets-sdk` (non-custodial).

Default product mode is **signal-only**: `DRY_RUN=true`, `AGENT_TRADE=false`.

## Quickstart (local)

Requires Node 22+ (CI uses 22). Persistent writable `data/` directory.

```bash
git clone https://github.com/abdoulore/edge-desk.git
cd edge-desk
npm ci
cp .env.example .env
# Edit .env as needed. For local operator buttons, set BOTH:
#   EDGE_DESK_SECRET=dev-secret
#   NEXT_PUBLIC_EDGE_DESK_SECRET=dev-secret
npm run build
npm run start          # terminal A — Next on :3000
npm run agent          # terminal B — always-on agent-loop
# Or one process:
# npm run start:all
```

Open `http://localhost:3000` (landing) or `http://localhost:3000/app/desk`.

Faucet (tUSDC + STT): https://t.me/+XHq0F0JXMyhmMzM0

### Operator secret

- `EDGE_DESK_SECRET` — required header/token for operator mutations (pause / focus / tick) and gated custodial server routes.
- `NEXT_PUBLIC_EDGE_DESK_SECRET` — same value for the browser UI so local demo controls work.
- Never commit real secrets. Without the public twin, the UI stays read-only for those controls.

## Architecture (short)

| Piece | Role |
| --- | --- |
| `src/agent/tick.ts` | Edge calc + reason; mutex; writes `data/lastSignal.json` |
| `scripts/agent-loop.ts` | Always-on scheduler; loads project-root `.env` |
| `GET /api/status` | Read-only status + heartbeat |
| `POST /api/agent/tick` | Secret-gated; not a second open scheduler |
| Desk UI | Polls `/api/status`; Copy/Claim via connected wallet |

Edge sketch:

```
spot_implied_bias = clamp(0.5 + k * (spot - reference) / reference, 0.05, 0.95)  # k=8
book_up_mid       = (bestBid + bestAsk) / 2
edge              = spot_implied_bias - book_up_mid
trade Up   if edge  >=  EDGE_THRESHOLD
trade Down if edge  <= -EDGE_THRESHOLD
```

Key by `marketId` / symbol — never pool address. Gate writes on on-chain Trading status. IOC for wallet takers.

## Demo video

Demo is submitted on DoraHacks as a **YouTube link** (not stored in this repository). Do not commit video files here.

## Transaction evidence (Shannon testnet)

Live fills from earlier funded testnet work (verify on Shannon explorer):

- https://shannon-explorer.somnia.network/tx/0x8c35a5ca04cb0635de516cca7e2dd164c36c5f476f126e0d363bef4f6a57b76a
- https://shannon-explorer.somnia.network/tx/0xc216ae7b412ecd934409eaa4479cfe1b641e0151dc85570c347ee1ba5dda0c9f

Explorer helper in code: `explorerTxUrl()` / `SHANNON_EXPLORER_TX` in `src/lib/types.ts`.

## Hosting (Railway / Render / Docker)

This app needs an **always-on** process and a **persistent disk** for `data/*.json`. It is not suited to ephemeral serverless.

Configs included (no live public URL claimed here unless you deploy yourself):

| File | Purpose |
| --- | --- |
| `Dockerfile` | Multi-stage Node 22 image; `CMD` runs `scripts/start-all.sh` |
| `railway.toml` | Railway Docker build; mount a volume at `/app/data` |
| `render.yaml` | Render Node blueprint; disk at project data dir; start via start:all |
| `scripts/start-all.sh` | Next in background + agent-loop in foreground (trap cleanup) |

Package scripts:

- `start` — Next only
- `agent` — agent-loop only
- `start:all` — both (hosting entrypoint)

Build from the repo container file, publish port 3000, mount persistent storage on `/app/data`, and inject env from `.env.example` via the host secret store. Use `railway.toml` on Railway and `render.yaml` on Render.

Keep `AGENT_TRADE=false` unless you intentionally want server-side IOC from `PRIVATE_KEY`.

## Env reference

See `.env.example`. Important knobs:

| Var | Default / notes |
| --- | --- |
| `NETWORK` | `testnet` |
| `DRY_RUN` | `true` |
| `AGENT_TRADE` | `false` (server IOC off) |
| `EDGE_DESK_SECRET` / `NEXT_PUBLIC_EDGE_DESK_SECRET` | operator + local demo |
| `EDGE_THRESHOLD` | `0.05` |
| `COPY_SIZE` | `1` |
| `VENUE_ID` | testnet venue in example |
| `PREFERRED_ASSET` / `PREFERRED_INTERVAL_SEC` | `BTC` / `900` |
| `AGENT_INTERVAL_MS` | `8000` |
| `PRIVATE_KEY` | optional; users do not need it |

## Quality gates

Run lint, production build, and the stage1-3 verify scripts before submit. GitHub Actions (`.github/workflows/ci.yml`) runs the same on push/PR.

Pushing workflow file changes may require a **workflow-scoped** GitHub token; a normal `contents` token can fail.

## Known limitations (honest)

- **Model**: experimental spot-vs-book heuristic — **not** a calibrated probability; do not treat edge percent as P(win).
- **Book**: top-of-book mid/ask awareness; **not** full depth / size-aware impact beyond current cost checks.
- **Hosting**: filesystem JSON store needs persistent disk; unsuitable for typical serverless.
- **CI**: workflow commits may need a workflow-scoped token to push.
- **Indexer / portfolio**: indexer-backed portfolio views can have gaps vs on-chain truth; reconcile against wallet + explorer when unsure.
- **Agent vs UI**: UI does not start the agent; you must run the agent script or `start:all`.
- **Demo URL**: no deployed app URL is claimed in this README unless you add one after a real deploy.
- **Dependencies**: production audit may report transitive findings — triage by reachability before blind upgrades.

## Stack

Next.js App Router, TypeScript, Tailwind, `@somnia-chain/markets-sdk` >= 0.29.0, viem, wagmi v2, React Query. Event contracts via SDK only (no DreamDEX HTTP API).

## License

MIT — see `LICENSE`.
