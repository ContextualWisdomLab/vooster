#!/usr/bin/env bash
# goals/23-member-api-key-agent-format.next-task.sh — Task hints for goal 23.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OLD_MEMBER_BULLET='`member invite`, `api-key create|list|revoke`'
SYNC_BULLET='`lock release`'

if grep -F "$OLD_MEMBER_BULLET" docs/findings-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget prior member/API-key sentinels, then remove that findings debt.

  Prior gate + next-task files that used member/API-key as the remaining-debt
  sentinel should now use:
    `lock release`

  Findings should keep:
    `lock release`
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' apps/cli/src/commands/member.ts >/dev/null 2>&1 ||
   ! grep -F 'format === "agent"' apps/cli/src/commands/api-key.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement member/API-key --format=agent.

  Start with:
    apps/cli/tests/unit/member-api-key-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/member-api-key-agent-format.test.ts

  Then update member.ts and api-key.ts to use buildAgentEnvelope.
EOF
  exit 0
fi

if ! grep -F "### Agent Format — API Keys" docs/07-cli-spec.md >/dev/null 2>&1 ||
   ! grep -F "### Agent Format — Membership" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document member/API-key --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

if ! grep -F "$SYNC_BULLET" docs/findings-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Restore the next remaining debt sentinel in docs/findings-cli-spec-gaps.md:
  `lock release`
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 23:

  bash goals/23-member-api-key-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
