#!/usr/bin/env bash
# goals/14-step-agent-format.gates.sh — Gate suite for goal 14.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="14-step-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/step.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/14-step-agent-format.gates.sh
  goals/14-step-agent-format.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
STEP_CMD=apps/cli/src/commands/step.ts
UNIT_TEST=apps/cli/tests/unit/step-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/step-agent-format.test.ts

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

echo "[14.A1 step findings narrowed]"
if grep -F '`step add` / `step edit`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — old step add/edit debt remains"
  PASS=false
elif ! grep -F '`lock release`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
elif ! grep -F 'context.revision is therefore null' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — step edit revision-id asymmetry note missing"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[14.B1 docs/07-cli-spec.md documents step agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format — Steps" \
  "vspec step add <scenario-id> --format=agent" \
  "vspec step edit <id> --format=agent" \
  "context.revision"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing step agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[14.C1 step.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$STEP_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $STEP_CMD is not in grep -rl 'format === \"agent\"' set"
  PASS=false
fi

echo "[14.C2 addStep/editStep build agent envelopes]"
C2_OFFENDERS=()
for fn in addStep editStep; do
  block=$(extract_function "$STEP_CMD" "$fn")
  if [ -z "$block" ] || ! handler_builds_agent_envelope "$block"; then
    C2_OFFENDERS+=("$fn")
  fi
done
if [ "${#C2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing handler-level agent envelopes:"
  printf '        %s\n' "${C2_OFFENDERS[@]}"
  PASS=false
fi

echo "[14.C3 step.ts routes only add/edit actions]"
STEP_ACTIONS=$(grep -oE 'action === "[a-z]+"' "$STEP_CMD" | sed -E 's/.*"([^"]+)"/\1/' | sort | tr '\n' ' ' | sed 's/ $//')
if [ "$STEP_ACTIONS" = "add edit" ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — step actions = '$STEP_ACTIONS' (expected 'add edit')"
  PASS=false
fi

echo "[14.D1 unit tests prove step agent envelopes]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent step add" \
    "agent step edit" \
    "human step add" \
    "human step edit" \
    "--format=agent" \
    "format_version" \
    "data.step.id" \
    "context.revision"; do
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

echo "[14.E1 honest E2E proves step agent envelopes]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent step add" \
    "agent step edit" \
    "runCli([" \
    '"step"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.step.id" \
    "context.revision"; do
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

echo "[14.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — step agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'step-agent|Goal 14' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 14"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[14.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/14-step-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/14-step-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
