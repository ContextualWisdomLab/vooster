#!/usr/bin/env bash
# goals/16-change-agent-format.next-task.sh — Task hints for goal 16.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -F 'format === "agent"' apps/cli/src/commands/change.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement change propose/commit --format=agent.

  Start with:
    apps/cli/tests/unit/change-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/change-agent-format.test.ts

  Then update apps/cli/src/commands/change.ts to use buildAgentEnvelope.
  change propose keeps context.revision null; change commit sets it from the
  first committed revision id when present.
EOF
  exit 0
fi

if grep -F '`change propose` / `change commit`' docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Remove change propose/commit from the agent-format debt list.

  Keep lock release/renew and merge open/resolve as unrelated debt.
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
