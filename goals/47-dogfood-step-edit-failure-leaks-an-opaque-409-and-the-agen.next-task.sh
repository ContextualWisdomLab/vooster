#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="47-dogfood-step-edit-failure-leaks-an-opaque-409-and-the-agen"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 47 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-001 step-edit-409-envelope finding
    (docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-001-step-edit-failure-leaks-an-opaque-409-and-t.md).
MSG
  exit 0
fi

STEP_CMD="apps/cli/src/commands/step.ts"

if grep -qE '\bbuildAgentEnvelope\b|\bpatchJson\b' "$STEP_CMD"; then
  cat <<'MSG'
TASK: Route `step edit` through the shared status-bearing mutation runner (CLI, TDD).
  - editStep in apps/cli/src/commands/step.ts calls the raw patchJson client
    directly (an ApiError escapes uncaught -> "ApiError: API request failed with
    409.") and renders success through the status-less buildAgentEnvelope (no
    top-level `status`). step add already uses the shared runMutationCommand /
    runMutation path (apps/cli/src/application/mutation-runner.ts), which on
    success builds buildOkEnvelope (status:"ok") and on any ApiError builds
    buildErrorEnvelope (status:"error" + classified error.code +
    suggested_next_actions).
  - Write a failing CLI unit test first
    (apps/cli/tests/unit/step-edit-envelope.test.ts):
      * --format=agent success -> envelope has top-level status:"ok";
      * --format=agent on a 409/error response -> envelope has status:"error",
        a stable error.code, and the API's suggested_next_actions;
      * human format on the same error -> prints a stable message + the next
        action and exits non-zero, and the output does NOT contain
        "ApiError: API request failed".
  - Then route editStep through runMutationCommand (PATCH). Drop the direct
    patchJson and buildAgentEnvelope usage from step.ts. Decide the context /
    success-hint shape yourself, matching how addStep wires it.
  - Re-run the Goal 47 gate.
MSG
  exit 0
fi

if [ ! -f "apps/api/tests/unit/http/step-edit-conflict-problem.test.ts" ]; then
  cat <<'MSG'
TASK: Lock the API 409 conflict bodies as Problem Details (API, TDD).
  - sendStepEditingResult in apps/api/src/http/step-results.ts already returns a
    problem(...) body for its conflict branches (stale base revision, hard lock,
    semantic lock). Lock that contract so the CLI can always classify a stable
    code and surface a next action.
  - Write a failing test first
    (apps/api/tests/unit/http/step-edit-conflict-problem.test.ts): drive each
    conflict branch the step-editing result can produce and assert the response
    body carries a title that names the cause, a status, and at least one
    suggested_next_actions entry. If a branch's title does not name the cause
    (e.g. the stale-base message should point the agent at re-pinning /
    re-reading the current revision), improve the message in step-results.ts.
  - Keep apps/api/tests/unit/http/step-results.test.ts green.
  - Re-run the Goal 47 gate.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Close out Goal 47 -- typecheck and suites, then verify.
  - The CLI edit path and the API conflict bodies are in place; make the gate green.
  - Re-run:
      pnpm --filter @vooster/api typecheck
      pnpm --filter @vooster/cli typecheck
      pnpm exec vitest run apps/cli/tests/unit/step-edit-envelope.test.ts apps/cli/tests/unit/step-agent-format.test.ts apps/api/tests/unit/http/step-edit-conflict-problem.test.ts apps/api/tests/unit/http/step-results.test.ts
      bash goals/47-dogfood-step-edit-failure-leaks-an-opaque-409-and-the-agen.gates.sh
MSG
