#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="46-dogfood-step-add-is-append-only-no-way-to-insert-or-reorde"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 46 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-001 step-add-append-only finding.
MSG
  exit 0
fi

API_SRC="apps/api/src/application/scenario-authoring.ts"

if ! grep -q 'function resequenceScenarioSteps' "$API_SRC"; then
  cat <<'MSG'
TASK: Add insert-at-position behind a single shared re-sequencer (API first, TDD).
  - apps/api/src/application/scenario-authoring.ts -> addScenarioStep currently
    hard-codes order_index: steps.length and step_number: steps.length + 1, so a
    step can only land at the tail.
  - Write a failing unit test first
    (apps/api/tests/unit/application/scenario-step-positioning.test.ts):
      * inserting at position 1, at a middle position, and past the end (clamped)
        must yield step_number 1,2,3,... contiguous with no gaps and matching
        order_index;
      * omitting the position must keep today's append behavior unchanged.
  - Then introduce a single resequenceScenarioSteps function in
    scenario-authoring.ts and route the (now position-aware) add path through it.
    Decide the input field name and clamping rules yourself; do not duplicate the
    numbering math.
  - Re-run the Goal 46 gate.
MSG
  exit 0
fi

if ! grep -q 'moveScenarioStep' "$API_SRC"; then
  cat <<'MSG'
TASK: Add move/reorder for an existing step, reusing the shared re-sequencer.
  - The insert path and resequenceScenarioSteps now exist; add the move operation.
  - Extend apps/api/tests/unit/application/scenario-step-positioning.test.ts:
    moving an existing step to a new position re-sequences the scenario
    contiguously from 1, preserves the moved step's action/actor/notes, and is
    authorized + revision-tracked like other step writes.
  - Implement moveScenarioStep in scenario-authoring.ts on top of
    resequenceScenarioSteps (no second numbering producer anywhere under
    apps/api/src). Add the HTTP wiring it needs.
  - Re-run the Goal 46 gate.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Expose the CLI surface and finish, then verify.
  - The API now supports insert + move via one shared re-sequencer; surface it.
  - Write a failing CLI unit test first
    (apps/cli/tests/unit/step-positioning.test.ts): `step add --at <n>` routes the
    chosen position to the add request, and `step move <id> --to <n>` issues the
    reorder request -- decide flag/arg shapes yourself, matching the existing
    step command style in apps/cli/src/commands/step.ts.
  - Implement the flags/subcommand. Keep the append default unchanged when --at is
    omitted.
  - Re-run:
      pnpm --filter @vooster/api typecheck
      pnpm --filter @vooster/cli typecheck
      pnpm exec vitest run apps/api/tests/unit/application/scenario-step-positioning.test.ts apps/cli/tests/unit/step-positioning.test.ts
      bash goals/46-dogfood-step-add-is-append-only-no-way-to-insert-or-reorde.gates.sh
MSG
