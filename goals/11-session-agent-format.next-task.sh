#!/usr/bin/env bash
# goals/11-session-agent-format.next-task.sh — Task hints for goal 11.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
SESSION_CMD=apps/cli/src/commands/session.ts
UNIT_TEST=apps/cli/tests/unit/session-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/session-agent-format.test.ts

if grep -F "session start" "$FINDINGS" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Clear the session --format=agent finding. See
goals/11-session-agent-format.md § "Tranche A — Findings Debt". Keep unrelated
agent-format debt queued.
EOF
  exit 0
fi

if ! grep -F "### Agent Format for Sessions" "$CLI_SPEC" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document session --format=agent in docs/07-cli-spec.md. See
goals/11-session-agent-format.md § "Tranche B — CLI Spec".
EOF
  exit 0
fi

if ! grep -F 'format === "agent"' "$SESSION_CMD" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement session --format=agent. See
goals/11-session-agent-format.md § "Tranche C — CLI Implementation",
§ "Tranche D — Unit Proof", and § "Tranche E — Honest E2E Proof".
EOF
  exit 0
fi

if [ ! -f "$UNIT_TEST" ]; then
  cat <<EOF
TASK: Add focused unit proof for session agent format. See
goals/11-session-agent-format.md § "Tranche D — Unit Proof".
EOF
  exit 0
fi

if [ ! -f "$HONEST_TEST" ]; then
  cat <<EOF
TASK: Add honest E2E proof for session agent format. See
goals/11-session-agent-format.md § "Tranche E — Honest E2E Proof".
EOF
  exit 0
fi

if ! bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/11-session-agent-format.md" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make gate rigor green for Goal 11:

  bash scripts/check-gate-rigor.sh goals/11-session-agent-format.md
EOF
  exit 0
fi

cat <<'EOF'
TASK: Goal 11 appears locally green. Verify:

  bash goals/11-session-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
