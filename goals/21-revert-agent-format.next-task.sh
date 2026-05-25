#!/usr/bin/env bash
# goals/21-revert-agent-format.next-task.sh — Task hints for goal 21.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if grep -F '`revert`, `comment add|list|edit|resolve|''delete`' docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget Goal 18/19/20 sentinels, then narrow revert debt.

  See goals/21-revert-agent-format.md § "Tranche A — Findings Debt".
  The post-revert sentinel remains: `lock release`.
  RED first if the sentinel behavior is not already covered.
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' apps/cli/src/commands/revert.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement revert --format=agent.

  See goals/21-revert-agent-format.md § "Tranche C — CLI Implementation",
  § "Tranche D — Unit Proof", and § "Tranche E — Honest E2E Proof".
EOF
  exit 0
fi

if ! grep -F "### Agent Format — Revert" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document revert --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 21:

  bash goals/21-revert-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
