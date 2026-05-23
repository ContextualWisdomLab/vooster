#!/usr/bin/env bash
# world-check.sh — Run external-system gates outside the iteration chain.
#
# World-state checks can fail because Docker, Vercel, or the network is in a
# transient bad state. Treat a single failure as a signal to retry once; report
# failure only when two full runs fail.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DELAY="${VSPEC_WORLD_RETRY_DELAY_SECONDS:-30}"
case "$DELAY" in
  ''|*[!0-9]*) DELAY=30 ;;
esac

LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT

run_world_check() {
  local label="$1"
  local log="$LOG_DIR/${label}.log"
  echo "=== WORLD CHECK: ${label} ==="
  if VSPEC_GATES_SKIP_DEEP=0 bash scripts/completion-check.sh >"$log" 2>&1; then
    cat "$log"
    return 0
  fi

  cat "$log"
  return 1
}

if run_world_check first; then
  echo "✓ world-check: full world-state suite passed"
  exit 0
fi

echo
echo "⚠ world-check: first run failed; retrying in ${DELAY}s"
sleep "$DELAY"

if run_world_check second; then
  echo "✓ world-check: retry passed; treating first failure as transient"
  exit 0
fi

echo "✗ world-check: two consecutive full world-state runs failed"
exit 1
