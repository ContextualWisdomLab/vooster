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

  Replace:
    old project-create/project-switch combined bullet

  With:
    `lock release`

  Remove:
    `workspace switch`
    `status`

  Keep:
    `lock release`
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' apps/cli/src/commands/status.ts >/dev/null 2>&1 ||
   ! grep -F 'format === "agent"' apps/cli/src/commands/workspace.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement local-context --format=agent.

  Start with:
    apps/cli/tests/unit/local-context-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/local-context-agent-format.test.ts

  Then update status.ts, workspace.ts, and project switch handling to use
  buildAgentEnvelope.
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
