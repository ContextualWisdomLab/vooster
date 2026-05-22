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

CORE_AGENT_SITES=(
  "actor create|apps/cli/src/commands/actor.ts|createActor"
  "stakeholder create|apps/cli/src/commands/stakeholder.ts|createStakeholder"
  "goal create|apps/cli/src/commands/goal.ts|createGoal"
  "goal list|apps/cli/src/commands/goal.ts|listGoals"
  "goal promote|apps/cli/src/commands/goal.ts|promoteGoal"
  "usecase create|apps/cli/src/commands/usecase.ts|createUsecase"
)

extract_function() {
  local file="$1"
  local fn="$2"
  awk -v fn="$fn" '
    $0 ~ "^(async )?function " fn "\\(" { capture=1 }
    capture && $0 ~ "^(async )?function " && $0 !~ "^(async )?function " fn "\\(" { exit }
    capture { print }
  ' "$file"
}

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
TASK: Clear stale write-path --format=agent findings (gate 10.A1).

  Remove these tokens from bullet lines in $FINDINGS under
  "## \`--format=agent\` coverage debt":

EOF
  printf '    %s\n' "${A1_OFFENDERS[@]}"
  cat <<'EOF'

  Do not remove unrelated session/branch/lock/etc. debt.

  Commit:
    docs(cli): clear proven write-path agent findings
EOF
  exit 0
fi

B1_OFFENDERS=()
for site in "${CORE_AGENT_SITES[@]}"; do
  IFS='|' read -r verb file fn <<<"$site"
  block=$(extract_function "$file" "$fn")
  if [ -z "$block" ] ||
     ! printf '%s\n' "$block" | grep -F 'format === "agent"' >/dev/null 2>&1 ||
     ! printf '%s\n' "$block" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$verb in $fn")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Add handler-local agent envelopes for core write paths (gate 10.B1).

  Missing or incomplete handler branches:

EOF
  printf '    %s\n' "${B1_OFFENDERS[@]}"
  cat <<'EOF'

  Use buildAgentEnvelope({ data: response.body }) unless the command already
  has richer response data. The CLI may synthesize null context and empty
  arrays via buildAgentEnvelope defaults.

  Commit:
    feat(cli): return agent envelope for usecase create
EOF
  exit 0
fi

if [ ! -f "$UNIT_TEST" ]; then
  cat <<EOF
TASK: Add unit proof for write-path agent envelopes (gate 10.C1).

  Create:
    $UNIT_TEST

  Include one distinct test title per declared verb:
EOF
  for site in "${CORE_AGENT_SITES[@]}"; do
    IFS='|' read -r verb _file _fn <<<"$site"
    printf '    agent %s\n' "$verb"
  done
  cat <<'EOF'

  Each test should invoke the command with --format=agent, parse the emitted
  JSON, and assert format_version.

  Commit:
    test(cli): prove write-path agent envelopes in unit tests
EOF
  exit 0
fi

if [ ! -f "$HONEST_TEST" ]; then
  cat <<EOF
TASK: Add honest E2E proof for write-path agent envelopes (gate 10.D1).

  Create:
    $HONEST_TEST

  It must use runCli, VSPEC_CONFIG_PATH, and --format=agent, avoid fetch(,
  and parse format_version from every declared verb's output.

  Commit:
    test(cli): prove write-path agent envelopes through honest cli
EOF
  exit 0
fi

if ! bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/10-agent-write-path.md" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make gate rigor green for Goal 10 (gate 10.E1).

  Re-run:
    bash scripts/check-gate-rigor.sh goals/10-agent-write-path.md

  If the markdown claims a universal set, ensure the gate enumerates it.
EOF
  exit 0
fi

cat <<'EOF'
TASK: Goal 10 appears locally green. Verify the active goal boundary:

  bash goals/10-agent-write-path.gates.sh
  bash scripts/active-check.sh
EOF
