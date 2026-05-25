#!/usr/bin/env bash
# goals/12-branch-agent-format.next-task.sh — Task hints for goal 12.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -F 'format === "agent"' apps/cli/src/commands/branch.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement branch create --format=agent. See
goals/12-branch-agent-format.md § "Tranche C — CLI Implementation",
§ "Tranche D — Unit Proof", and § "Tranche E — Honest E2E Proof".
EOF
  exit 0
fi

if grep -F "branch create" docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Remove the branch create bullet from
docs/findings/2026-05-21T1856-cli-spec-gaps.md. See
goals/12-branch-agent-format.md § "Tranche A — Findings Debt". Keep unrelated
debt queued.
EOF
  exit 0
fi

if ! grep -F "### Agent Format for Branches" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document branch create --format=agent in docs/07-cli-spec.md. See
goals/12-branch-agent-format.md § "Tranche B — CLI Spec".
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 12:

  bash goals/12-branch-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
