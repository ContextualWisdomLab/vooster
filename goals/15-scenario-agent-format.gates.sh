#!/usr/bin/env bash
# goals/15-scenario-agent-format.gates.sh — Gate suite for goal 15.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="15-scenario-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/scenario.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/15-scenario-agent-format.gates.sh
  goals/15-scenario-agent-format.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
SCENARIO_CMD=apps/cli/src/commands/scenario.ts
UNIT_TEST=apps/cli/tests/unit/scenario-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/scenario-agent-format.test.ts

extract_function() {
  local file="$1"
  local fn="$2"
  awk -v fn="$fn" '
    $0 ~ "^(async )?function " fn "\\(" { capture=1 }
    capture && $0 ~ "^(async )?function " && $0 !~ "^(async )?function " fn "\\(" { exit }
    capture { print }
  ' "$file"
}

handler_builds_agent_envelope() {
  local block="$1"
  (
    printf '%s\n' "$block" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
      printf '%s\n' "$block" | grep -F "buildAgentEnvelope" >/dev/null 2>&1
  ) || (
    printf '%s\n' "$block" | grep -F "runMutationCommand" >/dev/null 2>&1 &&
      printf '%s\n' "$block" | grep -F "format: flags.format" >/dev/null 2>&1
  )
}

echo "[15.A1 scenario findings narrowed]"
if grep -F '`scenario add`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — old scenario add debt remains"
  PASS=false
elif ! grep -F '`lock release`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[15.B1 docs/07-cli-spec.md documents scenario agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format — Scenarios" \
  "vspec scenario add <usecase-id> --format=agent" \
  "context.revision" \
  "data.revision.id"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing scenario agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[15.C1 scenario.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"|runMutationCommand' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$SCENARIO_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $SCENARIO_CMD is not in agent-output source set"
  PASS=false
fi

echo "[15.C2 addScenario builds an agent envelope]"
C2_BLOCK=$(extract_function "$SCENARIO_CMD" "addScenario")
if [ -n "$C2_BLOCK" ] && handler_builds_agent_envelope "$C2_BLOCK"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — addScenario does not build an agent envelope"
  PASS=false
fi

echo "[15.C3 scenario.ts routes only add action]"
SCENARIO_ACTIONS=$(grep -oE 'action === "[a-z]+"' "$SCENARIO_CMD" | sed -E 's/.*"([^"]+)"/\1/' | sort | tr '\n' ' ' | sed 's/ $//')
if [ "$SCENARIO_ACTIONS" = "add" ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — scenario actions = '$SCENARIO_ACTIONS' (expected 'add')"
  PASS=false
fi

echo "[15.C4 ScenarioResponse exposes revision.id]"
C4_BLOCK=$(awk '
  /^type ScenarioResponse = / { capture=1 }
  capture && /^};/ { print; exit }
  capture { print }
' "$SCENARIO_CMD")
C4_REVISION_BLOCK=$(printf '%s\n' "$C4_BLOCK" | awk '
  /revision: \{/ { capture=1; next }
  capture && /};/ { exit }
  capture { print }
')
if printf '%s\n' "$C4_REVISION_BLOCK" | grep -F "id: string;" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — ScenarioResponse.revision.id is missing"
  PASS=false
fi

echo "[15.D1 unit tests prove scenario agent envelope]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent scenario add" \
    "human scenario add" \
    "--format=agent" \
    "format_version" \
    "data.scenario.id" \
    "data.revision.id" \
    "not.toContain(\"Scenario \")" \
    "not.toContain(\"Type \")" \
    "not.toContain(\"Outcome \")" \
    "not.toContain(\"Revision \")"; do
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

echo "[15.E1 honest E2E proves scenario agent envelope]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent scenario add" \
    "runCli(" \
    '"scenario"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.scenario.id" \
    "data.revision.id"; do
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

echo "[15.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — scenario agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'scenario-agent|Goal 15' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 15"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[15.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/15-scenario-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/15-scenario-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
