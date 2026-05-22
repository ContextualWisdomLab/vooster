#!/usr/bin/env bash
# goals/27-push-agent-format.next-task.sh — Task hints for goal 27.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OLD_PUSH_BULLET='`push`'
LOCK_BULLET='`lock release`'

if grep -F "$OLD_PUSH_BULLET" docs/findings-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget prior push sentinels, then remove push from findings.

  Prior gate + next-task files that used push as the remaining-debt sentinel
  should now use:
    `lock release`

  Findings should keep:
    `lock release`
    `merge resolve`
EOF
  exit 0
fi

if grep -lF "$OLD_PUSH_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null |
   grep -vE 'goals/27-push-agent-format\.(gates|next-task)\.sh$' >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Finish retargeting prior push sentinels.

  Replace remaining goal gate/next-task sentinel literals:
    `push`

  With:
    `lock release`
EOF
  exit 0
fi

if ! grep -F 'format: Flags.string()' apps/cli/src/commands/push.ts >/dev/null 2>&1 ||
   ! grep -F 'suggested_next_actions: body.suggested_next_actions' apps/cli/src/commands/sync.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement push --format=agent.

  Start with:
    apps/cli/tests/unit/push-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/push-agent-format.test.ts

  Then update push.ts and sync.ts to support agent formatting for push only.
EOF
  exit 0
fi

if ! grep -F "### Agent Format - Push" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document push --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 27:

  bash goals/27-push-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
