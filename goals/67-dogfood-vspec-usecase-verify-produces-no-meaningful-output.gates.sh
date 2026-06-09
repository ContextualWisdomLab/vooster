#!/usr/bin/env bash
# goals/67-dogfood-vspec-usecase-verify-produces-no-meaningful-output.gates.sh
# `vspec usecase verify <id>` must reach the runVerify verdict producer instead of
# falling through to the bare `vspec CLI` banner. The dispatcher must register a
# route for every `usecase` command runUsecase handles -- a handler with no route
# is the DF-006 failure. The verdict's richness (checks/pass-fail/agent envelope/
# suggested_next_actions) is already locked by the Goal 43/54/55 test suites; this
# gate locks the routing completeness those suites cannot enumerate.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="67-dogfood-vspec-usecase-verify-produces-no-meaningful-output"
GATE_INPUTS=(
  apps/cli/src/commands/usecase.ts
  apps/cli/src/index.ts
  apps/cli/tests/unit/usecase-verify-dispatch.test.ts
  apps/cli/tests/unit/dispatcher-routes.test.ts
  apps/cli/tests/unit/usecase-verify-routing.test.ts
  docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-006-vspec-usecase-verify-produces-no-meaningful.md
  goals/67-dogfood-vspec-usecase-verify-produces-no-meaningful-output.md
  goals/67-dogfood-vspec-usecase-verify-produces-no-meaningful-output.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

USECASE_FILE="apps/cli/src/commands/usecase.ts"
INDEX_FILE="apps/cli/src/index.ts"

PASS=true

echo "[67.A1] CLI typecheck (dispatcher route + verify wiring resolves)"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[67.A2] dispatch suite passes; route snapshot + usecase-verify routing stay green"
# `usecase verify` reaching runVerify's verdict (checks / pass-fail / agent
# envelope / suggested_next_actions, never a bare banner) is behavioral -- locked
# by tests, not greps (goal-design.md s1.5).
if pnpm exec vitest run \
  apps/cli/tests/unit/usecase-verify-dispatch.test.ts \
  apps/cli/tests/unit/dispatcher-routes.test.ts \
  apps/cli/tests/unit/usecase-verify-routing.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[67.B1] every usecase command runUsecase handles has a dispatcher route"
# Universal claim -> universal gate (goal-design.md s1): enumerate the handled
# actions from the source of truth (the action === "..." branches in usecase.ts)
# and loop, confirming each has a `usecase <action>` route key in index.ts. A
# handled action with no route is the DF-006 banner fall-through. The frozen route
# snapshot in dispatcher-routes.test.ts cannot prove this -- it never enumerates
# the runUsecase action set -- so this lives in the gate, not a test.
ACTIONS=$(grep -oE 'action === "[a-z-]+"' "$USECASE_FILE" \
            | sed -E 's/.*"([a-z-]+)".*/\1/' | sort -u)

if [ -z "$ACTIONS" ]; then
  echo "    fail -- no 'action === \"...\"' branches found in $USECASE_FILE (source of truth empty?)"
  PASS=false
else
  while IFS= read -r action; do
    [ -z "$action" ] && continue
    if grep -qE "\"usecase ${action}\"" "$INDEX_FILE"; then
      echo "    ok: usecase $action is routed"
    else
      echo "    fail -- runUsecase handles '$action' but $INDEX_FILE has no \"usecase $action\" route; it falls through to the bare banner"
      PASS=false
    fi
  done <<EOF
$ACTIONS
EOF
fi

echo "[67.B2] the verify route is the one DF-006 named"
# DF-006's literal command. Confirm the specific route exists at all -- the
# enumeration above proves completeness, this names the regression that triggered
# the goal so a future drop is self-describing.
if grep -qE '"usecase verify"' "$INDEX_FILE"; then
  echo "    pass -- $INDEX_FILE registers the usecase verify route"
else
  echo "    fail -- $INDEX_FILE has no \"usecase verify\" route; vspec usecase verify <id> still hits the bare banner"
  PASS=false
fi

echo "[67.C1 Gate rigor]"
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
