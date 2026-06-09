#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="58-dogfood-session-complete-without-id-fails-with-misleading-"
FINDING="docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-003-session-complete-without-id-fails-with-misl.md"

GATE_INPUTS=(
  "goals/${GOAL_NAME}.md"
  "goals/${GOAL_NAME}.gates.sh"
  "$FINDING"
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[58.A1] source dogfood finding is resolved"
if grep -q '^resolved: true' "$FINDING"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — resolve the finding and set resolved: true in $FINDING"
  PASS=false
fi

echo "[58.B1] gate rigor"
if bash "$ROOT/scripts/check-gate-rigor.sh" "goals/${GOAL_NAME}.md" >/dev/null; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — gate rigor failed for goals/${GOAL_NAME}.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi
exit 1
