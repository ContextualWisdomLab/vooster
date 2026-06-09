#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="71-dogfood-vspec-actor-show-name-leaks-raw-apierror-api-reque"
GATE="goals/$GOAL_NAME.gates.sh"
CORPUS="apps/cli/tests/fixtures/actor-error-surface-commands.txt"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 71 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-005 `actor show` raw-ApiError finding.
MSG
  exit 0
fi

# Advisory proxy 1: the error-surface corpus does not yet exist.
if [ ! -f "$CORPUS" ]; then
  cat <<MSG
TASK: Establish the actor error-surface corpus (source of truth).
  - Create $CORPUS, one \`vspec actor\` sub-action per line (# comments and blank
    lines are ignored by the gate).
  - It MUST include the dogfood anchor line exactly:
      show
    plus a representative spread (>= 3 total) of the actor commands that resolve
    an actor against the API. Suggested set: show, edit, archive, list.
  - The Goal 71 gate (71.B1) loops the real runActor over every line against a
    stubbed 404, so each command will fail until it stops leaking a raw ApiError
    class string and starts emitting a structured envelope.
MSG
  exit 0
fi

# Advisory proxy 2: at least one corpus command still leaks a raw ApiError / lacks
# a structured envelope on an API failure.
if bash "$ROOT/$GATE" 2>&1 | grep -qE 'leaks a raw ApiError|did not emit a structured envelope'; then
  cat <<'MSG'
TASK: Stop the actor read/by-id commands from leaking a raw ApiError (test first).
  - The actor commands (showActor/editActor/archiveActor/listActors in
    apps/cli/src/commands/actor.ts) call fetchJson/patchJson/deleteJson directly
    and never catch ApiError, so a 404 prints `ApiError: API request failed with
    404.` verbatim.
  - First add failing cases in apps/cli/tests/unit/actor-command.test.ts: for a
    stubbed 404 on show/edit/archive, the output is a structured envelope (stable
    `code`), the message names the lookup key the agent passed, and
    suggested_next_actions points at `vspec actor list`. Cover BOTH --format agent
    and the default human output. Keep the happy-path cases green.
  - Then make each actor command translate an ApiError into the documented
    envelope. Reuse the existing machinery (writeAgentErrorEnvelope /
    buildErrorEnvelope / extractError / extractSuggestedNextActions) rather than
    re-inventing it; decide the exact wording and next-actions yourself.
  - Re-run the Goal 71 gate.
MSG
  exit 0
fi

# Advisory proxy 3: the corpus + leak loop pass but the behaviour suite is red
# (self-teaching content or a happy path regressed).
if ! pnpm exec vitest run apps/cli/tests/unit/actor-command.test.ts >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Make the unresolved-actor envelope self-teaching (test first).
  - In apps/cli/tests/unit/actor-command.test.ts, assert that an unresolved actor
    envelope names the supplied lookup key and that suggested_next_actions points
    at `vspec actor list` so the agent can retry with the listed id — in both
    --format agent and the default human output.
  - Then adjust the actor command error handling in
    apps/cli/src/commands/actor.ts accordingly. Do not regress the list/show/edit/
    archive happy paths.
  - Re-run the Goal 71 gate and completion-check.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Goal 71 gate is red but the obvious proxies pass.
  - Run `bash goals/71-dogfood-vspec-actor-show-name-leaks-raw-apierror-api-reque.gates.sh`
    and read the failing sub-gate (typecheck, behaviour suite, 71.B1 corpus
    enumeration, or rigor).
  - Address only the reported failure; keep every actor command free of raw
    ApiError leaks and the unresolved-actor envelope self-teaching.
MSG
