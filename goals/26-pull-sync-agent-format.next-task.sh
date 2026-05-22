#!/usr/bin/env bash
# goals/26-pull-sync-agent-format.next-task.sh — Task hints for goal 26.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OLD_SYNC_BULLET='`pull`, `pu''sh`, `sync`'
PUSH_BULLET='`lock release`'

if grep -F "$OLD_SYNC_BULLET" docs/findings-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget prior sync sentinels.

  Prior gate + next-task files that used pull/push/sync as the remaining-debt
  sentinel should now use:
    `lock release`

  Findings should keep:
    `lock release`
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' apps/cli/src/commands/sync.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement pull/sync --format=agent.

  Start with:
    apps/cli/tests/unit/pull-sync-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/pull-sync-agent-format.test.ts

  Then update sync.ts and pull.ts to support agent formatting for the pull path.
EOF
  exit 0
fi

if ! grep -F "### Agent Format — Pull and Sync" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document pull/sync --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 26:

  bash goals/26-pull-sync-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
