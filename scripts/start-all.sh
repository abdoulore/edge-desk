#!/usr/bin/env bash
# Run Next.js (web) and the Edge Desk agent-loop on one persistent host.
# Intended for Docker / Railway / Render / VPS — not serverless.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3000}"
HOST="${HOST:-0.0.0.0}"

mkdir -p data

cleanup() {
  if [[ -n "${NEXT_PID:-}" ]] && kill -0 "$NEXT_PID" 2>/dev/null; then
    kill "$NEXT_PID" 2>/dev/null || true
    wait "$NEXT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "[start-all] starting next start on ${HOST}:${PORT}"
npx next start --hostname "$HOST" --port "$PORT" &
NEXT_PID=$!

# Brief grace so the web process can bind before the agent logs over it.
sleep 2

if ! kill -0 "$NEXT_PID" 2>/dev/null; then
  echo "[start-all] next start exited early" >&2
  wait "$NEXT_PID" || true
  exit 1
fi

echo "[start-all] starting agent-loop (foreground)"
exec npx tsx scripts/agent-loop.ts
