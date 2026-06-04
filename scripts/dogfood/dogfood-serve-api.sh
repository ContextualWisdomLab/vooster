#!/usr/bin/env bash
# scripts/dogfood/dogfood-serve-api.sh — Ensure a stub-enabled vspec API is up.
#
# The dogfood loop needs a running, authenticatable API. This launcher is
# IDEMPOTENT: if $VSPEC_DOGFOOD_API_URL/healthz already answers, it does
# nothing; otherwise it boots the local API in the background with the auth
# stub on (VSPEC_AUTH_STUB=1) and NO DATABASE_URL (in-memory store), so no
# Postgres is required. PID is tracked in .state/dogfood/api.pid.
#
# Usage:  bash scripts/dogfood/dogfood-serve-api.sh           # ensure up
#         bash scripts/dogfood/dogfood-serve-api.sh --stop    # stop it
# Env:    VSPEC_DOGFOOD_API_URL (default http://127.0.0.1:8799)
# Exit:   0 healthy · 1 could not boot.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
# shellcheck source=./_dogfood-lib.sh
source "$ROOT/scripts/dogfood/_dogfood-lib.sh"

: "${VSPEC_DOGFOOD_API_URL:=http://127.0.0.1:8799}"
API="${VSPEC_DOGFOOD_API_URL%/}"
PORT="$(printf '%s' "$API" | sed -E 's#^https?://[^:/]+:?([0-9]*).*#\1#')"; : "${PORT:=8799}"
PIDFILE="$(df_state_dir)/api.pid"
LOGFILE="$(df_state_dir)/api.log"
ENTRY="dist/apps/api/src/index.js"

stop_api() {
  [ -f "$PIDFILE" ] || { echo "no tracked API pid"; return 0; }
  local pid; pid="$(cat "$PIDFILE")"
  if kill -0 "$pid" 2>/dev/null; then kill -TERM "$pid" 2>/dev/null || true; fi
  rm -f "$PIDFILE"
  echo "✓ stopped API (pid $pid)"
}

[ "${1:-}" = "--stop" ] && { stop_api; exit 0; }

healthy() { curl -fsS "$API/healthz" >/dev/null 2>&1; }

# --restart forces a fresh boot (provision rebuilds dist each cycle; a still-
# running instance would be stale code). Default is idempotent reuse-if-healthy.
# We only ever kill OUR tracked pid — never a blanket port-kill — so we can
# never take down an unrelated service that happens to hold the port.
if [ "${1:-}" = "--restart" ]; then
  stop_api 2>/dev/null || true
  sleep 1
elif healthy; then
  echo "✓ API already healthy at $API"
  exit 0
fi

# If something we don't own is on the port, refuse rather than fight it.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  df_die "port $PORT is occupied by another process. Set VSPEC_DOGFOOD_API_URL to a free port."
fi

df_require_cmd node
df_require_cmd curl
df_init_state

if [ ! -f "$ENTRY" ]; then
  echo "[serve] building API (dist missing)"
  df_require_cmd pnpm
  pnpm --filter @vooster/api build >/dev/null 2>&1 || df_die "API build failed"
  [ -f "$ENTRY" ] || df_die "build did not emit $ENTRY"
fi

echo "[serve] booting stub API on port $PORT (in-memory, no Postgres)"
# Must UNSET DATABASE_URL (not set it empty) — index.ts uses the in-memory
# store only when DATABASE_URL is undefined; "" still selects Prisma.
env -u DATABASE_URL VSPEC_AUTH_STUB=1 VSPEC_FORCE_MEMORY_STORE=1 PORT="$PORT" nohup node "$ENTRY" >"$LOGFILE" 2>&1 &
echo $! > "$PIDFILE"

for _ in $(seq 1 50); do
  healthy && { echo "✓ API up at $API (pid $(cat "$PIDFILE"))"; exit 0; }
  sleep 0.2
done

echo "✗ API did not become healthy within 10s. Log tail:" >&2
tail -20 "$LOGFILE" 2>/dev/null | sed 's/^/    /' >&2
exit 1
