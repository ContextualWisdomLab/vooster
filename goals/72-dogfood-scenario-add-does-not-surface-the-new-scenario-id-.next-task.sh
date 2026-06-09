#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="72-dogfood-scenario-add-does-not-surface-the-new-scenario-id-"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 72 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-006 `scenario add` missing-scenario-id finding.
MSG
  exit 0
fi

# Advisory proxy 1: the universal loop fails -- at least one scenario type still
# does not surface the real scenario id in a `vspec step add` next action.
if bash "$ROOT/$GATE" 2>&1 \
  | grep -qE 'did not surface the real scenario id|NO_STEP_ADD_NEXT_ACTION|PLACEHOLDER|NO_REAL_ID'; then
  cat <<'MSG'
TASK: Echo the new scenario id back to the agent on a successful create (test first).
  - The CREATED branch of sendCreateScenarioResult in
    apps/api/src/http/scenario-results.ts sends scenario/revision/steps but no
    suggested_next_actions, so `vspec scenario add --format=agent` never hands the
    agent the id it needs for `vspec step add`. The guide only shows the literal
    `<main-scenario-id>` placeholder.
  - First add a failing case in apps/api/tests/unit/http/scenario-results.test.ts:
    a CREATED result with a known scenario id must send a suggested_next_actions
    entry whose command is a concrete `vspec step add <that real id> …` -- the
    actual id templated in, NOT a `<…>` placeholder. Cover at least the anchor
    type MAIN_SUCCESS; keep the existing CREATED happy-path assertions green.
  - Then attach that next action in the CREATED branch (template the real
    scenario.id into the command), and carry `suggested_next_actions` through
    `scenarioCreateResponseSchema` in packages/contracts/src/scenario.ts so the
    parsed response does not strip it. Reuse the existing next-action shape
    (problem(...)'s fourth argument / the suggestedNextActionSchema) rather than
    inventing a new one; decide the exact wording and any extra actions yourself.
  - Re-run the Goal 72 gate.
MSG
  exit 0
fi

# Advisory proxy 2: the universal loop passes but the behaviour suite is red
# (wording / templated id / a happy path regressed) or the API does not typecheck.
if ! pnpm exec vitest run apps/api/tests/unit/http/scenario-results.test.ts >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Lock the create next-action content and keep the happy path green (test first).
  - In apps/api/tests/unit/http/scenario-results.test.ts, pin the next-action
    wording and the templated id for the CREATED path, and assert the create
    response still validates against scenarioCreateResponseSchema (error/duplicate
    paths unchanged).
  - Then reconcile apps/api/src/http/scenario-results.ts (and the contracts schema
    if needed) without regressing the duplicate/extension/error branches.
  - Re-run the Goal 72 gate and completion-check.
MSG
  exit 0
fi

if ! pnpm --filter @vooster/api typecheck >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Make the API typecheck (carry suggested_next_actions through the contract).
  - `suggested_next_actions` must be a declared field on scenarioCreateResponseSchema
    in packages/contracts/src/scenario.ts (array of suggestedNextActionSchema),
    otherwise scenarioCreateResponseSchema.parse(...) strips it and the agent
    never receives it.
  - Fix the types, then re-run the Goal 72 gate.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Goal 72 gate is red but the obvious proxies pass.
  - Run `bash goals/72-dogfood-scenario-add-does-not-surface-the-new-scenario-id-.gates.sh`
    and read the failing sub-gate (typecheck, behaviour suite, 72.B1 type
    enumeration, or rigor).
  - Address only the reported failure; keep every scenario type's create response
    surfacing the real scenario id in a `vspec step add <id> …` next action with
    no placeholder.
MSG
