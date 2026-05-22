#!/usr/bin/env bash
# goals/28-lock-renew-agent-format.next-task.sh — Task hints for goal 28.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OLD_LOCK_BULLET='`lock release` / `lock renew`'
LOCK_RELEASE_BULLET='`lock release`'

if grep -F "$OLD_LOCK_BULLET" docs/findings-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget prior lock sentinels, then split findings to lock release.

  Prior gate + next-task files that used lock release/renew as the
  remaining-debt sentinel should now use:
    `lock release`

  Findings should keep:
    `lock release`
    `merge resolve`
EOF
  exit 0
fi

if grep -lF "$OLD_LOCK_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null |
   grep -vE 'goals/28-lock-renew-agent-format\.(gates|next-task)\.sh$' >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Finish retargeting prior lock sentinels.

  Replace remaining goal gate/next-task sentinel literals:
    `lock release` / `lock renew`

  With:
    `lock release`
EOF
  exit 0
fi

if ! grep -F 'parsed.args.command === "lock" && this.argv[1] === "renew"' apps/cli/src/index.ts >/dev/null 2>&1 ||
   ! grep -F "/v1/locks/\${renewFlags.lockId}/renew" apps/cli/src/commands/lock.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement lock renew --format=agent.

  Start with:
    apps/cli/tests/unit/lock-renew-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/lock-renew-agent-format.test.ts

  Then update lock.ts, index.ts, and acquire guidance to support lock-id renew.
EOF
  exit 0
fi

if ! grep -F "### Agent Format - Lock Renew" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document lock renew --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 28:

  bash goals/28-lock-renew-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
