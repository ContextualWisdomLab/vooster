#!/usr/bin/env bash
# goals/23-member-api-key-agent-format.next-task.sh — Task hints for goal 23.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OLD_MEMBER_BULLET='`member invite`, `api-key create|list|revoke`'
SYNC_BULLET='`lock release`'

if grep -F "$OLD_MEMBER_BULLET" docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget prior member/API-key sentinels, then remove that findings debt.

  See goals/23-member-api-key-agent-format.md § "Tranche A — Findings Debt".
  The next remaining-debt sentinel is: `lock release`.
  RED first if the sentinel behavior is not already covered.
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' apps/cli/src/commands/member.ts >/dev/null 2>&1 ||
   ! grep -F 'format === "agent"' apps/cli/src/commands/api-key.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement member/API-key --format=agent.

  See goals/23-member-api-key-agent-format.md § "Tranche C — CLI Implementation",
  § "Tranche D — Unit Proof", and § "Tranche E — Honest E2E Proof".
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

if ! grep -F "$SYNC_BULLET" docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Restore the next remaining debt sentinel in docs/findings/2026-05-21T1856-cli-spec-gaps.md:
  `lock release`
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 23:

  bash goals/23-member-api-key-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
