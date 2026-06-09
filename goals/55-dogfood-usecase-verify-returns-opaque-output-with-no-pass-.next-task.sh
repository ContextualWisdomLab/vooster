#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="55-dogfood-usecase-verify-returns-opaque-output-with-no-pass-"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 55 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-006 usecase-verify (suggested_next_actions on
    failure) finding, recording the test name / command whose failure output now
    carries actionable suggestions.
MSG
  exit 0
fi

DEF_COUNT=$(grep -rln 'function suggestVerifyActions' apps/cli/src 2>/dev/null | sort -u | grep -c .)

if [ "$DEF_COUNT" != "1" ]; then
  cat <<'MSG'
TASK: Add a single shared remediation producer for the verify verdict.
  - Goal 43 already routes `usecase verify` into runVerify and emits a status,
    but a FAILING verify still hands the agent only a verdict -- no next move.
    DF-006 wants every failing check to carry a suggested next action.
  - Write a failing unit test first
    (apps/cli/tests/unit/usecase-verify-next-actions.test.ts): a non-passing
    verify must produce one suggested next action per failing check (none
    dropped), surface them in the agent envelope's suggested_next_actions and
    inline in the human verdict, and a clean verdict must carry none and exit 0.
    Assert across human / json / agent formats (agent envelope only, no human
    prose mixed into agent stdout).
  - Then implement the failing-check -> next-action mapping in ONE producer
    `suggestVerifyActions` under apps/cli/src, and have runVerify feed its
    failing checks through it. Do NOT fork a second mapping for the human path --
    keep runVerify single-source (Goal 43) and the remediation single-source.
    Decide each remediation from the failing-check kind; do not hard-code the
    dogfood example id.
  - Re-run the Goal 55 gate and completion-check.
MSG
  exit 0
fi

if ! grep -q 'suggestVerifyActions' apps/cli/src/commands/verify.ts; then
  cat <<'MSG'
TASK: Wire suggestVerifyActions into the verify failure output.
  - suggestVerifyActions is defined but apps/cli/src/commands/verify.ts never
    feeds its failing checks through it, so a failing verify still emits a bare
    verdict.
  - Populate suggested_next_actions in the agent envelope and print the same
    remediation lines under the human verdict; leave a clean verdict's suggestion
    set empty and its exit code 0.
  - Re-run the Goal 55 gate and completion-check.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Finish per-failing-check coverage + single-source, then verify.
  - The producer is wired, but the gate is still red. Confirm:
      * a non-passing verdict yields one suggested next action per failing check
        (none dropped) and a clean verdict yields none and exits 0
        (apps/cli/tests/unit/usecase-verify-next-actions.test.ts),
      * suggestions appear in the agent envelope's suggested_next_actions and
        inline in the human verdict, with the json structure intact,
      * the existing verify verdict suite and usecase-verify routing suite stay
        green (verify-command.test.ts, usecase-verify-routing.test.ts),
      * there is exactly ONE suggestVerifyActions definition under apps/cli/src
        and every other referrer imports it -- no copied map that can drift.
  - Re-run:
      pnpm --filter @vooster/cli typecheck
      pnpm exec vitest run apps/cli/tests/unit/usecase-verify-next-actions.test.ts apps/cli/tests/unit/verify-command.test.ts apps/cli/tests/unit/usecase-verify-routing.test.ts
      bash goals/55-dogfood-usecase-verify-returns-opaque-output-with-no-pass-.gates.sh
MSG
