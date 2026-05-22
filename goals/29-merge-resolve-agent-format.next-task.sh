#!/usr/bin/env bash
# goals/29-merge-resolve-agent-format.next-task.sh — Task hints for goal 29.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OLD_MERGE_BULLET='`merge resolve`'

if grep -F -- "- $OLD_MERGE_BULLET" docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Split merge resolve findings debt.

  Remove the exact agent-format bullet:
    `merge resolve`

  Keep:
    `lock release`
    `merge resolve public conflict setup`
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' apps/cli/src/commands/merge.ts |
   grep -F "resolve" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement merge resolve --format=agent.

  Start with:
    apps/cli/tests/unit/merge-resolve-agent-format.test.ts
    apps/cli/tests/e2e-cli/merge-resolve-agent-format.test.ts

  Keep __test setup out of production code and do not add an honest E2E file.
EOF
  exit 0
fi

if ! grep -F "### Agent Format - Merge Resolve" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document merge resolve --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 29:

  bash goals/29-merge-resolve-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
