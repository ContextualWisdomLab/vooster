#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="69-dogfood-local-working-copy-goes-stale-after-server-side-mu"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 69 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-002 stale-working-copy finding
    (docs/findings/2026-06-04T2303-...-df-002-local-working-copy-goes-stale-after-server-.md),
    quoting the closing commit / test name per docs/findings/CLAUDE.md.
MSG
  exit 0
fi

TEST="apps/cli/tests/unit/working-copy-reconcile.test.ts"
RUNNER="apps/cli/src/application/mutation-runner.ts"

if [ ! -f "$TEST" ]; then
  cat <<'MSG'
TASK: Lock the working-copy reconciliation contract with a failing unit test first (TDD).
  - Create apps/cli/tests/unit/working-copy-reconcile.test.ts.
  - Drive the shared mutation runner (mutation-runner.ts, via mutation-command.ts)
    with a successful mutation in two project-context states, for the verbs the
    finding exercised (usecase add-stakeholder, scenario add, step add):
      * project context resolves -> auto-export runs -> the success envelope
        reports a NON-EMPTY affected_files write set (the local specs/<KEY>.md is
        materialized to the post-mutation server state);
      * NO project context resolves (projectId null, auto-export skipped) -> the
        success envelope still has status "ok" AND its suggested_next_actions
        includes an entry whose command runs `vspec pull` and whose reason says
        the local working copy may be stale and must be refreshed.
  - The skipped-materialization case is the regression that produced DF-002 -- it
    must fail RED before the fix. Stub the http / auto-export boundary yourself;
    assert only on the envelope contract, not private internals.
  - Re-run the Goal 69 gate.
MSG
  exit 0
fi

if ! grep -Eq 'autoExport|localRefreshHints|pull' "$RUNNER"; then
  cat <<'MSG'
TASK: Make the shared runner reconcile the working copy or warn when it cannot.
  - In the single shared mutation runner (mutation-runner.ts), a successful
    mutation must materialize affected files via the one autoExport( funnel when a
    project context resolves, and otherwise append a deterministic
    suggested_next_action whose command is `vspec pull` and whose reason warns the
    local working copy may be stale.
  - Keep create's behavior and add today's behavior consistent: every
    spec-mutating verb either materializes or warns -- no verb returns an empty
    affected_files write set with no compensating stale-warning.
  - Put the logic in the single shared runner so it covers every authoring verb;
    do NOT special-case scenario/step/stakeholder individually -- a second
    materialization path would fail gate 69.B1.
  - Re-run:
      pnpm --filter @vooster/cli typecheck
      pnpm exec vitest run apps/cli/tests/unit/working-copy-reconcile.test.ts
      bash goals/69-dogfood-local-working-copy-goes-stale-after-server-side-mu.gates.sh
MSG
  exit 0
fi

cat <<'MSG'
TASK: Close out -- one funnel, suites green, then verify.
  - Gate still red. Likely causes:
      * 69.B1: a verb materializes (or skips materializing) through a path that
        bypasses the shared autoExport( funnel -- more than one autoExport( call
        site, or a call outside mutation-runner.ts. Route every materialization
        through the one shared funnel instead.
      * 69.A2: the materialize case or the stale-warning case is not yet satisfied
        for one of the exercised verbs, or an existing mutation suite regressed.
  - Re-run:
      pnpm --filter @vooster/cli typecheck
      pnpm exec vitest run apps/cli/tests/unit/working-copy-reconcile.test.ts
      bash goals/69-dogfood-local-working-copy-goes-stale-after-server-side-mu.gates.sh
MSG
