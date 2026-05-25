#!/usr/bin/env bash
# goals/24-local-context-agent-format.next-task.sh — Task hints for goal 24.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OLD_PROJECT_BULLET='`project cre''ate` / `project switch`'
NEW_PROJECT_BULLET='`lock release`'
WORKSPACE_BULLET='`workspace switch`'
STATUS_BULLET='`status`'

if grep -F "$OLD_PROJECT_BULLET" docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1 ||
   grep -F "$WORKSPACE_BULLET" docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1 ||
   grep -F "$STATUS_BULLET" docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Narrow local-context findings debt.

  See goals/24-local-context-agent-format.md § "Tranche A — Findings Debt".
  The next remaining-debt sentinel is: `lock release`.
  RED first if the sentinel behavior is not already covered.
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' apps/cli/src/commands/status.ts >/dev/null 2>&1 ||
   ! grep -F 'format === "agent"' apps/cli/src/commands/workspace.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement local-context --format=agent.

  See goals/24-local-context-agent-format.md § "Tranche C — CLI Implementation",
  § "Tranche D — Unit Proof", and § "Tranche E — Honest E2E Proof".
EOF
  exit 0
fi

if ! grep -F "### Agent Format — Local Context" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document local-context --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 24:

  bash goals/24-local-context-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
