#!/usr/bin/env bash
# goals/13-lock-agent-format.next-task.sh — Task hints for goal 13.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! grep -F 'format === "agent"' apps/cli/src/commands/lock-output.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Add RED tests, then implement lock acquire --format=agent. See
goals/13-lock-agent-format.md § "Tranche C — CLI Implementation",
§ "Tranche D — Unit Proof", and § "Tranche E — Honest E2E Proof".
EOF
  exit 0
fi

if grep -F "lock (acquire/release/renew)" docs/findings/2026-05-21T1856-cli-spec-gaps.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Split the broad lock findings bullet. See goals/13-lock-agent-format.md
§ "Tranche A — Findings Debt". Keep unrelated remaining lock debt queued.
EOF
  exit 0
fi

if ! grep -F "### Agent Format for Locks" docs/07-cli-spec.md >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Document lock acquire --format=agent in docs/07-cli-spec.md. See
goals/13-lock-agent-format.md § "Tranche B — CLI Spec".
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 13:

  bash goals/13-lock-agent-format.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
