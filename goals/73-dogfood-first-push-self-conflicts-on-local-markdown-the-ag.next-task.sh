#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="73-dogfood-first-push-self-conflicts-on-local-markdown-the-ag"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 73 is green.
  - Run bash scripts/completion-check.sh to advance the active-goal pointer.
  - Mark resolved: true in the DF-001 finding
    docs/findings/2026-06-04T2359-dogfood-20260604T234100Z-df-001-first-push-self-conflicts-on-local-markdown.md.
MSG
  exit 0
fi

# Advisory proxy 1: a single-source structural invariant regressed -- there is
# more than one materialization funnel or more than one push-base reader, so the
# no-self-conflict guarantee no longer applies to every authoring write command.
if bash "$ROOT/$GATE" 2>&1 \
  | grep -qE 'expected exactly 1 .* call site|called outside'; then
  cat <<'MSG'
TASK: Keep the no-self-conflict guarantee universal -- one funnel, one push-base reader.
  - A behaviour test only proves the verbs it drives. The structural guarantee is
    that EVERY authoring write refreshes the local base_revision through ONE shared
    funnel, and `vspec push` reads its conflict base from ONE place.
  - Local re-materialization must stay routed through the single autoExport( call
    site in apps/cli/src/application/mutation-runner.ts (do not add a second
    materialization path in a command).
  - The base_revision push submits must stay derived from the single
    baseRevisionFrom( call site in apps/cli/src/commands/sync-files.ts (its
    localSyncFile caller) -- do not add a second reader that ignores the
    materialized frontmatter.
  - Re-run the Goal 73 gate.
MSG
  exit 0
fi

# Advisory proxy 2: the structural invariants hold but the behaviour suite is red
# (or absent) -- the pure-CLI authoring flow still self-conflicts on first push.
if ! pnpm exec vitest run apps/cli/tests/unit/push-after-cli-authoring.test.ts --passWithNoTests=false >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Stop the first `vspec push` from self-conflicting after pure-CLI authoring (test first).
  - Read goals/73-dogfood-first-push-self-conflicts-on-local-markdown-the-ag.md
    and the DF-001 finding it cites. The agent authored a use case entirely via
    `vspec usecase create / scenario add / step add`, hand-edited nothing, yet the
    first `vspec push` reported a conflict because the local specs/<KEY>.md
    frontmatter `revision:` (the base_revision push submits) lagged the server
    head those same writes produced.
  - First add a failing case in
    apps/cli/tests/unit/push-after-cli-authoring.test.ts: drive a pure-CLI
    authoring chain through the shared mutation runner across at least two write
    kinds (a scenario mutation AND a step mutation), make no manual edit to any
    specs/*.md, then assert the base_revision collectLocalSyncFiles would submit
    for the affected file equals the server head the last write produced, so a
    subsequent push fast-forwards with no conflict and no content change.
  - Then make the shared funnel leave the frontmatter revision current: ensure the
    autoExport(...) re-materialization in mutation-runner.ts rewrites the affected
    specs/<KEY>.md (and its `revision:` frontmatter) to the post-mutation server
    revision, so push reads a matching base_revision. Decide the smallest change
    yourself; keep the existing mutation-runner / sync suites green.
  - Re-run the Goal 73 gate.
MSG
  exit 0
fi

# Advisory proxy 3: behaviour + structure pass but the CLI does not typecheck.
if ! pnpm --filter @vooster/cli typecheck >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Make the CLI typecheck (push-base / materialization wiring).
  - Resolve the type errors introduced by the materialization fix without
    weakening the base_revision contract, then re-run the Goal 73 gate.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Goal 73 gate is red but the obvious proxies pass.
  - Run `bash goals/73-dogfood-first-push-self-conflicts-on-local-markdown-the-ag.gates.sh`
    and read the failing sub-gate (typecheck, behaviour suite, 73.B1/B2 single-source
    enumeration, or rigor).
  - Address only the reported failure; keep a pure-CLI authoring flow pushing cleanly
    on its first `vspec push`.
MSG
