#!/usr/bin/env bash
# goals/20-who-agent-format.next-task.sh — Task hints for goal 20.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if grep -F '`revert`, `who`, `comment add|list|edit|resolve|''delete`' docs/findings-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget Goal 18/19 sentinels, then narrow who debt.

  Goal 18 and Goal 19 gate + next-task files should use:
    `lock release`

  Findings should keep:
    `lock release`
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' apps/cli/src/commands/who.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement who --format=agent.

  Start with:
    apps/cli/tests/unit/who-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/who-agent-format.test.ts

  Then update apps/cli/src/commands/who.ts to use buildAgentEnvelope.
  Context should stay at the default null values; suggested_next_actions should
  be copied from the API response.
EOF
  exit 0
fi

if ! grep -F "### Agent Format — Who" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document who --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 20:

  bash goals/20-who-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
