#!/usr/bin/env bash
# goals/14-step-agent-format.next-task.sh — Task hints for goal 14.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -F 'format === "agent"' apps/cli/src/commands/step.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement step add/edit --format=agent.

  Start with:
    apps/cli/tests/unit/step-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/step-agent-format.test.ts

  Then update apps/cli/src/commands/step.ts to use buildAgentEnvelope.
  step add should set context.revision; step edit should leave it null.
EOF
  exit 0
fi

if grep -F '`step add` / `step edit`' docs/findings-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Remove step add/edit from the agent-format debt list.

  Keep scenario add. Add the context.revision asymmetry note for step edit.
EOF
  exit 0
fi

if ! grep -F "### Agent Format — Steps" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document step add/edit --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 14:

  bash goals/14-step-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
