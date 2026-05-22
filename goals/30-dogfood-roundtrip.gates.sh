#!/usr/bin/env bash
# goals/30-dogfood-roundtrip.gates.sh — Gate suite for goal 30.
#
# Intentionally minimal. Behavior is verified by the test suite (run by
# goal-0's vitest gate) and typecheck. This file only enforces what no
# other tool can:
#   - The goal's universal-claim ↔ universal-gate rigor mechanism.
#   - The followups doc exists so deferred dogfood work is not lost.
#
# See docs/findings/2026-05-23T1700-gates-over-coupling.md for context
# on why this file is short.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="30-dogfood-roundtrip"

GATE_INPUTS=(
  docs/findings/2026-05-23T1700-dogfood-followups.md
  goals/30-dogfood-roundtrip.md
  goals/30-dogfood-roundtrip.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FOLLOWUPS=docs/findings/2026-05-23T1700-dogfood-followups.md

echo "[30.A1 followups doc exists]"
if [ -f "$FOLLOWUPS" ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $FOLLOWUPS missing"
  echo "    deferred dogfood findings (A2/A4-A9/A12-A15/B1-B6/H1-H3)"
  echo "    must be captured before goal 30 can close."
  PASS=false
fi

echo "[30.G1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/30-dogfood-roundtrip.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/30-dogfood-roundtrip.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
