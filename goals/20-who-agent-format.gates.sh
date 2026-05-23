#!/usr/bin/env bash
# goals/20-who-agent-format.gates.sh — Gate suite for goal 20.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="20-who-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/who.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  goals/18-history-agent-format.gates.sh
  goals/18-history-agent-format.next-task.sh
  goals/19-impact-agent-format.gates.sh
  goals/19-impact-agent-format.next-task.sh
  scripts/check-gate-rigor.sh
  goals/20-who-agent-format.gates.sh
  goals/20-who-agent-format.md
  goals/20-who-agent-format.next-task.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
WHO_CMD=apps/cli/src/commands/who.ts
UNIT_TEST=apps/cli/tests/unit/who-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/who-agent-format.test.ts
OLD_WHO_BULLET='`revert`, `who`, `comment add|list|edit|resolve|''delete`'
NEW_WHO_BULLET='`lock release`'
MEMBER_BULLET='`lock release`'

extract_function() {
  local file="$1"
  local fn="$2"
  awk -v fn="$fn" '
    $0 ~ "^(export )?(async )?function " fn "\\(" { capture=1 }
    capture && $0 ~ "^(export )?(async )?function " && $0 !~ "^(export )?(async )?function " fn "\\(" { exit }
    capture { print }
  ' "$file"
}

echo "[20.A1 who findings narrowed]"
if grep -F "$OLD_WHO_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — old grouped who debt remains"
  PASS=false
elif ! grep -F "$NEW_WHO_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — narrowed revert/comment debt is missing"
  PASS=false
elif ! grep -F "$MEMBER_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[20.A2 prior sentinels retargeted]"
A2_OFFENDERS=()
for file in goals/18-history-agent-format.gates.sh \
  goals/18-history-agent-format.next-task.sh \
  goals/19-impact-agent-format.gates.sh \
  goals/19-impact-agent-format.next-task.sh; do
  if grep -F "$OLD_WHO_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file still checks old who sentinel")
  fi
  if ! grep -F "$NEW_WHO_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file missing post-who sentinel")
  fi
done
while IFS= read -r file; do
  case "$file" in
    goals/20-who-agent-format.gates.sh|goals/20-who-agent-format.next-task.sh)
      continue
      ;;
  esac
  A2_OFFENDERS+=("$file still contains old who sentinel")
done < <(grep -lF "$OLD_WHO_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[20.B1 docs/07-cli-spec.md documents who agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format — Who" \
  "vspec who <KEY-NNN> --format=agent" \
  "suggested_next_actions" \
  "default null" \
  "data.sessions" \
  "data.locks" \
  "data.merge_requests"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing who agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[20.C1 who.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$WHO_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $WHO_CMD is not in grep -rl 'format === \"agent\"' set"
  PASS=false
fi

echo "[20.C2 runWho builds an agent envelope]"
WHO_BLOCK=$(extract_function "$WHO_CMD" "runWho")
if [ -n "$WHO_BLOCK" ] &&
   printf '%s\n' "$WHO_BLOCK" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
   printf '%s\n' "$WHO_BLOCK" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — runWho does not build an agent envelope"
  PASS=false
fi

echo "[20.C3 who maps guidance and keeps default context]"
C3_OFFENDERS=()
if ! printf '%s\n' "$WHO_BLOCK" | grep -F "suggested_next_actions: body.suggested_next_actions" >/dev/null 2>&1; then
  C3_OFFENDERS+=("suggested_next_actions")
fi
if printf '%s\n' "$WHO_BLOCK" | grep -F "context:" >/dev/null 2>&1; then
  C3_OFFENDERS+=("custom context")
fi
if [ "${#C3_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — who context/guidance mapping gaps:"
  printf '        %s\n' "${C3_OFFENDERS[@]}"
  PASS=false
fi

echo "[20.C4 who exposes format flag]"
if grep -F "format: Flags.string()" "$WHO_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — WhoCommand.flags missing format"
  PASS=false
fi

echo "[20.D1 unit tests prove who agent envelope]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent who with active work" \
    "agent who without active work" \
    "human who" \
    "--format=agent" \
    "format_version" \
    "data.usecase.key" \
    "data.sessions" \
    "data.locks" \
    "data.merge_requests" \
    "context).toEqual" \
    "project_key: null" \
    "branch: null" \
    "session_id: null" \
    "revision: null" \
    "suggested_next_actions" \
    "warnings" \
    "vspec lock list" \
    "vspec session start --intent" \
    "JSON.parse(stdout)" \
    "not.toContain(\"UseCase \")" \
    "not.toContain(\"Sessions \")" \
    "not.toContain(\"Session \")" \
    "not.toContain(\"Agent \")" \
    "not.toContain(\"Intent \")" \
    "not.toContain(\"Locks \")" \
    "not.toContain(\"Lock \")" \
    "not.toContain(\"Type \")" \
    "not.toContain(\"Holder \")" \
    "not.toContain(\"Expires at \")" \
    "not.toContain(\"Merge requests \")" \
    "not.toContain(\"Merge request \")" \
    "not.toContain(\"Source branch \")" \
    "not.toContain(\"Status \")" \
    "not.toContain(\"Conflicts \")"; do
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

echo "[20.E1 honest E2E proves who agent envelope]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent who" \
    "runCli(" \
    '"who"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.usecase.key" \
    "data.sessions" \
    "data.locks" \
    "data.merge_requests" \
    "context).toEqual" \
    "project_key: null" \
    "branch: null" \
    "session_id: null" \
    "revision: null" \
    "suggested_next_actions" \
    "vspec session start"; do
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

echo "[20.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — who agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'who-agent|Goal 20' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 20"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[20.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/20-who-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/20-who-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
