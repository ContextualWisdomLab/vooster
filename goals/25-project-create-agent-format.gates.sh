#!/usr/bin/env bash
# goals/25-project-create-agent-format.gates.sh — Gate suite for goal 25.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="25-project-create-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/project.ts
  apps/cli/src/commands/status.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/24-local-context-agent-format.gates.sh
  goals/24-local-context-agent-format.next-task.sh
  goals/25-project-create-agent-format.gates.sh
  goals/25-project-create-agent-format.md
  goals/25-project-create-agent-format.next-task.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
PROJECT_CMD=apps/cli/src/commands/project.ts
UNIT_TEST=apps/cli/tests/unit/project-create-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/project-create-agent-format.test.ts
PROJECT_BULLET='`project create`'
SYNC_BULLET='`lock release`'

extract_function() {
  local file="$1"
  local fn="$2"
  awk -v fn="$fn" '
    $0 ~ "^(export )?(async )?function " fn "\\(" { capture=1 }
    capture && $0 ~ "^(export )?(async )?function " && $0 !~ "^(export )?(async )?function " fn "\\(" { exit }
    capture { print }
  ' "$file"
}

handler_calls_helper_or_envelope() {
  local block="$1"
  (
    printf '%s\n' "$block" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
      (
        printf '%s\n' "$block" | grep -F "buildAgentEnvelope" >/dev/null 2>&1 ||
        printf '%s\n' "$block" | grep -E "agent(Project|Envelope)" >/dev/null 2>&1
      )
  ) || (
    printf '%s\n' "$block" | grep -F "runMutationCommand" >/dev/null 2>&1 &&
      printf '%s\n' "$block" | grep -F "format: flags.format" >/dev/null 2>&1
  )
}

echo "[25.A1 project-create findings removed]"
if grep -F "$PROJECT_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — project-create agent debt remains"
  PASS=false
elif ! grep -F "$SYNC_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[25.A2 Goal 24 sentinel retargeted]"
A2_OFFENDERS=()
for file in goals/24-local-context-agent-format.gates.sh \
  goals/24-local-context-agent-format.next-task.sh; do
  if grep -F "$PROJECT_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file still checks project-create sentinel")
  fi
  if ! grep -F "$SYNC_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file missing pull/push/sync sentinel")
  fi
done
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — Goal 24 sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[25.B1 docs/07-cli-spec.md documents project create agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format — Project Create" \
  "vspec project create --name <n> --key <k> --format=agent" \
  "default null" \
  "updates the local active project config" \
  "data.project.id" \
  "data.project.key" \
  "data.default_branch.name" \
  "data.recommended_next_command" \
  "recommended_next_command" \
  "suggested_next_actions"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing project-create agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[25.C1 project.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$PROJECT_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $PROJECT_CMD is not in grep -rl 'format === \"agent\"' set"
  PASS=false
fi

echo "[25.C2 createProject builds an agent envelope]"
CREATE_BLOCK=$(extract_function "$PROJECT_CMD" "createProject")
if [ -n "$CREATE_BLOCK" ] && handler_calls_helper_or_envelope "$CREATE_BLOCK"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — createProject missing agent envelope"
  PASS=false
fi

echo "[25.C3 project create does not synthesize suggested_next_actions]"
if printf '%s\n' "$CREATE_BLOCK" | grep -F "recommended_next_command" >/dev/null 2>&1 &&
   ! printf '%s\n' "$CREATE_BLOCK" | grep -F "suggested_next_actions:" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — createProject should keep recommended_next_command as data"
  PASS=false
fi

echo "[25.D1 unit tests prove project create agent envelope]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent project create" \
    "human project create output" \
    "VSPEC_CONFIG_PATH" \
    "--format=agent" \
    "format_version" \
    "data.project.id" \
    "data.project.key" \
    "data.default_branch.name" \
    "data.recommended_next_command" \
    "readConfig().current_project_id" \
    "readConfig().current_project_key" \
    "context).toEqual" \
    "project_key: null" \
    "branch: null" \
    "session_id: null" \
    "revision: null" \
    "suggested_next_actions" \
    "warnings" \
    "JSON.parse(stdout)"; do
    if ! grep -F -- "$token" "$UNIT_TEST" >/dev/null 2>&1; then
      D1_OFFENDERS+=("$UNIT_TEST missing $token")
    fi
  done
fi
if [ "${#D1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — unit proof gaps:"
  printf '        %s\n' "${D1_OFFENDERS[@]}"
  PASS=false
fi

echo "[25.E1 honest E2E proves project create agent envelope]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent project create updates active project" \
    "runCli(" \
    '"project"' \
    '"create"' \
    '"status"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.project.id" \
    "data.project.key" \
    "data.default_branch.name" \
    "data.recommended_next_command" \
    "data.config.current_project_key" \
    "context).toEqual" \
    "project_key: null" \
    "branch: null" \
    "session_id: null" \
    "revision: null"; do
    if ! grep -F -- "$token" "$HONEST_TEST" >/dev/null 2>&1; then
      E1_OFFENDERS+=("$HONEST_TEST missing $token")
    fi
  done
fi
if [ "${#E1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest E2E proof gaps:"
  printf '        %s\n' "${E1_OFFENDERS[@]}"
  PASS=false
fi

echo "[25.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — project-create agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'project-create-agent|Goal 25' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 25"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[25.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/25-project-create-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/25-project-create-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
