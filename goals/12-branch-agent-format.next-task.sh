#!/usr/bin/env bash
# goals/12-branch-agent-format.next-task.sh — Task hints for goal 12.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -F 'format === "agent"' apps/cli/src/commands/branch.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests then implement branch create --format=agent.

  Start with:
    apps/cli/tests/unit/branch-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/branch-agent-format.test.ts

  Then update apps/cli/src/commands/branch.ts to use buildAgentEnvelope
  and set context.branch from data.branch.name.
EOF
  exit 0
fi

if grep -F "branch create" docs/findings-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Remove the branch create bullet from docs/findings-cli-spec-gaps.md.

  Keep unrelated debts such as lock.
EOF
  exit 0
fi

if ! grep -F "### Agent Format for Branches" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document branch create --format=agent in docs/07-cli-spec.md.

  Add "### Agent Format for Branches" under Branches & Merges with the
  branch create example and context.branch behavior.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 12:

  bash goals/12-branch-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
