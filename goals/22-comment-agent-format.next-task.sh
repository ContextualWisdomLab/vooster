#!/usr/bin/env bash
# goals/22-comment-agent-format.next-task.sh — Task hints for goal 22.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! bash "$ROOT/goals/22-comment-agent-format.gates.sh" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Continue Goal 22 from the failing gate output.

  Start with:
    bash goals/22-comment-agent-format.gates.sh

  Keep the work aligned to goals/22-comment-agent-format.md.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Verify Goal 22 in the full chain:

  bash scripts/completion-check.sh
EOF
