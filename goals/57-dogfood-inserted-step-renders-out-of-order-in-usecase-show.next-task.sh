#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="57-dogfood-inserted-step-renders-out-of-order-in-usecase-show"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 57 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-003 inserted-step-out-of-order finding.
MSG
  exit 0
fi

TEST="apps/api/tests/unit/application/inserted-step-display-order.test.ts"

if [ ! -f "$TEST" ]; then
  cat <<'MSG'
TASK: Pin the bug with a failing cross-surface ordering test (TDD, RED first).
  - Reproduce DF-003: build a main success scenario, then insert a step
    mid-scenario (the --at path through addScenarioStep in
    apps/api/src/application/scenario-authoring.ts).
  - Write apps/api/tests/unit/application/inserted-step-display-order.test.ts
    asserting, for an insert at position 1, a middle position, and past the end:
      * the persisted steps' order_index ordering equals their step_number
        ordering (1,2,3,... with no gaps) -- order_index must not drift to the
        tail;
      * the human usecase-show surface, the agent payload
        (apps/api/src/application/usecase-agent-data.ts), and the markdown
        render (apps/api/src/application/markdown-renderer.ts) all list the
        steps in step_number order, never the stored 1,3,4,2 order.
  - Pick the surface entry points yourself by reading the source; do not assert
    on private helpers.
  - Run the test and confirm it is RED for the right reason.
MSG
  exit 0
fi

if ! grep -rq 'function orderScenarioStepsForDisplay' apps/api/src; then
  cat <<'MSG'
TASK: Make order_index consistent on insert AND route every surface through one
shared ordering (GREEN).
  - Fix the positional insert so order_index is rebalanced to agree with
    step_number (reuse the existing re-sequencer rather than appending at the
    tail) -- see apps/api/src/application/scenario-authoring.ts /
    step-editing.ts.
  - Introduce a single shared function orderScenarioStepsForDisplay in one file
    under apps/api/src that returns a scenario's steps in step_number order.
    Decide where it lives and its exact signature yourself; do not duplicate the
    ordering math.
  - Route every output surface through it -- the human usecase-show renderer,
    the agent payload (usecase-agent-data.ts), and the markdown renderer
    (markdown-renderer.ts) -- replacing any per-surface order_index sort. No
    other file under apps/api/src may define its own step-ordering producer.
  - Re-run the Goal 57 gate.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Close the remaining gap, then verify.
  - The shared orderScenarioStepsForDisplay exists; the gate is still red.
  - Likely a referring file still orders steps itself instead of importing the
    shared function, order_index is not yet consistent on every insert position,
    or a surface was missed. Re-read the gate output to see which check fails.
  - Re-run:
      pnpm --filter @vooster/api typecheck
      pnpm exec vitest run apps/api/tests/unit/application/inserted-step-display-order.test.ts apps/api/tests/unit/application/scenario-step-positioning.test.ts
      bash goals/57-dogfood-inserted-step-renders-out-of-order-in-usecase-show.gates.sh
MSG
