#!/usr/bin/env bash
# goals/26-pull-sync-agent-format.next-task.sh — Task hints for goal 26.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OLD_SYNC_BULLET='`pull`, `pu''sh`, `sync`'
PUSH_BULLET='`lock release`'

if grep -F "$OLD_SYNC_BULLET" docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget prior sync sentinels.

  See goals/26-pull-sync-agent-format.md § "Tranche A — Findings Debt".
  Prior gate + next-task files should keep the next sentinel: `lock release`.
  RED first if pull/sync behavior is not already covered.
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' apps/cli/src/commands/sync.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement pull/sync --format=agent.

  See goals/26-pull-sync-agent-format.md § "Tranche C — CLI Implementation",
  § "Tranche D — Unit Proof", and § "Tranche E — Honest E2E Proof".
EOF
  exit 0
fi

if ! grep -F "### Agent Format — Pull and Sync" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document pull/sync --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 26:

  bash goals/26-pull-sync-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
