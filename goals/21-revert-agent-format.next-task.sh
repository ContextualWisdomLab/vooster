#!/usr/bin/env bash
# goals/21-revert-agent-format.next-task.sh — Task hints for goal 21.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if grep -F '`revert`, `comment add|list|edit|resolve|''delete`' docs/findings-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget Goal 18/19/20 sentinels, then narrow revert debt.

  Goal 18, Goal 19, and Goal 20 gate + next-task files should use:
    `lock release`

  Findings should keep:
    `lock release`
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' apps/cli/src/commands/revert.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement revert --format=agent.

  Start with:
    apps/cli/tests/unit/revert-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/revert-agent-format.test.ts

  Then update apps/cli/src/commands/revert.ts to use buildAgentEnvelope.
  context.revision should come from data.revision.id.
EOF
  exit 0
fi

if ! grep -F "### Agent Format — Revert" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document revert --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 21:

  bash goals/21-revert-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
