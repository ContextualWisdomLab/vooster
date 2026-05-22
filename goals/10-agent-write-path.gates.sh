#!/usr/bin/env bash
# goals/10-agent-write-path.gates.sh — Gate suite for goal 10 (agent
# envelope write-path proof).

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="10-agent-write-path"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/actor.ts
  apps/cli/src/commands/goal.ts
  apps/cli/src/commands/stakeholder.ts
  apps/cli/src/commands/usecase.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/findings-cli-spec-gaps.md
  scripts/check-gate-rigor.sh
  goals/10-agent-write-path.gates.sh
  goals/10-agent-write-path.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings-cli-spec-gaps.md
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

echo "[10.A1 stale write-path agent debt removed from findings]"
A1_OFFENDERS=()
MISSING_SECTION=$(awk '
  /^## `--format=agent` coverage debt/ { capture=1; next }
  capture && /^## / { capture=0 }
  capture && /^-/ { print }
' "$FINDINGS")
for verb in "${BACKLOG_VERBS[@]}"; do
  if printf '%s\n' "$MISSING_SECTION" | grep -F -- "$verb" >/dev/null 2>&1; then
    A1_OFFENDERS+=("$verb")
  fi
done
if [ "${#A1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — stale agent debt remains in $FINDINGS:"
  printf '        %s\n' "${A1_OFFENDERS[@]}"
  PASS=false
fi

echo "[10.B1 core write-path handlers build an agent envelope]"
B1_OFFENDERS=()
for site in "${CORE_AGENT_SITES[@]}"; do
  IFS='|' read -r verb file fn <<<"$site"
  block=$(extract_function "$file" "$fn")
  if [ -z "$block" ]; then
    B1_OFFENDERS+=("$verb missing $fn")
    continue
  fi
  if ! printf '%s\n' "$block" | grep -F 'format === "agent"' >/dev/null 2>&1; then
    B1_OFFENDERS+=("$verb missing format === \"agent\" in $fn")
    continue
  fi
  if ! printf '%s\n' "$block" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$verb missing buildAgentEnvelope in $fn")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — handler-level envelope gaps:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[10.C1 unit tests prove each core agent verb envelope]"
C1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  C1_OFFENDERS+=("$UNIT_TEST missing")
else
  for site in "${CORE_AGENT_SITES[@]}"; do
    IFS='|' read -r verb _file _fn <<<"$site"
    if ! grep -F -- "agent $verb" "$UNIT_TEST" >/dev/null 2>&1; then
      C1_OFFENDERS+=("$verb missing unit test title")
    fi
    if ! grep -F -- "--format=agent" "$UNIT_TEST" >/dev/null 2>&1; then
      C1_OFFENDERS+=("$UNIT_TEST missing --format=agent")
      break
    fi
    if ! grep -F -- "format_version" "$UNIT_TEST" >/dev/null 2>&1; then
      C1_OFFENDERS+=("$UNIT_TEST missing format_version assertion")
      break
    fi
  done
fi
if [ "${#C1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — unit proof gaps:"
  printf '        %s\n' "${C1_OFFENDERS[@]}"
  PASS=false
fi

echo "[10.D1 honest E2E proves each core agent verb envelope]"
D1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  D1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    D1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for required in "VSPEC_CONFIG_PATH" "runCli([" "--format=agent" "format_version"; do
    if ! grep -F -- "$required" "$HONEST_TEST" >/dev/null 2>&1; then
      D1_OFFENDERS+=("$HONEST_TEST missing $required")
    fi
  done
  for site in "${CORE_AGENT_SITES[@]}"; do
    IFS='|' read -r verb _file _fn <<<"$site"
    topic=${verb%% *}
    action=${verb#* }
    if ! grep -F -- "agent $verb" "$HONEST_TEST" >/dev/null 2>&1; then
      D1_OFFENDERS+=("$verb missing honest test title")
    fi
    if ! grep -F -- "\"$topic\"" "$HONEST_TEST" >/dev/null 2>&1 ||
       ! grep -F -- "\"$action\"" "$HONEST_TEST" >/dev/null 2>&1; then
      D1_OFFENDERS+=("$verb missing runCli tokens")
    fi
  done
fi
if [ "${#D1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest E2E proof gaps:"
  printf '        %s\n' "${D1_OFFENDERS[@]}"
  PASS=false
fi

echo "[10.E1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/10-agent-write-path.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/10-agent-write-path.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
