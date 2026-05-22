#!/usr/bin/env bash
# goals/24-local-context-agent-format.gates.sh — Gate suite for goal 24.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="24-local-context-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/status.ts
  apps/cli/src/commands/workspace.ts
  apps/cli/src/commands/project.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/24-local-context-agent-format.gates.sh
  goals/24-local-context-agent-format.md
  goals/24-local-context-agent-format.next-task.sh
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
STATUS_CMD=apps/cli/src/commands/status.ts
WORKSPACE_CMD=apps/cli/src/commands/workspace.ts
PROJECT_CMD=apps/cli/src/commands/project.ts
UNIT_TEST=apps/cli/tests/unit/local-context-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/local-context-agent-format.test.ts
OLD_PROJECT_BULLET='`project cre''ate` / `project switch`'
NEW_PROJECT_BULLET='`lock release`'
WORKSPACE_BULLET='`workspace switch`'
STATUS_BULLET='`status`'
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
  printf '%s\n' "$block" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
    (
      printf '%s\n' "$block" | grep -F "buildAgentEnvelope" >/dev/null 2>&1 ||
      printf '%s\n' "$block" | grep -E "agent(Local|Status|Workspace|Project|Envelope)" >/dev/null 2>&1
    )
}

echo "[24.A1 local-context findings narrowed]"
A1_OFFENDERS=()
if grep -F "$OLD_PROJECT_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  A1_OFFENDERS+=("project switch still grouped with project create")
fi
if ! grep -F "$NEW_PROJECT_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  A1_OFFENDERS+=("pull/push/sync sentinel was removed")
fi
if grep -F "$WORKSPACE_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  A1_OFFENDERS+=("workspace switch debt remains")
fi
if grep -F "$STATUS_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  A1_OFFENDERS+=("status debt remains")
fi
if ! grep -F "$SYNC_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  A1_OFFENDERS+=("pull/push/sync sentinel was removed")
fi
if [ "${#A1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — findings gaps:"
  printf '        %s\n' "${A1_OFFENDERS[@]}"
  PASS=false
fi

echo "[24.B1 docs/07-cli-spec.md documents local context agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format — Local Context" \
  "vspec status --format=agent" \
  "vspec workspace switch <slug> --format=agent" \
  "vspec project switch <key> --format=agent" \
  "default null" \
  "data.config.current_project_key" \
  "data.workspace.slug" \
  "data.config.current_workspace_slug" \
  "data.project.key"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing local-context agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[24.C1 command files discovered by Goal 7 agent-branch source]"
C1_OFFENDERS=()
DISCOVERED=$(grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null)
for file in "$STATUS_CMD" "$WORKSPACE_CMD" "$PROJECT_CMD"; do
  if ! printf '%s\n' "$DISCOVERED" | grep -Fx "$file" >/dev/null 2>&1; then
    C1_OFFENDERS+=("$file")
  fi
done
if [ "${#C1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — command files missing from grep -rl 'format === \"agent\"' set:"
  printf '        %s\n' "${C1_OFFENDERS[@]}"
  PASS=false
fi

echo "[24.C2 targeted handlers build an agent envelope]"
C2_OFFENDERS=()
for spec in "$STATUS_CMD:runStatus" "$WORKSPACE_CMD:runWorkspace" "$PROJECT_CMD:switchProject"; do
  file="${spec%%:*}"
  fn="${spec##*:}"
  block=$(extract_function "$file" "$fn")
  if [ -z "$block" ] || ! handler_calls_helper_or_envelope "$block"; then
    C2_OFFENDERS+=("$fn")
  fi
done
if [ "${#C2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — handlers missing agent envelope:"
  printf '        %s\n' "${C2_OFFENDERS[@]}"
  PASS=false
fi

echo "[24.C3 switch handlers mutate config before agent output]"
C3_OFFENDERS=()
for spec in "$WORKSPACE_CMD:runWorkspace" "$PROJECT_CMD:switchProject"; do
  file="${spec%%:*}"
  fn="${spec##*:}"
  block=$(extract_function "$file" "$fn")
  if ! printf '%s\n' "$block" | awk '
    /writeConfig/ { wrote=1 }
    /format === "agent"/ && !wrote { bad=1 }
    END { exit bad ? 1 : 0 }
  '; then
    C3_OFFENDERS+=("$fn")
  fi
done
if [ "${#C3_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — switch handlers can emit agent output before config mutation:"
  printf '        %s\n' "${C3_OFFENDERS[@]}"
  PASS=false
fi

echo "[24.C4 local commands expose format flag]"
if grep -F "format: Flags.string()" "$STATUS_CMD" >/dev/null 2>&1 &&
   grep -F "format: Flags.string()" "$WORKSPACE_CMD" >/dev/null 2>&1 &&
   grep -F "format: Flags.string()" "$PROJECT_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — StatusCommand, WorkspaceCommand, or ProjectCommand flags missing format"
  PASS=false
fi

echo "[24.D1 unit tests prove local-context agent envelopes]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent status" \
    "agent workspace switch" \
    "agent project switch" \
    "human local context output" \
    "VSPEC_CONFIG_PATH" \
    "--format=agent" \
    "format_version" \
    "data.config.current_project_key" \
    "data.workspace.slug" \
    "data.config.current_workspace_slug" \
    "data.project.key" \
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

echo "[24.E1 honest E2E proves local-context agent lifecycle]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent local context lifecycle" \
    "runCli([" \
    '"status"' \
    '"workspace"' \
    '"switch"' \
    '"project"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.config.current_project_key" \
    "current_workspace_id" \
    "current_workspace_slug" \
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

echo "[24.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — local-context agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'local-context-agent|Goal 24' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 24"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[24.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/24-local-context-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/24-local-context-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
