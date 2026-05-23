#!/usr/bin/env bash
# goals/28-lock-renew-agent-format.gates.sh — Gate suite for goal 28.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="28-lock-renew-agent-format"

GATE_INPUTS=(
  apps/api/src/http/lock-results.ts
  apps/cli/src/commands/lock.ts
  apps/cli/src/index.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals
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
LOCK_CMD=apps/cli/src/commands/lock.ts
CLI_INDEX=apps/cli/src/index.ts
LOCK_RESULTS=apps/api/src/http/lock-results.ts
UNIT_TEST=apps/cli/tests/unit/lock-renew-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/lock-renew-agent-format.test.ts
OLD_LOCK_BULLET='`lock release` / `lock renew`'
LOCK_RELEASE_BULLET='`lock release`'
MERGE_SETUP_BULLET='`merge resolve public conflict setup`'

extract_function() {
  local file="$1"
  local fn="$2"
  awk -v fn="$fn" '
    $0 ~ "^(export )?(async )?function " fn "\\(" { capture=1 }
    capture && $0 ~ "^(export )?(async )?function " && $0 !~ "^(export )?(async )?function " fn "\\(" { exit }
    capture { print }
  ' "$file"
}

echo "[28.A1 lock renew findings removed]"
if grep -F "$OLD_LOCK_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — combined lock release/renew debt remains"
  PASS=false
elif ! grep -F "$LOCK_RELEASE_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — lock release debt was removed"
  PASS=false
elif ! grep -F "$MERGE_SETUP_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — merge resolve public setup debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[28.A2 prior lock sentinels retargeted]"
A2_OFFENDERS=()
while IFS= read -r file; do
  case "$file" in
    goals/28-lock-renew-agent-format.gates.sh|goals/28-lock-renew-agent-format.next-task.sh)
      continue
      ;;
  esac
  A2_OFFENDERS+=("$file still contains old lock release/renew sentinel")
done < <(grep -lF "$OLD_LOCK_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[28.B1 docs/07-cli-spec.md documents lock renew agent format]"
B1_OFFENDERS=()
for token in \
  "vspec lock renew <lock-id> [--ttl <minutes>]" \
  "### Agent Format - Lock Renew" \
  "vspec lock renew <lock-id> --format=agent" \
  "data.lock.id" \
  "data.lock.expires_at" \
  "context.session_id" \
  "current API renew response does not populate suggested_next_actions" \
  "top-level suggested_next_actions is therefore an empty array" \
  "warnings"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing lock renew spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[28.C1 acquire guidance uses lock id]"
if grep -F 'vspec lock renew ${result.lock.id ??' "$LOCK_RESULTS" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — acquire guidance does not use lock id"
  PASS=false
fi

echo "[28.C2 lock renew is routed while acquire guard remains]"
if grep -F 'parsed.args.command === "lock" && this.argv[1] === "renew"' "$CLI_INDEX" >/dev/null 2>&1 &&
   grep -F 'parsed.args.command === "lock" && this.argv[1] !== "renew"' "$CLI_INDEX" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — lock renew route or acquire guard missing"
  PASS=false
fi

echo "[28.C3 runLock supports renew]"
RUN_LOCK_BLOCK=$(extract_function "$LOCK_CMD" "runLock")
if [ -n "$RUN_LOCK_BLOCK" ] &&
   printf '%s\n' "$RUN_LOCK_BLOCK" | grep -F 'action: "acquire" | "renew"' >/dev/null 2>&1 &&
   grep -F "/v1/locks/\${renewFlags.lockId}/renew" "$LOCK_CMD" >/dev/null 2>&1 &&
   grep -F "ttl_minutes: renewFlags.ttlMinutes" "$LOCK_CMD" >/dev/null 2>&1 &&
   grep -F "X-Vspec-Session" "$LOCK_CMD" >/dev/null 2>&1 &&
   grep -F "suggested_next_actions ?? []" "$LOCK_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — runLock renew support incomplete"
  PASS=false
fi

echo "[28.C4 lock renew builds an agent envelope]"
if grep -F 'format === "agent"' "$LOCK_CMD" >/dev/null 2>&1 &&
   grep -F "buildAgentEnvelope" "$LOCK_CMD" >/dev/null 2>&1 &&
   grep -F "data: body" "$LOCK_CMD" >/dev/null 2>&1 &&
   grep -F "context: { session_id:" "$LOCK_CMD" >/dev/null 2>&1 &&
   grep -F "suggested_next_actions: suggestedNextActions" "$LOCK_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — lock renew agent envelope missing"
  PASS=false
fi

echo "[28.D1 unit tests prove lock renew]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent lock renew" \
    "agent lock renew without session" \
    "human lock renew" \
    "--format=agent" \
    "JSON.parse(stdout)" \
    "format_version" \
    "data.lock.id" \
    "data.lock.lock_type" \
    "data.lock.target_id" \
    "data.lock.expires_at" \
    "data.lock.held_by_session_id" \
    "context.session_id" \
    "suggested_next_actions" \
    "warnings" \
    "/v1/locks/" \
    "/renew" \
    "ttl_minutes" \
    "X-Vspec-Session"; do
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

echo "[28.E1 honest E2E proves lock renew]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent lock renew" \
    "seedViaCli" \
    "runCli(" \
    '"lock"' \
    '"renew"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.lock.id" \
    "data.lock.expires_at" \
    "context.session_id" \
    "suggested_next_actions"; do
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

echo "[28.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — lock renew proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'lock-renew|Goal 28' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 28"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[28.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/28-lock-renew-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/28-lock-renew-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
