#!/usr/bin/env bash
# goals/15-scenario-agent-format.next-task.sh — Task hints for goal 15.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -F "runMutationCommand<ScenarioResponse>" apps/cli/src/commands/scenario.ts >/dev/null 2>&1 ||
   ! grep -F "context: (data) => ({ revision: data.revision.id })" apps/cli/src/commands/scenario.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement scenario add --format=agent.

  See goals/15-scenario-agent-format.md § "Tranche C — CLI Implementation",
  § "Tranche D — Unit Proof", and § "Tranche E — Honest E2E Proof".
EOF
  exit 0
fi

if grep -F '`scenario add`' docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Remove scenario add from the agent-format debt list.

  See goals/15-scenario-agent-format.md § "Tranche A — Findings Debt".
  Keep unrelated remaining debt queued.
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
