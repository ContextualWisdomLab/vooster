#!/usr/bin/env bash
# goals/10-agent-write-path.next-task.sh — Task hints for goal 10.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
UNIT_TEST=apps/cli/tests/unit/agent-format-write-path.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/agent-format-write-path.test.ts

BACKLOG_VERBS=(
  "goal create"
  "goal list"
  "goal promote"
  "actor create"
  "stakeholder create"
)

CORE_VERBS=(
  "actor create"
  "stakeholder create"
  "goal create"
  "goal list"
  "goal promote"
  "usecase create"
)

MISSING_SECTION=$(awk '
  /^## `--format=agent` coverage debt/ { capture=1; next }
  capture && /^## / { capture=0 }
  capture && /^-/ { print }
' "$FINDINGS")
A1_OFFENDERS=()
for verb in "${BACKLOG_VERBS[@]}"; do
  if printf '%s\n' "$MISSING_SECTION" | grep -F -- "$verb" >/dev/null 2>&1; then
    A1_OFFENDERS+=("$verb")
  fi
done
if [ "${#A1_OFFENDERS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Clear stale write-path --format=agent findings. See
goals/10-agent-write-path.md § "Tranche A — Findings Debt".

Remaining stale tokens:

EOF
  printf '    %s\n' "${A1_OFFENDERS[@]}"
  cat <<'EOF'

Keep unrelated agent-format debt queued.
EOF
  exit 0
fi

if [ ! -f "$UNIT_TEST" ]; then
  cat <<EOF
TASK: Add RED tests, then implement write-path agent envelopes. See
goals/10-agent-write-path.md § "Tranche B — Unit Proof" and
§ "Tranche C — Honest E2E Proof".

Declared verbs:
EOF
  for verb in "${CORE_VERBS[@]}"; do
    printf '    %s\n' "$verb"
  done
  exit 0
fi

if [ ! -f "$HONEST_TEST" ]; then
  cat <<'EOF'
TASK: Add honest E2E proof for write-path agent envelopes. See
goals/10-agent-write-path.md § "Tranche C — Honest E2E Proof".
EOF
  exit 0
fi

if ! bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/10-agent-write-path.md" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make gate rigor green for Goal 10:

  bash scripts/check-gate-rigor.sh goals/10-agent-write-path.md
EOF
  exit 0
fi

cat <<'EOF'
TASK: Goal 10 appears locally green. Verify:

  bash goals/10-agent-write-path.gates.sh
  VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh
EOF
