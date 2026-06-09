#!/usr/bin/env bash
# goals/46-dogfood-step-add-is-append-only-no-way-to-insert-or-reorde.gates.sh
# Scenario steps must support insert-at-position and move/reorder, with the
# contiguous re-numbering produced by exactly one shared resequenceScenarioSteps.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="46-dogfood-step-add-is-append-only-no-way-to-insert-or-reorde"
GATE_INPUTS=(
  apps/api/src
  apps/api/src/application/scenario-authoring.ts
  apps/api/src/application/step-editing.ts
  apps/cli/src
  apps/cli/src/commands/step.ts
  apps/api/tests/unit/application/scenario-step-positioning.test.ts
  apps/cli/tests/unit/step-positioning.test.ts
  docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-001-step-add-is-append-only-no-way-to-insert-or.md
  goals/46-dogfood-step-add-is-append-only-no-way-to-insert-or-reorde.md
  goals/46-dogfood-step-add-is-append-only-no-way-to-insert-or-reorde.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[46.A1] API typecheck (insert/move + shared re-sequencer wiring resolves)"
if pnpm --filter @vooster/api typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[46.A2] CLI typecheck (step add --at / step move surface resolves)"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[46.A3] insert / move / re-sequence behavior suites pass (append + step-edit stay green)"
if pnpm exec vitest run \
  apps/api/tests/unit/application/scenario-step-positioning.test.ts \
  apps/cli/tests/unit/step-positioning.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[46.B1] exactly one resequenceScenarioSteps definer; every referring file imports the shared definition"
# Single-source structural invariant: a behavior test proves contiguous numbering
# for the cases it runs, but it cannot prove a second numbering producer was not
# copied into another module where it would later drift. Enumerate the definition
# files and the referring files from source (grep) and loop -- one definer, every
# other referrer imports it. (while-read, not mapfile -- system bash is 3.2 and
# lacks readarray.)
DEF_FILES=$(grep -rln 'function resequenceScenarioSteps' apps/api/src | sort -u)
DEF_COUNT=$(printf '%s\n' "$DEF_FILES" | grep -c .)

if [ "$DEF_COUNT" -ne 1 ]; then
  echo "    fail -- expected exactly 1 file to define resequenceScenarioSteps, found $DEF_COUNT:"
  printf '%s\n' "$DEF_FILES" | sed 's/^/      /'
  PASS=false
else
  DEFINER=$(printf '%s\n' "$DEF_FILES" | head -1)
  echo "    sole definer: $DEFINER"
  while IFS= read -r ref; do
    [ -z "$ref" ] && continue
    [ "$ref" = "$DEFINER" ] && continue
    if grep -Eq 'import[^;]*resequenceScenarioSteps' "$ref"; then
      echo "    ok: $ref imports shared resequenceScenarioSteps"
    else
      echo "    fail -- $ref references resequenceScenarioSteps without importing the shared definition"
      PASS=false
    fi
  done < <(grep -rln 'resequenceScenarioSteps' apps/api/src | sort -u)
fi

echo "[46.C1 Gate rigor]"
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
