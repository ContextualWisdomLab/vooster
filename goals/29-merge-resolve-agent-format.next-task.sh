#!/usr/bin/env bash
# goals/29-merge-resolve-agent-format.next-task.sh — Task hints for goal 29.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OLD_MERGE_BULLET='`merge resolve`'

if grep -F -- "- $OLD_MERGE_BULLET" docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Split merge resolve findings debt.

  See goals/29-merge-resolve-agent-format.md § "Tranche A — Findings Debt".
  Keep the remaining sentinels: `lock release` and
  `merge resolve public conflict setup`.
EOF
  exit 0
fi

if ! grep -F "async function resolveMerge" apps/cli/src/commands/merge.ts >/dev/null 2>&1 ||
   ! grep -F "suggested_next_actions: body.suggested_next_actions" apps/cli/src/commands/merge.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement merge resolve --format=agent.

  See goals/29-merge-resolve-agent-format.md § "Tranche C — CLI Implementation",
  § "Tranche D — Unit Proof", and § "Tranche E — CLI E2E Proof".
  Keep __test setup out of production code and do not add an honest E2E file.
EOF
  exit 0
fi

if ! grep -F "### Agent Format - Merge Resolve" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document merge resolve --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 29:

  bash goals/29-merge-resolve-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
