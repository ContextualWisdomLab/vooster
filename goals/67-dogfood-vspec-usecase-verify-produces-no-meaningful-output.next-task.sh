#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="67-dogfood-vspec-usecase-verify-produces-no-meaningful-output"
GATE="goals/$GOAL_NAME.gates.sh"

USECASE_FILE="apps/cli/src/commands/usecase.ts"
INDEX_FILE="apps/cli/src/index.ts"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 67 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-006 "vspec usecase verify produces no meaningful
    output" finding, recording the test name / command whose output flips from the
    bare `vspec CLI` banner to the routed runVerify verdict.
MSG
  exit 0
fi

# Are any handled usecase actions missing a dispatcher route?
MISSING=""
ACTIONS=$(grep -oE 'action === "[a-z-]+"' "$USECASE_FILE" 2>/dev/null \
            | sed -E 's/.*"([a-z-]+)".*/\1/' | sort -u)
while IFS= read -r action; do
  [ -z "$action" ] && continue
  if ! grep -qE "\"usecase ${action}\"" "$INDEX_FILE" 2>/dev/null; then
    MISSING="$MISSING $action"
  fi
done <<EOF
$ACTIONS
EOF
MISSING="${MISSING# }"

if [ -n "$MISSING" ]; then
  cat <<MSG
TASK: Register the missing usecase dispatcher route(s): $MISSING
  - DF-006: \`vspec usecase verify <id>\` printed only the bare \`vspec CLI\` banner
    because the dispatcher (commandRoutes / commandRouteKeys in $INDEX_FILE) has no
    route for it -- it never reaches runUsecase, so the Goal 43/54/55 verdict never
    runs. runUsecase already handles action === "verify"; the gap is the route.
  - Write the failing test FIRST
    (apps/cli/tests/unit/usecase-verify-dispatch.test.ts): commandRouteKeys() must
    include "usecase verify", and resolving \`usecase verify <id>\` must dispatch
    into the verify path (runUsecase verify -> runVerify) rather than falling
    through to the banner. Then add the route(s) to commandRoutes in $INDEX_FILE,
    mirroring the existing "usecase show" / "usecase set" entries
    (runUsecase(flags, "<action>", argv[2], writeLine)).
  - Update the frozen route snapshot in
    apps/cli/tests/unit/dispatcher-routes.test.ts to include the new key(s).
  - Do NOT touch runVerify / runUsecase / suggestVerifyActions semantics -- this
    goal is additive routing only; keep Goal 43/54/55 gates green.
  - Re-run the Goal 67 gate and completion-check.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Routes are registered but the Goal 67 gate is still red. Confirm:
  - apps/cli/tests/unit/usecase-verify-dispatch.test.ts proves `usecase verify` is
    a routed key AND dispatches into the runVerify verdict path (a structured
    verdict with checks + pass/fail, suggested_next_actions on failure, and
    --format=agent honored with no human prose in the agent envelope), never the
    bare banner;
  - the dispatcher-routes.test.ts snapshot lists every new "usecase <action>" key;
  - the existing usecase-verify-routing.test.ts stays green (runUsecase verify
    still reaches runVerify);
  - the CLI typechecks.
  Re-run:
    pnpm --filter @vooster/cli typecheck
    pnpm exec vitest run apps/cli/tests/unit/usecase-verify-dispatch.test.ts apps/cli/tests/unit/dispatcher-routes.test.ts apps/cli/tests/unit/usecase-verify-routing.test.ts
    bash goals/67-dogfood-vspec-usecase-verify-produces-no-meaningful-output.gates.sh
MSG
