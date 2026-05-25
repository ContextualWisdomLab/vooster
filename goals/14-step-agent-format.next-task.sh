#!/usr/bin/env bash
# goals/14-step-agent-format.next-task.sh — Task hints for goal 14.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -F "runMutationCommand<StepResponse>" apps/cli/src/commands/step.ts >/dev/null 2>&1 ||
   ! grep -F "context: (data) => ({ revision: data.revision.id })" apps/cli/src/commands/step.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement step add/edit --format=agent.

  See goals/14-step-agent-format.md § "Tranche C — CLI Implementation",
  § "Tranche D — Unit Proof", and § "Tranche E — Honest E2E Proof".
EOF
  exit 0
fi

if grep -F '`step add` / `step edit`' docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Remove step add/edit from the agent-format debt list.

  See goals/14-step-agent-format.md § "Tranche A — Findings Debt".
  Keep unrelated remaining debt queued and preserve the step-edit
  context.revision asymmetry note.
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
