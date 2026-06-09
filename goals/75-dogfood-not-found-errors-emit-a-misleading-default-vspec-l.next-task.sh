#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="75-dogfood-not-found-errors-emit-a-misleading-default-vspec-l"
GATE="goals/$GOAL_NAME.gates.sh"
CORPUS="apps/api/tests/fixtures/not-found-recovery-surface.txt"
SUITE="apps/api/tests/unit/http/not-found-recovery.test.ts"
HELPER="apps/api/src/http/signup-support.ts"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 75 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-006 NOT_FOUND misleading-recovery finding.
MSG
  exit 0
fi

# Advisory proxy 1: the recovery-surface corpus does not yet exist.
if [ ! -f "$CORPUS" ]; then
  cat <<MSG
TASK: Establish the not-found recovery-surface corpus (source of truth).
  - Create $CORPUS, one entity-NOT_FOUND scenario token per line
    (# comments and blank lines are ignored by the gate).
  - It MUST include the dogfood anchor line exactly:
      step-add-scenario-not-found
    which is the \`Scenario not found\` case that misdirected the agent. Add a
    representative spread (>= 2 total) covering a second entity NOT_FOUND sender,
    e.g. a line:
      step-edit-step-not-found
  - The Goal 75 gate (75.B1) loops the real result-sender for every token and
    fails until each captured response stops carrying the signup recovery and
    starts teaching \`vspec usecase show\`. Tokens the harness does not model are
    reported as __UNKNOWN_TOKEN__.
MSG
  exit 0
fi

# Advisory proxy 2: the shared problem() default still hardcodes the signup recovery.
if grep -nE 'suggestedNextActions[[:space:]]*=.*Restart signup' "$HELPER" >/dev/null 2>&1; then
  cat <<MSG
TASK: Remove the signup-flavored default from the shared problem() helper (test first).
  - $HELPER defines problem(status, title, extra, suggestedNextActions = [{ command:
    "vspec login", reason: "Restart signup." }]). Every problem(404, "<entity> not
    found") caller that omits an explicit suggestion inherits this misleading
    recovery.
  - First add failing cases in $SUITE asserting that an entity NOT_FOUND response
    (Scenario / Step / Use case not found) carries NO \`vspec login\` command and a
    \`vspec usecase show\` recovery, while the genuinely auth-related callers
    (githubUnavailable, the no-vspec-user signup case) still recommend \`vspec
    login\`.
  - Then drop the signup default from problem() (default to an empty array) and
    keep the auth callers passing their auth recovery explicitly. Decide the exact
    wording yourself.
  - Re-run the Goal 75 gate.
MSG
  exit 0
fi

# Advisory proxy 3: some corpus scenario still leaks the signup recovery or fails
# to teach the real one.
if bash "$ROOT/$GATE" 2>&1 | grep -qE 'still suggests the signup recovery|still carries the "Restart signup"|does not teach the real recovery|is not modelled by the gate harness|threw instead of sending'; then
  cat <<MSG
TASK: Give entity NOT_FOUND responses a self-teaching recovery (test first).
  - The misleading default is gone, but at least one corpus scenario still does
    not teach the real fix. Entity-lookup 404s must point the agent at re-reading
    the use case to get current ids:
      { command: "vspec usecase show <KEY>", reason: "Re-read the use case to get
        the current scenario/step ids." }
  - Update the relevant senders -- e.g. \`Scenario not found\` /
    \`Use case not found\` in apps/api/src/http/scenario-results.ts and
    \`Step not found\` in apps/api/src/http/step-results.ts -- to pass this
    recovery explicitly. Add the matching assertions in $SUITE first.
  - If the gate reports __UNKNOWN_TOKEN__, the corpus lists a scenario the harness
    registry does not model: either remove that line or pick a token the harness
    drives.
  - Re-run the Goal 75 gate.
MSG
  exit 0
fi

# Advisory proxy 4: corpus + helper invariants pass but the behaviour suite is red.
if ! pnpm exec vitest run "$SUITE" >/dev/null 2>&1; then
  cat <<MSG
TASK: Make the entity NOT_FOUND envelope self-teaching while preserving auth recoveries (test first).
  - In $SUITE, assert that an entity NOT_FOUND response names \`vspec usecase show\`
    and no signup command, and that the auth/signup callers that legitimately
    recommend \`vspec login\` still do.
  - Then adjust the senders accordingly. Do not regress any existing Problem
    Details / suggested_next_actions behaviour.
  - Re-run the Goal 75 gate and completion-check.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Goal 75 gate is red but the obvious proxies pass.
  - Run `bash goals/75-dogfood-not-found-errors-emit-a-misleading-default-vspec-l.gates.sh`
    and read the failing sub-gate (typecheck, behaviour suite, 75.B1 corpus
    enumeration, 75.B2 helper default, or rigor).
  - Address only the reported failure; keep every entity NOT_FOUND response free
    of the signup recovery and teaching `vspec usecase show`.
MSG
