#!/usr/bin/env bash
# check-bootable.sh — Goal 1 gate: `pnpm start` boots Fastify and /healthz works.
#
# Failure modes (in order):
#   - package.json has no "start" script
#   - apps/api/src/index.ts is empty / does not boot a server
#   - server starts but /healthz does not return 200 within timeout
#
# Exits 0 only when the server boots and answers /healthz with status 200.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f package.json ]; then
  echo "✗ check-bootable: package.json missing."
  exit 1
fi

if ! grep -qE '"start"\s*:' package.json; then
  echo "✗ check-bootable: package.json has no 'start' script."
  echo "  Add: \"start\": \"node dist/index.js\" (after tsc build) or equivalent."
  exit 1
fi

if [ ! -s apps/api/src/index.ts ] || ! grep -qE '(listen|createServer|Fastify)' apps/api/src/index.ts; then
  echo "✗ check-bootable: apps/api/src/index.ts does not appear to boot a server."
  echo "  Expected: imports createServer from apps/api/src/http/server.ts and calls app.listen."
  exit 1
fi

PORT=${VSPEC_BOOT_TEST_PORT:-3917}
export PORT
LOG=$(mktemp)
mkdir -p .state

# Start the server in the background; allow generous TS build time on first run.
pnpm run --silent build >/dev/null 2>&1 || true
( pnpm start >"$LOG" 2>&1 ) &
PID=$!

cleanup() {
  if kill -0 "$PID" 2>/dev/null; then
    kill -TERM "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -f "$LOG"
}
trap cleanup EXIT

# Poll /healthz for up to 10s.
ok=false
for _ in $(seq 1 50); do
  if curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then
    ok=true
    break
  fi
  sleep 0.2
done

if [ "$ok" != true ]; then
  echo "✗ check-bootable: /healthz did not respond within 10s."
  echo "  Server log (tail):"
  tail -20 "$LOG" | sed 's/^/    /'
  exit 1
fi

body=$(curl -fsS "http://127.0.0.1:${PORT}/healthz" 2>/dev/null || echo "")
if ! echo "$body" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"'; then
  echo "✗ check-bootable: /healthz returned unexpected body: $body"
  exit 1
fi

echo "✓ check-bootable: server booted, /healthz returned status=ok."
exit 0
