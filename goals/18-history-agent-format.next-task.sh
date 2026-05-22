#!/usr/bin/env bash
# goals/18-history-agent-format.next-task.sh — Task hints for goal 18.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if grep -F '`history`, `impact`, `revert`, `wh''o`, `comment add|list|edit|resolve|''delete`' docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget prior sentinels, then narrow history debt.

  Prior gates 14-17 should use:
    `lock release`

  Findings should keep:
    `lock release`
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' apps/cli/src/commands/history.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement history --format=agent.

  Start with:
    apps/cli/tests/unit/history-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/history-agent-format.test.ts

  Then update apps/cli/src/commands/history.ts to use buildAgentEnvelope.
  context.revision should come from data.revisions[0].revision when present.
EOF
  exit 0
fi

if ! grep -F "### Agent Format — History" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document history --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 18:

  bash goals/18-history-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
