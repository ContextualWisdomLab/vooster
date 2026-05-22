#!/usr/bin/env bash
# goals/13-lock-agent-format.next-task.sh — Task hints for goal 13.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -F 'format === "agent"' apps/cli/src/commands/lock.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement lock acquire --format=agent.

  Start with:
    apps/cli/tests/unit/lock-agent-format.test.ts
    apps/cli/tests/e2e-cli-honest/lock-agent-format.test.ts

  Then update apps/cli/src/commands/lock.ts to use buildAgentEnvelope.
  context.session_id should come from --session, not from the holder field.
EOF
  exit 0
fi

if grep -F "lock (acquire/release/renew)" docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Split the broad lock findings bullet.

  Replace:
    lock (acquire/release/renew)
  with remaining debt:
    lock release / lock renew
EOF
  exit 0
fi

if ! grep -F "### Agent Format for Locks" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document lock acquire --format=agent in docs/07-cli-spec.md.

  Add "### Agent Format for Locks" under Locks with a JSON example containing
  held_by_session_id and a sentence about context.session_id coming from
  --session.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 13:

  bash goals/13-lock-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
