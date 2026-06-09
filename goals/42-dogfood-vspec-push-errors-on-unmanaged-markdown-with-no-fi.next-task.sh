#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="42-dogfood-vspec-push-errors-on-unmanaged-markdown-with-no-fi"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 42 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-001 vspec-push sync-file finding.
MSG
  exit 0
fi

BARE_RE='new Error\(["'\''`]Sync file is missing revision'

if grep -rEq "$BARE_RE" apps/cli/src; then
  cat <<'MSG'
TASK: Replace the bare sync-file throw with a typed, coded error.
  - apps/cli/src/commands/sync-files.ts throws
    `new Error("Sync file is missing revision frontmatter.")` for every
    specs/ markdown file with no revision -- it names no file, has no code,
    and aborts the whole push.
  - Write a failing unit test first
    (apps/cli/tests/unit/sync-files-classification.test.ts): collecting a
    specs/ tree must SKIP an unmanaged file (no frontmatter, e.g.
    SEED_NOTES.md) while still pushing the managed file, and must raise a
    typed error that NAMES the offending file, carries a stable non-empty
    `code`, and lists >=1 suggested_next_actions for a file that has
    frontmatter but no revision.
  - Then introduce the typed sync-file error and classify each file
    (managed / unmanaged / incomplete). Decide the code value, the message
    wording, and the next-action commands yourself; do not just special-case
    SEED_NOTES.md.
  - Re-run the Goal 42 gate and completion-check.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Surface skips and typed errors through push, then verify.
  - The bare throw is gone, but the gate is still red. Confirm:
      * unmanaged files are skipped AND a warning naming each skipped file is
        surfaced to the caller (human + agent output),
      * managed files still push (apps/cli/tests/unit/push-agent-format.test.ts
        stays green),
      * the typed error's code + suggested_next_actions reach the user.
  - Keep the classification in one place so the three classes cannot drift.
  - Re-run:
      pnpm --filter @vooster/cli typecheck
      pnpm exec vitest run apps/cli/tests/unit/sync-files-classification.test.ts apps/cli/tests/unit/push-agent-format.test.ts
      bash goals/42-dogfood-vspec-push-errors-on-unmanaged-markdown-with-no-fi.gates.sh
MSG
