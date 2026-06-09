#!/usr/bin/env bash
# goals/43-dogfood-usecase-verify-returns-opaque-output-with-no-pass-.gates.sh
# `vspec usecase verify <id>` must route into the single runVerify producer and
# emit a branchable verdict (status) in every format -- never an opaque banner.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="43-dogfood-usecase-verify-returns-opaque-output-with-no-pass-"
GATE_INPUTS=(
  apps/cli/src
  apps/cli/src/commands/usecase.ts
  apps/cli/src/commands/verify.ts
  apps/cli/tests/unit/usecase-verify-routing.test.ts
  apps/cli/tests/unit/verify-command.test.ts
  docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-006-usecase-verify-returns-opaque-output-with-n.md
  goals/43-dogfood-usecase-verify-returns-opaque-output-with-no-pass-.md
  goals/43-dogfood-usecase-verify-returns-opaque-output-with-no-pass-.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[43.A1] CLI typecheck (usecase->verify routing wiring resolves)"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[43.A2] usecase-verify routing + per-format verdict suites pass (existing verify verdict stays green)"
if pnpm exec vitest run \
  apps/cli/tests/unit/usecase-verify-routing.test.ts \
  apps/cli/tests/unit/verify-command.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[43.B1] exactly one runVerify producer; every apps/cli/src referrer imports the shared definition"
# Single-source structural invariant: a behavior test proves the verdict for the
# inputs it runs, but it cannot prove a second verdict implementation was not
# copied somewhere that would later drift. Enumerate the definition files and the
# referring files from source (grep) and loop -- one definer, all other referrers
# import it. (while-read, not mapfile -- system bash is 3.2 and lacks readarray.)
DEF_FILES=$(grep -rln 'function runVerify' apps/cli/src | sort -u)
DEF_COUNT=$(printf '%s\n' "$DEF_FILES" | grep -c .)

if [ "$DEF_COUNT" -ne 1 ]; then
  echo "    fail -- expected exactly 1 file to define runVerify, found $DEF_COUNT:"
  printf '%s\n' "$DEF_FILES" | sed 's/^/      /'
  PASS=false
else
  DEFINER=$(printf '%s\n' "$DEF_FILES" | head -1)
  echo "    sole definer: $DEFINER"
  while IFS= read -r ref; do
    [ -z "$ref" ] && continue
    [ "$ref" = "$DEFINER" ] && continue
    if grep -Eq 'import[^;]*runVerify' "$ref"; then
      echo "    ok: $ref imports shared runVerify"
    else
      echo "    fail -- $ref references runVerify without importing the shared definition"
      PASS=false
    fi
  done < <(grep -rln 'runVerify' apps/cli/src | sort -u)
fi

echo "[43.B2] the usecase command routes the verify action into the shared producer"
# The whole point of DF-006: usecase verify must no longer dead-end. Confirm the
# usecase command wires the verify action into runVerify rather than leaving it
# to the "Missing usecase action." fallthrough.
if grep -q 'runVerify' apps/cli/src/commands/usecase.ts; then
  echo "    pass -- apps/cli/src/commands/usecase.ts routes verify into runVerify"
else
  echo "    fail -- apps/cli/src/commands/usecase.ts never references runVerify; verify action still dead-ends"
  PASS=false
fi

echo "[43.C1 Gate rigor]"
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
