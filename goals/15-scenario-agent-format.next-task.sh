#!/usr/bin/env bash
# goals/15-scenario-agent-format.next-task.sh — Task hints for goal 15.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -F 'format === "agent"' apps/cli/src/commands/scenario.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement scenario add --format=agent.

  Start with:
    apps/cli/tests/unit/scenario-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/scenario-agent-format.test.ts

  Then update apps/cli/src/commands/scenario.ts to use buildAgentEnvelope.
  scenario add should set context.revision from data.revision.id.
EOF
  exit 0
fi

if grep -F '`scenario add`' docs/findings-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Remove scenario add from the agent-format debt list.

  Keep the change propose / change commit debt as the next unrelated sentinel.
EOF
  exit 0
fi

if ! grep -F "### Agent Format — Scenarios" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document scenario add --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 15:

  bash goals/15-scenario-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
