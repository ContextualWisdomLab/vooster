#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="56-dogfood-local-spec-markdown-goes-stale-after-cli-authoring"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 56 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-002 stale-local-markdown finding
    (docs/findings/2026-06-04T2116-...-df-002-local-spec-markdown-goes-stale-after-cli-au.md).
MSG
  exit 0
fi

TEST="apps/cli/tests/unit/mutation-stale-local-files.test.ts"
RUNNER="apps/cli/src/application/mutation-runner.ts"
COMMAND="apps/cli/src/application/mutation-command.ts"

if [ ! -f "$TEST" ]; then
  cat <<'MSG'
TASK: Lock the stale-local-file behavior with a failing unit test first (TDD).
  - Create apps/cli/tests/unit/mutation-stale-local-files.test.ts.
  - Drive the shared runner (mutation-command.ts -> mutation-runner.ts) with a
    successful mutation in two project-context states:
      * project context resolves -> the success envelope reports a NON-EMPTY
        affected_files write set (materialization happened);
      * NO project context resolves (projectId null, so auto-export is skipped)
        -> the success envelope still has status "ok" AND its
        suggested_next_actions includes an entry whose command runs `vspec pull`
        and whose reason says local spec files may be stale and must be pulled.
  - The second case is the regression that produced DF-002 -- it must fail RED now.
    Decide your own stubbing of the http/auto-export boundary; do not assert on
    private internals beyond the envelope contract.
  - Re-run the Goal 56 gate.
MSG
  exit 0
fi

if ! grep -Eq 'pull' "$RUNNER" "$COMMAND"; then
  cat <<'MSG'
TASK: Make the shared runner emit a `vspec pull` hint when it cannot auto-export.
  - In mutation-command.ts, autoExport is set undefined whenever projectId is
    null; in that case runMutation returns affected_files: []. That empty write
    set reads as "nothing changed locally" while the server DID change.
  - When a mutation succeeds but materialization was skipped (no project
    context), append a deterministic suggested_next_action whose command is
    `vspec pull` and whose reason warns the local spec files may be stale.
  - Keep today's behavior unchanged when auto-export runs: still materialize and
    still report the non-empty affected_files write set.
  - Put the logic in the single shared runner so it covers every authoring verb
    (do NOT special-case scenario/step/stakeholder individually -- that would
    create a second guarantee-free path and fail gate 56.B1).
  - Re-run:
      pnpm --filter @vooster/cli typecheck
      pnpm exec vitest run apps/cli/tests/unit/mutation-stale-local-files.test.ts
      bash goals/56-dogfood-local-spec-markdown-goes-stale-after-cli-authoring.gates.sh
MSG
  exit 0
fi

cat <<'MSG'
TASK: Close out -- one funnel, suites green, then verify.
  - Gate still red. Likely causes:
      * 56.B1: a verb performs a spec write through a path that bypasses the
        shared runMutation (more than one runMutation( call site, or a call
        outside mutation-command.ts). Route every spec mutation through the one
        shared runner instead.
      * 56.A2: the materialize case or the pull-hint case is not yet satisfied,
        or an existing mutation suite regressed.
  - Re-run:
      pnpm --filter @vooster/cli typecheck
      pnpm exec vitest run apps/cli/tests/unit/mutation-stale-local-files.test.ts
      bash goals/56-dogfood-local-spec-markdown-goes-stale-after-cli-authoring.gates.sh
MSG
