#!/usr/bin/env bash
# goals/22-comment-agent-format.gates.sh — Gate suite for goal 22.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="22-comment-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/comment.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  goals/18-history-agent-format.gates.sh
  goals/18-history-agent-format.next-task.sh
  goals/19-impact-agent-format.gates.sh
  goals/19-impact-agent-format.next-task.sh
  goals/20-who-agent-format.gates.sh
  goals/20-who-agent-format.next-task.sh
  goals/21-revert-agent-format.gates.sh
  goals/21-revert-agent-format.next-task.sh
  scripts/check-gate-rigor.sh
  goals/22-comment-agent-format.gates.sh
  goals/22-comment-agent-format.md
  goals/22-comment-agent-format.next-task.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
COMMENT_CMD=apps/cli/src/commands/comment.ts
UNIT_TEST=apps/cli/tests/unit/comment-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/comment-agent-format.test.ts
OLD_COMMENT_BULLET='`comment add|list|edit|resolve|delete`'
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

handler_calls_helper_or_envelope() {
  local block="$1"
  printf '%s\n' "$block" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
    (
      printf '%s\n' "$block" | grep -F "buildAgentEnvelope" >/dev/null 2>&1 ||
      printf '%s\n' "$block" | grep -E "agent(Comment|List|Response|Envelope)" >/dev/null 2>&1
    )
}

echo "[22.A1 comment findings removed]"
if grep -F "$OLD_COMMENT_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — comment agent debt remains"
  PASS=false
elif ! grep -F "$MEMBER_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[22.A2 prior sentinels retargeted]"
A2_OFFENDERS=()
for file in goals/18-history-agent-format.gates.sh \
  goals/18-history-agent-format.next-task.sh \
  goals/19-impact-agent-format.gates.sh \
  goals/19-impact-agent-format.next-task.sh \
  goals/20-who-agent-format.gates.sh \
  goals/20-who-agent-format.next-task.sh \
  goals/21-revert-agent-format.gates.sh \
  goals/21-revert-agent-format.next-task.sh; do
  if grep -F "$OLD_COMMENT_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file still checks old comment sentinel")
  fi
  if ! grep -F "$MEMBER_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file missing pull/push/sync sentinel")
  fi
done
while IFS= read -r file; do
  case "$file" in
    goals/22-comment-agent-format.gates.sh|goals/22-comment-agent-format.next-task.sh)
      continue
      ;;
  esac
  A2_OFFENDERS+=("$file still contains old comment sentinel")
done < <(grep -lF "$OLD_COMMENT_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[22.B1 docs/07-cli-spec.md documents comment agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format — Comments" \
  "vspec comment add <KEY-NNN> --body \"<text>\" --format=agent" \
  "vspec comment list <KEY-NNN> --format=agent" \
  "vspec comment edit <comment-id> --body \"<text>\" --format=agent" \
  "vspec comment resolve <comment-id> --format=agent" \
  "vspec comment delete <comment-id> --format=agent" \
  "default null" \
  "data.comment.id" \
  "data.comments" \
  "suggested_next_actions"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing comment agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[22.C1 comment.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$COMMENT_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $COMMENT_CMD is not in grep -rl 'format === \"agent\"' set"
  PASS=false
fi

echo "[22.C2 all comment handlers build an agent envelope]"
C2_OFFENDERS=()
for fn in addComment listComments editComment resolveComment deleteComment; do
  block=$(extract_function "$COMMENT_CMD" "$fn")
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

echo "[22.C3 comment write handlers preserve guidance]"
C3_OFFENDERS=()
for fn in addComment editComment resolveComment deleteComment; do
  block=$(extract_function "$COMMENT_CMD" "$fn")
  if ! printf '%s\n' "$block" | grep -F "suggested_next_actions: body.suggested_next_actions" >/dev/null 2>&1; then
    C3_OFFENDERS+=("$fn")
  fi
done
if [ "${#C3_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — write handlers missing suggested_next_actions mapping:"
  printf '        %s\n' "${C3_OFFENDERS[@]}"
  PASS=false
fi

echo "[22.C4 comment list keeps default guidance]"
LIST_BLOCK=$(extract_function "$COMMENT_CMD" "listComments")
if printf '%s\n' "$LIST_BLOCK" | grep -F "buildAgentEnvelope({ data: body })" >/dev/null 2>&1 &&
   ! printf '%s\n' "$LIST_BLOCK" | grep -F "suggested_next_actions:" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — listComments should use default empty suggested_next_actions"
  PASS=false
fi

echo "[22.C5 delete returns before human-only Deleted true]"
DELETE_BLOCK=$(extract_function "$COMMENT_CMD" "deleteComment")
if printf '%s\n' "$DELETE_BLOCK" | awk '
  /format === "agent"/ { in_agent=1 }
  in_agent && /return;/ { returned=1 }
  /Deleted true/ && !returned { bad=1 }
  END { exit bad ? 1 : 0 }
'; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — deleteComment can print Deleted true in agent mode"
  PASS=false
fi

echo "[22.C6 comment exposes format flag]"
if grep -F "format: Flags.string()" "$COMMENT_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — CommentCommand.flags missing format"
  PASS=false
fi

echo "[22.D1 unit tests prove comment agent envelopes]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent comment add" \
    "agent comment list" \
    "agent comment edit" \
    "agent comment resolve" \
    "agent comment delete" \
    "human comment lifecycle" \
    "--format=agent" \
    "format_version" \
    "data.comment.id" \
    "data.comments" \
    "context).toEqual" \
    "project_key: null" \
    "branch: null" \
    "session_id: null" \
    "revision: null" \
    "suggested_next_actions" \
    "warnings" \
    "JSON.parse(stdout)" \
    "not.toContain(\"Comment \")" \
    "not.toContain(\"Target \")" \
    "not.toContain(\"Author \")" \
    "not.toContain(\"Resolved \")" \
    "not.toContain(\"Resolved at \")" \
    "not.toContain(\"Updated at \")" \
    "not.toContain(\"Body \")" \
    "not.toContain(\"Comments \")" \
    "not.toContain(\"Deleted true\")"; do
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

echo "[22.E1 honest E2E proves comment agent lifecycle]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent comment lifecycle" \
    "runCli([" \
    '"comment"' \
    '"add"' \
    '"list"' \
    '"edit"' \
    '"resolve"' \
    '"delete"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.comment.id" \
    "data.comments" \
    "context).toEqual" \
    "project_key: null" \
    "branch: null" \
    "session_id: null" \
    "revision: null" \
    "resolved).toBe(true)" \
    "not.toContain(\"Deleted true\")"; do
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

echo "[22.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — comment agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'comment-agent|Goal 22' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 22"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[22.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/22-comment-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/22-comment-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
