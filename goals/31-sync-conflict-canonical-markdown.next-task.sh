#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if bash "$ROOT/goals/31-sync-conflict-canonical-markdown.gates.sh" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 31 is green.
  - Run pnpm exec vitest run apps/api/tests/e2e/UC-029.test.ts.
  - Run bash scripts/completion-check.sh.
  - Resolve docs/findings/2026-05-23T1836-sync-conflict-canonical-markdown.md.
MSG
else
  cat <<'MSG'
TASK: Make goal 31 green with RED first.
  - Ensure stale sync conflicts render the remote half with canonical markdown.
  - Remove usecaseMarkdown from sync source.
  - Re-run the UC-029 e2e test and Goal 31 gate.
MSG
fi
