#!/usr/bin/env bash
# goals/57-dogfood-inserted-step-renders-out-of-order-in-usecase-show.gates.sh
# An inserted step must render in step_number order on every surface (human /
# agent / markdown) with order_index kept consistent, and the display ordering
# must be produced by exactly one shared orderScenarioStepsForDisplay.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="57-dogfood-inserted-step-renders-out-of-order-in-usecase-show"
GATE_INPUTS=(
  apps/api/src
  apps/api/src/application/scenario-authoring.ts
  apps/api/src/application/step-editing.ts
  apps/api/src/application/usecase-agent-data.ts
  apps/api/src/application/markdown-renderer.ts
  apps/api/tests/unit/application/inserted-step-display-order.test.ts
  apps/api/tests/unit/application/scenario-step-positioning.test.ts
  docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-003-inserted-step-renders-out-of-order-in-useca.md
  goals/57-dogfood-inserted-step-renders-out-of-order-in-usecase-show.md
  goals/57-dogfood-inserted-step-renders-out-of-order-in-usecase-show.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[57.A1] API typecheck (shared display ordering wiring resolves)"
if pnpm --filter @vooster/api typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[57.A2] inserted-step ordering + cross-surface behavior suites pass (positioning stays green)"
if pnpm exec vitest run \
  apps/api/tests/unit/application/inserted-step-display-order.test.ts \
  apps/api/tests/unit/application/scenario-step-positioning.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[57.B1] exactly one orderScenarioStepsForDisplay definer; every referring file imports the shared definition"
# Single-source structural invariant: the cross-surface behavior test proves the
# human / agent / markdown surfaces agree for the cases it runs, but it cannot
# prove a fourth surface (added later) was not given its own order_index sort
# where it would silently drift again -- exactly the DF-003 failure mode.
# Enumerate the definition files and the referring files from source and loop:
# one definer, every other referrer imports it. (while-read, not mapfile --
# system bash is 3.2 and lacks readarray.)
DEF_FILES=$(grep -rln 'function orderScenarioStepsForDisplay' apps/api/src | sort -u)
DEF_COUNT=$(printf '%s\n' "$DEF_FILES" | grep -c .)

if [ "$DEF_COUNT" -ne 1 ]; then
  echo "    fail -- expected exactly 1 file to define orderScenarioStepsForDisplay, found $DEF_COUNT:"
  printf '%s\n' "$DEF_FILES" | sed 's/^/      /'
  PASS=false
else
  DEFINER=$(printf '%s\n' "$DEF_FILES" | head -1)
  echo "    sole definer: $DEFINER"
  while IFS= read -r ref; do
    [ -z "$ref" ] && continue
    [ "$ref" = "$DEFINER" ] && continue
    if grep -Eq 'import[^;]*orderScenarioStepsForDisplay' "$ref"; then
      echo "    ok: $ref imports shared orderScenarioStepsForDisplay"
    else
      echo "    fail -- $ref references orderScenarioStepsForDisplay without importing the shared definition"
      PASS=false
    fi
  done < <(grep -rln 'orderScenarioStepsForDisplay' apps/api/src | sort -u)
fi

echo "[57.C1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/$GOAL_NAME.md" >/dev/null 2>&1; then
  echo "    pass"
else
  echo "    fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/$GOAL_NAME.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
