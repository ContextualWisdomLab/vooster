#!/usr/bin/env bash
# dogfood-test.sh — API-level self-test for the in-memory MVP.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG="$ROOT/.state/dogfood.log"
mkdir -p "$(dirname "$LOG")"
: > "$LOG"

note() { echo "[dogfood] $*" | tee -a "$LOG"; }

note "Run in-memory dogfood smoke"
npm run --silent build >>"$LOG" 2>&1
node dist/scripts/dogfood-smoke.js >>"$LOG" 2>&1
note "✓ dogfood test passed"
