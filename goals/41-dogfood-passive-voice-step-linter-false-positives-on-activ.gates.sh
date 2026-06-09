#!/usr/bin/env bash
# goals/41-dogfood-passive-voice-step-linter-false-positives-on-activ.gates.sh
# Passive-voice step linter must scope to the main predicate, with one shared
# detector across all step-action validation paths.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="41-dogfood-passive-voice-step-linter-false-positives-on-activ"
GATE_INPUTS=(
  apps/api/src/application/scenario-authoring.ts
  apps/api/src/application/step-editing.ts
  apps/api/src/http/scenario-support.ts
  apps/api/src/application
  apps/api/src/http
  apps/api/tests/unit/application/scenario-authoring.test.ts
  apps/api/tests/unit/application/step-editing.test.ts
  apps/api/tests/unit/http/scenario-support.test.ts
  goals/41-dogfood-passive-voice-step-linter-false-positives-on-activ.md
  goals/41-dogfood-passive-voice-step-linter-false-positives-on-activ.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[41.A1] API typecheck (shared detector wiring resolves)"
if pnpm --filter @vooster/api typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[41.A2] passive-voice behavior suites pass (false positive fixed, true positive kept)"
if pnpm exec vitest run \
  apps/api/tests/unit/application/scenario-authoring.test.ts \
  apps/api/tests/unit/application/step-editing.test.ts \
  apps/api/tests/unit/http/scenario-support.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[41.B1] exactly one shared usesPassiveVoice definition; every referrer imports it"
# Source of truth: enumerate definition files and referring files from grep.
# (while-read, not mapfile -- system bash is 3.2 and lacks readarray.)
DEF_FILES=$(grep -rln 'function usesPassiveVoice' apps/api/src | sort -u)
DEF_COUNT=$(printf '%s\n' "$DEF_FILES" | grep -c .)

if [ "$DEF_COUNT" -ne 1 ]; then
  echo "    fail -- expected exactly 1 file to define usesPassiveVoice, found $DEF_COUNT:"
  printf '%s\n' "$DEF_FILES" | sed 's/^/      /'
  PASS=false
else
  DEFINER=$(printf '%s\n' "$DEF_FILES" | head -1)
  echo "    sole definer: $DEFINER"
  while IFS= read -r ref; do
    [ -z "$ref" ] && continue
    [ "$ref" = "$DEFINER" ] && continue
    # A non-defining referrer must import the shared detector, not re-declare it.
    if grep -Eq 'import[^;]*usesPassiveVoice' "$ref"; then
      echo "    ok: $ref imports shared detector"
    else
      echo "    fail -- $ref references usesPassiveVoice without importing the shared definition"
      PASS=false
    fi
  done < <(grep -rln 'usesPassiveVoice' apps/api/src | sort -u)
fi

echo "[41.C1 Gate rigor]"
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
