#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="74-dogfood-vspec-usecase-verify-with-no-key-leaks-raw-apierro"
GATE="goals/$GOAL_NAME.gates.sh"
CORPUS="apps/cli/tests/fixtures/usecase-verify-error-surface.txt"
SUITE="apps/cli/tests/unit/usecase-verify-error-surface.test.ts"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 74 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-005 `usecase verify` no-key raw-ApiError finding.
MSG
  exit 0
fi

# Advisory proxy 1: the verify error-surface corpus does not yet exist.
if [ ! -f "$CORPUS" ]; then
  cat <<MSG
TASK: Establish the verify error-surface corpus (source of truth).
  - Create $CORPUS, one \`vspec usecase verify\` failure scenario per line
    (# comments and blank lines are ignored by the gate).
  - It MUST include the dogfood anchor line exactly:
      __NONE__
    which means "invoke \`vspec usecase verify\` with NO use case key". Add a
    representative spread (>= 2 total) that also covers the unresolved-key 404
    case -- e.g. a second line with a use case key that the API cannot resolve.
  - The Goal 74 gate (74.B1) loops the real runVerify over every line against a
    stubbed 404, so each scenario fails until it stops leaking a raw ApiError /
    bare Error and starts emitting a structured envelope.
MSG
  exit 0
fi

# Advisory proxy 2: at least one corpus scenario still leaks a raw ApiError / bare
# Error, or lacks a structured envelope on an API failure.
if bash "$ROOT/$GATE" 2>&1 | grep -qE 'leaks a raw ApiError|leaks a bare Error|did not emit a structured envelope'; then
  cat <<'MSG'
TASK: Stop `vspec usecase verify` from leaking a raw ApiError / bare Error (test first).
  - runVerify in apps/cli/src/commands/verify.ts resolves its argument through
    verifyFlagsFrom -> requiredArgument(usecaseId, "usecase-id"), which throws a
    bare Error on a missing key; and it never catches the ApiError that fetchJson
    throws on a 404, so an unresolved key prints `ApiError: API request failed
    with 404.` verbatim.
  - First add failing cases in apps/cli/tests/unit/usecase-verify-error-surface.test.ts:
    for a no-key invocation and for a stubbed 404 on a supplied key, the output is
    a structured envelope (stable `code`), the message names what is wrong (the
    missing usecase-id argument, or the unresolved key the agent passed), and
    suggested_next_actions points at `vspec usecase list` plus verifying a
    specific key. Cover BOTH --format agent and the default human output. Keep the
    verify happy path green.
  - Then make verify translate the missing-argument and ApiError cases into the
    documented envelope. Reuse the existing agent-envelope machinery and shared
    error-code set rather than re-inventing it; decide the exact wording and
    next-actions yourself.
  - Re-run the Goal 74 gate.
MSG
  exit 0
fi

# Advisory proxy 3: the corpus + leak loop pass but the behaviour suite is red
# (self-teaching content or the happy path regressed).
if ! pnpm exec vitest run "$SUITE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Make the missing/unresolved-key envelope self-teaching (test first).
  - In apps/cli/tests/unit/usecase-verify-error-surface.test.ts, assert that a
    no-key invocation names the missing usecase-id argument and that an unresolved
    key names the key the agent passed, and that suggested_next_actions points at
    `vspec usecase list` (to discover a valid key) plus verifying a specific key --
    in both --format agent and the default human output.
  - Then adjust the verify error handling in apps/cli/src/commands/verify.ts
    accordingly. Do not regress the verify happy path or the existing failure
    statuses (broken_links / unlinked_steps / spec_failed / structural_failed /
    failing_tests).
  - Re-run the Goal 74 gate and completion-check.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Goal 74 gate is red but the obvious proxies pass.
  - Run `bash goals/74-dogfood-vspec-usecase-verify-with-no-key-leaks-raw-apierro.gates.sh`
    and read the failing sub-gate (typecheck, behaviour suite, 74.B1 corpus
    enumeration, or rigor).
  - Address only the reported failure; keep every verify error scenario free of
    raw ApiError / bare Error leaks and the missing/unresolved-key envelope
    self-teaching.
MSG
