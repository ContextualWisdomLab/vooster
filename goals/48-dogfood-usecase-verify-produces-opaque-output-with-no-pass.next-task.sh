#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="48-dogfood-usecase-verify-produces-opaque-output-with-no-pass"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 48 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-001 usecase-verify (per-check) finding.
MSG
  exit 0
fi

DEF_COUNT=$(grep -rln 'function runSpecChecks' apps/cli/src 2>/dev/null | sort -u | grep -c .)

if [ "$DEF_COUNT" != "1" ]; then
  cat <<'MSG'
TASK: Add a single shared spec-fidelity check producer feeding the verify verdict.
  - Goal 43 already routes `usecase verify` into runVerify, but runVerify only
    checks implementation-link / test drift -- a structurally broken spec still
    verifies clean. DF-001 wants verify to actually inspect the spec.
  - Write a failing unit test first
    (apps/cli/tests/unit/usecase-verify-checks.test.ts): verify must report a
    per-check pass/fail for the four spec checks -- actors registered, scenario
    completeness, extension points resolved, Cockburn fidelity -- aggregate them
    into the overall verdict, and exit non-zero when any check fails. Assert this
    across human / json / agent formats (agent envelope must carry the per-check
    breakdown).
  - Then implement the checks in ONE producer `runSpecChecks` under
    apps/cli/src, and have runVerify feed the use-case body through it. Do NOT
    fork a second verdict path -- keep runVerify single-source (Goal 43) and the
    spec checks single-source. Decide what each check inspects from the
    usecase-show response; do not hard-code the dogfood example.
  - Re-run the Goal 48 gate and completion-check.
MSG
  exit 0
fi

if ! grep -q 'runSpecChecks' apps/cli/src/commands/verify.ts; then
  cat <<'MSG'
TASK: Wire runSpecChecks into the verify verdict.
  - runSpecChecks is defined but apps/cli/src/commands/verify.ts never feeds the
    use-case body through it, so verify still emits link drift alone.
  - Aggregate the per-check outcomes into the overall status and exit code, and
    surface the breakdown in every format (human per-check lines, json structure,
    agent envelope data).
  - Re-run the Goal 48 gate and completion-check.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Finish per-check coverage + single-source, then verify.
  - The producer is wired, but the gate is still red. Confirm:
      * each of the four spec checks (actors / scenario completeness / extension
        points / Cockburn) reports pass/fail, the overall verdict aggregates
        them, and a failed check yields a non-zero exit
        (apps/cli/tests/unit/usecase-verify-checks.test.ts),
      * the existing verify verdict suite and usecase-verify routing suite stay
        green (verify-command.test.ts, usecase-verify-routing.test.ts),
      * there is exactly ONE runSpecChecks definition under apps/cli/src and every
        other referrer imports it -- no copied check set that can drift.
  - Re-run:
      pnpm --filter @vooster/cli typecheck
      pnpm exec vitest run apps/cli/tests/unit/usecase-verify-checks.test.ts apps/cli/tests/unit/verify-command.test.ts apps/cli/tests/unit/usecase-verify-routing.test.ts
      bash goals/48-dogfood-usecase-verify-produces-opaque-output-with-no-pass.gates.sh
MSG
