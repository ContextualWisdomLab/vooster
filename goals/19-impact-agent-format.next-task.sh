#!/usr/bin/env bash
# goals/19-impact-agent-format.next-task.sh — Task hints for goal 19.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if grep -F '`revert`, `wh''o`, `comment add|list|edit|resolve|''delete`' docs/findings-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget Goal 18's sentinel, then narrow impact debt.

  Goal 18 should use:
    `lock release`

  Findings should keep:
    `lock release`
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' apps/cli/src/commands/impact.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement impact --format=agent.

  Start with:
    apps/cli/tests/unit/impact-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/impact-agent-format.test.ts

  Then update apps/cli/src/commands/impact.ts to use buildAgentEnvelope.
  context.revision should come from the latest revision used as base_revision.
EOF
  exit 0
fi

if ! grep -F "### Agent Format — Impact" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document impact --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 19:

  bash goals/19-impact-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
