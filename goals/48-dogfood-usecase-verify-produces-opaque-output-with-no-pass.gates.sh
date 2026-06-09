#!/usr/bin/env bash
# goals/48-dogfood-usecase-verify-produces-opaque-output-with-no-pass.gates.sh
# `usecase verify` / `vspec verify` must emit a per-check spec-fidelity verdict
# (actors / scenario completeness / extension points / Cockburn) with a non-zero
# exit on failure, produced by a single shared runSpecChecks -- never link drift
# alone, never an opaque banner.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="48-dogfood-usecase-verify-produces-opaque-output-with-no-pass"
GATE_INPUTS=(
  apps/cli/src
  apps/cli/src/commands/verify.ts
  apps/cli/src/commands/usecase.ts
  apps/cli/tests/unit/usecase-verify-checks.test.ts
  apps/cli/tests/unit/verify-command.test.ts
  apps/cli/tests/unit/usecase-verify-routing.test.ts
  docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-001-usecase-verify-produces-opaque-output-with-.md
  goals/48-dogfood-usecase-verify-produces-opaque-output-with-no-pass.md
  goals/48-dogfood-usecase-verify-produces-opaque-output-with-no-pass.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[48.A1] CLI typecheck (spec-check producer wiring resolves)"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[48.A2] spec-check verdict suite passes; existing verify + routing suites stay green"
# Per-check pass/fail, overall verdict aggregation, non-zero exit on a failed
# check, and the human/json/agent envelopes are behavioral -- locked by tests,
# not greps (goal-design.md s1.5).
if pnpm exec vitest run \
  apps/cli/tests/unit/usecase-verify-checks.test.ts \
  apps/cli/tests/unit/verify-command.test.ts \
  apps/cli/tests/unit/usecase-verify-routing.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[48.B1] exactly one runSpecChecks producer; every apps/cli/src referrer imports the shared definition"
# Single-source structural invariant: a behavior test proves the verdict for the
# inputs it runs, but it cannot prove a second spec-check implementation was not
# copied somewhere that would later let the usecase-verify and vspec-verify paths
# drift. Enumerate the defining files and the referring files from source (grep)
# and loop -- one definer, every other referrer imports it. (while-read, not
# mapfile -- system bash is 3.2 and lacks readarray.)
DEF_FILES=$(grep -rln 'function runSpecChecks' apps/cli/src | sort -u)
DEF_COUNT=$(printf '%s\n' "$DEF_FILES" | grep -c .)

if [ "$DEF_COUNT" -ne 1 ]; then
  echo "    fail -- expected exactly 1 file to define runSpecChecks, found $DEF_COUNT:"
  printf '%s\n' "$DEF_FILES" | sed 's/^/      /'
  PASS=false
else
  DEFINER=$(printf '%s\n' "$DEF_FILES" | head -1)
  echo "    sole definer: $DEFINER"
  while IFS= read -r ref; do
    [ -z "$ref" ] && continue
    [ "$ref" = "$DEFINER" ] && continue
    if grep -Eq 'import[^;]*runSpecChecks' "$ref"; then
      echo "    ok: $ref imports shared runSpecChecks"
    else
      echo "    fail -- $ref references runSpecChecks without importing the shared definition"
      PASS=false
    fi
  done < <(grep -rln 'runSpecChecks' apps/cli/src | sort -u)
fi

echo "[48.B2] the verify producer feeds the spec checks into its verdict"
# DF-001's core: verify must run the spec checks, not link drift alone. Confirm
# the verify producer references runSpecChecks rather than ignoring it -- the
# behavior tests prove the verdict, this proves the wiring is present at all.
if grep -q 'runSpecChecks' apps/cli/src/commands/verify.ts; then
  echo "    pass -- apps/cli/src/commands/verify.ts feeds runSpecChecks into the verdict"
else
  echo "    fail -- apps/cli/src/commands/verify.ts never references runSpecChecks; verify still checks link drift alone"
  PASS=false
fi

echo "[48.C1 Gate rigor]"
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
