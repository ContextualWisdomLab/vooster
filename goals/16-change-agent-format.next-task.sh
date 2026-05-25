#!/usr/bin/env bash
# goals/16-change-agent-format.next-task.sh — Task hints for goal 16.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -F 'format === "agent"' apps/cli/src/commands/change.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement change propose/commit --format=agent.

  See goals/16-change-agent-format.md § "Tranche C — CLI Implementation",
  § "Tranche D — Unit Proof", and § "Tranche E — Honest E2E Proof".
EOF
  exit 0
fi

if grep -F '`change propose` / `change commit`' docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Remove change propose/commit from the agent-format debt list.

  See goals/16-change-agent-format.md § "Tranche A — Findings Debt".
  Keep unrelated remaining debt queued.
EOF
  exit 0
fi

if ! grep -F "### Agent Format — Changes" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document change propose/commit --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 16:

  bash goals/16-change-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
