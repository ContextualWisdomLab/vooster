#!/usr/bin/env bash
# check-persistence.sh — Goal 1 gate: data survives a server restart.
#
# Strategy:
#   1. Boot the server with a temp SQLite DB.
#   2. Sign up a workspace via /v1/auth/github/start + /callback (authStub).
#   3. Capture the workspace slug.
#   4. SIGTERM the server, wait for exit.
#   5. Reboot against the same DB file.
#   6. Re-fetch the workspace and confirm the slug is still there.
#
# Fails fast if any in-memory Map is still load-bearing.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f package.json ] || ! grep -qE '"start"\s*:' package.json; then
  echo "✗ check-persistence: prerequisite missing (npm start). Pass check-bootable first."
  exit 1
fi

mkdir -p .state
DB_DIR=$(mktemp -d)
DB_FILE="$DB_DIR/persist.sqlite"
export DATABASE_URL="file:${DB_FILE}"
export VSPEC_AUTH_STUB=1
PORT=${VSPEC_BOOT_TEST_PORT:-3918}
export PORT
LOG1=$(mktemp)
LOG2=$(mktemp)

cleanup() {
  for pid in "${PID1:-}" "${PID2:-}"; do
    [ -z "$pid" ] && continue
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  rm -rf "$DB_DIR" "$LOG1" "$LOG2"
}
trap cleanup EXIT

npm run --silent build >/dev/null 2>&1 || true

boot() {
  local log="$1"
  ( npm start >"$log" 2>&1 ) &
  local pid=$!
  for _ in $(seq 1 50); do
    if curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then
      echo "$pid"
      return 0
    fi
    sleep 0.2
  done
  echo "$pid"
  return 1
}

# First boot.
PID1=$(boot "$LOG1") || {
  echo "✗ check-persistence: first boot failed."
  tail -20 "$LOG1" | sed 's/^/    /'
  exit 1
}

SLUG="persist-$(date +%s)-$$"
START=$(curl -fsS -c "$DB_DIR/jar" -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"workspace\":{\"name\":\"Persist Test\",\"slug\":\"$SLUG\"}}" \
  "http://127.0.0.1:${PORT}/v1/auth/github/start" 2>/dev/null || echo "")
STATE=$(echo "$START" | sed -n 's/.*"state":"\([^"]*\)".*/\1/p')
if [ -z "$STATE" ]; then
  echo "✗ check-persistence: signup start did not return state."
  echo "  body: $START"
  exit 1
fi

CB_STATUS=$(curl -s -b "$DB_DIR/jar" -o "$DB_DIR/cb.json" -w '%{http_code}' \
  "http://127.0.0.1:${PORT}/v1/auth/github/callback?code=stub-persist&state=${STATE}" \
  2>/dev/null || echo "000")
if [ "$CB_STATUS" != "201" ]; then
  echo "✗ check-persistence: callback returned $CB_STATUS."
  cat "$DB_DIR/cb.json" 2>/dev/null | sed 's/^/    /'
  exit 1
fi

# Kill first boot.
kill -TERM "$PID1" 2>/dev/null || true
wait "$PID1" 2>/dev/null || true
PID1=""

# Second boot against the same DATABASE_URL.
PID2=$(boot "$LOG2") || {
  echo "✗ check-persistence: second boot failed."
  tail -20 "$LOG2" | sed 's/^/    /'
  exit 1
}

# Workspace must still exist. We probe by slug uniqueness — re-running signup
# with the same slug must now collide (422).
START2=$(curl -fsS -c "$DB_DIR/jar2" -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"workspace\":{\"name\":\"Persist Test\",\"slug\":\"$SLUG\"}}" \
  "http://127.0.0.1:${PORT}/v1/auth/github/start" 2>/dev/null || echo "")
STATE2=$(echo "$START2" | sed -n 's/.*"state":"\([^"]*\)".*/\1/p')

if [ -z "$STATE2" ]; then
  echo "✗ check-persistence: signup start after restart did not return state."
  exit 1
fi

CB2_STATUS=$(curl -s -b "$DB_DIR/jar2" -o "$DB_DIR/cb2.json" -w '%{http_code}' \
  "http://127.0.0.1:${PORT}/v1/auth/github/callback?code=stub-persist-2&state=${STATE2}" \
  2>/dev/null || echo "000")

if [ "$CB2_STATUS" = "201" ]; then
  echo "✗ check-persistence: workspace slug '$SLUG' was lost across restart."
  echo "  Second signup with the same slug succeeded — state did not persist."
  exit 1
fi

if [ "$CB2_STATUS" != "422" ]; then
  echo "✗ check-persistence: expected 422 on duplicate slug after restart, got $CB2_STATUS."
  cat "$DB_DIR/cb2.json" 2>/dev/null | sed 's/^/    /'
  exit 1
fi

echo "✓ check-persistence: workspace survived a restart (slug collision after reboot)."
exit 0
