#!/usr/bin/env bash
# goals/17-merge-open-agent-format.next-task.sh — Task hints for goal 17.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -F 'format === "agent"' apps/cli/src/commands/merge.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement merge open --format=agent.

  See goals/17-merge-open-agent-format.md § "Tranche C — CLI Implementation",
  § "Tranche D — Unit Proof", and § "Tranche E — Honest E2E Proof".
EOF
  exit 0
fi

if grep -F '`merge open` / `merge resolve`' docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Narrow merge open/resolve debt to merge resolve only.

  See goals/17-merge-open-agent-format.md § "Tranche A — Findings Debt".
  Keep merge resolve public conflict setup queued because honest setup still
  depends on __test endpoints.
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
