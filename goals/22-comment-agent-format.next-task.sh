#!/usr/bin/env bash
# goals/22-comment-agent-format.next-task.sh — Task hints for goal 22.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if grep -F '`comment add|list|edit|resolve|delete`' docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget Goal 18/19/20/21 sentinels, then remove comment debt.

  Goal 18, Goal 19, Goal 20, and Goal 21 gate + next-task files should use:
    `lock release`

  Findings should keep:
    `lock release`
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' apps/cli/src/commands/comment.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement comment --format=agent.

  Start with:
    apps/cli/tests/unit/comment-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/comment-agent-format.test.ts

  Then update apps/cli/src/commands/comment.ts to use buildAgentEnvelope for
  add/list/edit/resolve/delete.
EOF
  exit 0
fi

if ! grep -F "### Agent Format — Comments" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document comment --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 22:

  bash goals/22-comment-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
