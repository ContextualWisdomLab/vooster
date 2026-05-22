#!/usr/bin/env bash
# dogfood-test.sh — API-level self-test for the in-memory MVP.
#
# Consumes the build produced by goals/_meta.gates.sh M.4. Does not
# rebuild here; parallel gate workers share dist/.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG="$ROOT/.state/dogfood.log"
mkdir -p "$(dirname "$LOG")"
: > "$LOG"

note() { echo "[dogfood] $*" | tee -a "$LOG"; }

SMOKE_JS="$ROOT/dist/scripts/dogfood-smoke.js"
if [ ! -f "$SMOKE_JS" ]; then
  note "✗ $SMOKE_JS missing"
  note "  Build first: pnpm run build  (or rely on goals/_meta.gates.sh M.4)"
  exit 1
fi

note "Run in-memory dogfood smoke"
node "$SMOKE_JS" >>"$LOG" 2>&1
note "✓ dogfood test passed"
