#!/usr/bin/env bash
# goals/55-dogfood-usecase-verify-returns-opaque-output-with-no-pass-.gates.sh
# A non-passing `usecase verify` / `vspec verify` must hand the agent its next
# move: every failing check contributes a suggested next action, surfaced in the
# agent envelope's suggested_next_actions and inline in the human verdict,
# produced by a single shared suggestVerifyActions -- never a bare verdict the
# agent must interpret by hand.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="55-dogfood-usecase-verify-returns-opaque-output-with-no-pass-"
GATE_INPUTS=(
  apps/cli/src
  apps/cli/src/commands/verify.ts
  apps/cli/src/commands/usecase.ts
  apps/cli/tests/unit/usecase-verify-next-actions.test.ts
  apps/cli/tests/unit/verify-command.test.ts
  apps/cli/tests/unit/usecase-verify-routing.test.ts
  docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-006-usecase-verify-returns-opaque-output-with-n.md
  goals/55-dogfood-usecase-verify-returns-opaque-output-with-no-pass-.md
  goals/55-dogfood-usecase-verify-returns-opaque-output-with-no-pass-.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[55.A1] CLI typecheck (remediation producer wiring resolves)"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[55.A2] next-actions behavior suite passes; existing verify + routing suites stay green"
# Per-failing-check suggestion (one per failing check, none dropped), the empty
# suggestion set + exit 0 on a clean verdict, and the human/json/agent envelopes
# are behavioral -- locked by tests, not greps (goal-design.md s1.5).
if pnpm exec vitest run \
  apps/cli/tests/unit/usecase-verify-next-actions.test.ts \
  apps/cli/tests/unit/verify-command.test.ts \
  apps/cli/tests/unit/usecase-verify-routing.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[55.B1] exactly one suggestVerifyActions producer; every apps/cli/src referrer imports the shared definition"
# Single-source structural invariant: a behavior test proves the suggestions for
# the inputs it runs, but it cannot prove a second remediation map was not copied
# somewhere that would later let the human and agent surfaces drift into two
# suggestion sets. Enumerate the defining files and the referring files from
# source (grep) and loop -- one definer, every other referrer imports it.
# (while-read, not mapfile -- system bash is 3.2 and lacks readarray.)
DEF_FILES=$(grep -rln 'function suggestVerifyActions' apps/cli/src | sort -u)
DEF_COUNT=$(printf '%s\n' "$DEF_FILES" | grep -c .)

if [ "$DEF_COUNT" -ne 1 ]; then
  echo "    fail -- expected exactly 1 file to define suggestVerifyActions, found $DEF_COUNT:"
  printf '%s\n' "$DEF_FILES" | sed 's/^/      /'
  PASS=false
else
  DEFINER=$(printf '%s\n' "$DEF_FILES" | head -1)
  echo "    sole definer: $DEFINER"
  while IFS= read -r ref; do
    [ -z "$ref" ] && continue
    [ "$ref" = "$DEFINER" ] && continue
    if grep -Eq 'import[^;]*suggestVerifyActions' "$ref"; then
      echo "    ok: $ref imports shared suggestVerifyActions"
    else
      echo "    fail -- $ref references suggestVerifyActions without importing the shared definition"
      PASS=false
    fi
  done < <(grep -rln 'suggestVerifyActions' apps/cli/src | sort -u)
fi

echo "[55.B2] the verify producer feeds suggestVerifyActions into its failure output"
# DF-006's core: a failing verify must hand the agent its next move. Confirm the
# verify producer references suggestVerifyActions rather than emitting a bare
# verdict -- the behavior tests prove the suggestions, this proves the wiring is
# present at all.
if grep -q 'suggestVerifyActions' apps/cli/src/commands/verify.ts; then
  echo "    pass -- apps/cli/src/commands/verify.ts feeds suggestVerifyActions into the verdict"
else
  echo "    fail -- apps/cli/src/commands/verify.ts never references suggestVerifyActions; a failing verify still emits a bare verdict"
  PASS=false
fi

echo "[55.C1 Gate rigor]"
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
