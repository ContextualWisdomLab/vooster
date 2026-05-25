#!/usr/bin/env bash
# goals/27-push-agent-format.next-task.sh — Task hints for goal 27.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OLD_PUSH_BULLET='`push`'
LOCK_BULLET='`lock release`'

if grep -F "$OLD_PUSH_BULLET" docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget prior push sentinels, then remove push from findings.

  See goals/27-push-agent-format.md § "Tranche A — Findings Debt".
  Prior gate + next-task files should keep the next sentinel: `lock release`.
  Findings should also keep: `merge resolve public conflict setup`.
EOF
  exit 0
fi

if grep -lF "$OLD_PUSH_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null |
   grep -vE 'goals/27-push-agent-format\.(gates|next-task)\.sh$' >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Finish retargeting prior push sentinels.

  See goals/27-push-agent-format.md § "Tranche A — Findings Debt".
  The next remaining-debt sentinel is: `lock release`.
EOF
  exit 0
fi

if ! grep -F 'format: Flags.string()' apps/cli/src/commands/push.ts >/dev/null 2>&1 ||
   ! grep -F 'suggested_next_actions: body.suggested_next_actions' apps/cli/src/commands/sync.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement push --format=agent.

  See goals/27-push-agent-format.md § "Tranche C — CLI Implementation",
  § "Tranche D — Unit Proof", and § "Tranche E — Honest E2E Proof".
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
