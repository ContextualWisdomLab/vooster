#!/usr/bin/env bash
# goals/13-lock-agent-format.gates.sh — Gate suite for goal 13.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="13-lock-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/lock.ts
  apps/cli/src/index.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/13-lock-agent-format.gates.sh
  goals/13-lock-agent-format.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
CLI_INDEX=apps/cli/src/index.ts
LOCK_CMD=apps/cli/src/commands/lock.ts
UNIT_TEST=apps/cli/tests/unit/lock-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/lock-agent-format.test.ts

agent_debt_bullets() {
  awk '
    /^## `--format=agent` coverage debt/ { capture=1; next }
    capture && /^## / { capture=0 }
    capture && /^-/ { print }
  ' "$FINDINGS"
}

extract_function() {
  local file="$1"
  local fn="$2"
  awk -v fn="$fn" '
    $0 ~ "^(export async )?function " fn "\\(" { capture=1 }
    capture && $0 ~ "^(export async |async )?function " && $0 !~ "^(export async )?function " fn "\\(" { exit }
    capture { print }
  ' "$file"
}

echo "[13.A1 lock findings narrowed]"
A1_LINES=$(agent_debt_bullets)
if printf '%s\n' "$A1_LINES" | grep -F "lock (acquire/release/renew)" >/dev/null 2>&1; then
  echo "    ✗ fail — old broad lock debt remains"
  PASS=false
elif ! printf '%s\n' "$A1_LINES" | grep -F '`lock release`' >/dev/null 2>&1; then
  echo "    ✗ fail — remaining lock release/renew debt is missing"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[13.B1 docs/07-cli-spec.md documents lock agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format for Locks" \
  "vspec lock <KEY-NNN> --format=agent" \
  "held_by_session_id" \
  "context.session_id" \
  "caller's --session"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing lock agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[13.C1 lock.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$LOCK_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $LOCK_CMD is not in grep -rl 'format === \"agent\"' set"
  PASS=false
fi

echo "[13.C2 runLock builds an agent envelope]"
C2_BLOCK=$(extract_function "$LOCK_CMD" "runLock")
LOCK_OUTPUT_BLOCK=$(extract_function "$LOCK_CMD" "writeLockOutput")
if [ -n "$C2_BLOCK" ] &&
   printf '%s\n' "$C2_BLOCK" | grep -F "writeLockOutput" >/dev/null 2>&1 &&
   printf '%s\n' "$LOCK_OUTPUT_BLOCK" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
   printf '%s\n' "$LOCK_OUTPUT_BLOCK" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — runLock must route to a lock renderer with an agent envelope"
  PASS=false
fi

echo "[13.C3 dispatcher keeps lock scope to acquire]"
if ! grep -F 'parsed.args.command === "lock" && this.argv[1] !== "renew"' "$CLI_INDEX" >/dev/null 2>&1; then
  echo "    ✗ fail — lock dispatch no longer excludes renew"
  PASS=false
elif grep -F 'parsed.args.command === "unlock"' "$CLI_INDEX" >/dev/null 2>&1; then
  echo "    ✗ fail — unlock dispatch is out of scope for Goal 13"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[13.D1 unit tests prove lock acquire agent envelope]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent lock acquire" \
    "human lock acquire" \
    "--format=agent" \
    "format_version" \
    "data.lock.id" \
    "data.lock.lock_type" \
    "data.lock.target_id" \
    "data.lock.held_by_session_id" \
    "context.session_id" \
    "suggested_next_actions"; do
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

echo "[13.E1 honest E2E proves lock acquire agent envelope]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent lock acquire" \
    "runCli([" \
    '"lock"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.lock.id" \
    "data.lock.lock_type" \
    "data.lock.target_id" \
    "data.lock.held_by_session_id" \
    "context.session_id"; do
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

echo "[13.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — lock agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'lock-agent|Goal 13' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 13"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[13.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/13-lock-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/13-lock-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
