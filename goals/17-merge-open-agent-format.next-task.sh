#!/usr/bin/env bash
# goals/17-merge-open-agent-format.next-task.sh — Task hints for goal 17.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -F 'format === "agent"' apps/cli/src/commands/merge.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement merge open --format=agent.

  Start with:
    apps/cli/tests/unit/merge-open-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/merge-open-agent-format.test.ts

  Then update apps/cli/src/commands/merge.ts to use buildAgentEnvelope in
  openMerge only. context.branch should come from data.source_branch.name.
EOF
  exit 0
fi

if grep -F '`merge open` / `merge resolve`' docs/findings-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Narrow merge open/resolve debt to merge resolve only.

  Keep lock release/renew and the history/impact/comment debt.
  Record that merge resolve public conflict setup remains queued because honest
  setup currently depends on __test endpoints.
EOF
  exit 0
fi

if ! grep -F "### Agent Format — Merges" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document merge open --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 17:

  bash goals/17-merge-open-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
