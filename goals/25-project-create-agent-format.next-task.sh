#!/usr/bin/env bash
# goals/25-project-create-agent-format.next-task.sh — Task hints for goal 25.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_BULLET='`project create`'
SYNC_BULLET='`lock release`'

if grep -F "$PROJECT_BULLET" docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Retarget Goal 24's sentinel, then remove project-create debt.

  See goals/25-project-create-agent-format.md § "Tranche A — Findings Debt".
  Goal 24 gate + next-task files should keep the next sentinel: `lock release`.
  RED first if project-create behavior is not already covered.
EOF
  exit 0
fi

if ! grep -F "### Agent Format — Project Create" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document project create --format=agent in docs/07-cli-spec.md.
EOF
  exit 0
fi

if [ ! -f apps/cli/tests/unit/project-create-agent-format.test.ts ] ||
   [ ! -f apps/cli/tests/e2e-cli-honest/project-create-agent-format.test.ts ]; then
  cat <<'EOF'
TASK: Add RED tests, then fix project create --format=agent config behavior.

  See goals/25-project-create-agent-format.md § "Tranche C — CLI Implementation",
  § "Tranche D — Unit Proof", and § "Tranche E — Honest E2E Proof".
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 25:

  bash goals/25-project-create-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
