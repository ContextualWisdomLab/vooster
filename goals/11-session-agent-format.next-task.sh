#!/usr/bin/env bash
# goals/11-session-agent-format.next-task.sh — Task hints for goal 11.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FINDINGS=docs/findings-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
SESSION_CMD=apps/cli/src/commands/session.ts
UNIT_TEST=apps/cli/tests/unit/session-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/session-agent-format.test.ts

if grep -F "session start" "$FINDINGS" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Clear the session --format=agent finding (gate 11.A1).

  Remove only the bullet:
    session start / session complete / session list

  Keep unrelated bullets such as branch create and lock.
EOF
  exit 0
fi

if ! grep -F "### Agent Format for Sessions" "$CLI_SPEC" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document session --format=agent in docs/07-cli-spec.md (gate 11.B1).

  Add a marked "### Agent Format for Sessions" section under Sessions with
  examples for start, list, and complete. Mention context.session_id for
  start/complete and default null context for list.
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' "$SESSION_CMD" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add session agent branches (gate 11.C1/C2).

  In apps/cli/src/commands/session.ts:
    - add buildAgentEnvelope import
    - add format flag plumbing
    - branch in startSession, listSessions, completeSession
    - set context.session_id for start and complete
EOF
  exit 0
fi

if [ ! -f "$UNIT_TEST" ]; then
  cat <<EOF
TASK: Add focused unit proof for session agent format (gate 11.D1/D2).

  Create:
    $UNIT_TEST

  Include agent and human smoke tests for session start/list/complete.
EOF
  exit 0
fi

if [ ! -f "$HONEST_TEST" ]; then
  cat <<EOF
TASK: Add honest E2E proof for session agent format (gate 11.E1).

  Create:
    $HONEST_TEST

  It must use runCli, VSPEC_CONFIG_PATH, --format=agent, and avoid fetch(.
EOF
  exit 0
fi

if ! bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/11-session-agent-format.md" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make gate rigor green for Goal 11 (gate 11.F1).

  Re-run:
    bash scripts/check-gate-rigor.sh goals/11-session-agent-format.md
EOF
  exit 0
fi

cat <<'EOF'
TASK: Goal 11 appears locally green. Verify:

  bash goals/11-session-agent-format.gates.sh
  bash scripts/active-check.sh
EOF
