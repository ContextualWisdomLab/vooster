#!/usr/bin/env bash
# cost-monitor.sh — Kill switch when accumulated cost exceeds budget.
# The harness is expected to write a token count line to .state/cost.log per call.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STATE="$ROOT/.state"
mkdir -p "$STATE"
LOG="$STATE/cost.log"
BUDGET_TOKENS=${VSPEC_BUDGET_TOKENS:-15000000}      # default 15M tokens
HARD_STOP_FILE="$STATE/HARD_STOP"

TOTAL=0
if [ -f "$LOG" ]; then
  TOTAL=$(awk '{s+=$1} END {print s+0}' "$LOG")
fi

echo "cost-monitor: total tokens recorded = $TOTAL (budget $BUDGET_TOKENS)"

if [ "$TOTAL" -ge "$BUDGET_TOKENS" ]; then
  echo "⛔ BUDGET EXCEEDED. Writing $HARD_STOP_FILE."
  touch "$HARD_STOP_FILE"
  exit 1
fi

if [ -f "$HARD_STOP_FILE" ]; then
  echo "⛔ HARD_STOP file present. Manual review required."
  exit 1
fi

exit 0
