#!/usr/bin/env bash
# goals/23-member-api-key-agent-format.gates.sh — Gate suite for goal 23.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="23-member-api-key-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/member.ts
  apps/cli/src/commands/api-key.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings-cli-spec-gaps.md
  goals
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
MEMBER_CMD=apps/cli/src/commands/member.ts
API_KEY_CMD=apps/cli/src/commands/api-key.ts
UNIT_TEST=apps/cli/tests/unit/member-api-key-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/member-api-key-agent-format.test.ts
OLD_MEMBER_BULLET='`member invite`, `api-key create|list|revoke`'
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
      printf '%s\n' "$block" | grep -E "agent(Member|ApiKey|Envelope|Response)" >/dev/null 2>&1
    )
}

echo "[23.A1 member/API-key findings removed]"
if grep -F "$OLD_MEMBER_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — member/API-key agent debt remains"
  PASS=false
elif ! grep -F "$SYNC_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[23.A2 prior sentinels retargeted]"
A2_OFFENDERS=()
while IFS= read -r file; do
  case "$file" in
    goals/23-member-api-key-agent-format.gates.sh|goals/23-member-api-key-agent-format.next-task.sh)
      continue
      ;;
  esac
  A2_OFFENDERS+=("$file still contains old member/API-key sentinel")
done < <(grep -lF "$OLD_MEMBER_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
while IFS= read -r file; do
  if grep -F "unrelated member/api-key debt" "$file" >/dev/null 2>&1 &&
     ! grep -F "$SYNC_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file has member/API-key wording without sync sentinel")
  fi
done < <(find goals -maxdepth 1 \( -name '*.gates.sh' -o -name '*.next-task.sh' \) -print)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[23.B1 docs/07-cli-spec.md documents member/API-key agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format — API Keys" \
  "### Agent Format — Membership" \
  "vspec api-key create --name \"<text>\" --scopes read,write --format=agent" \
  "vspec api-key list --format=agent" \
  "vspec api-key revoke <id> --format=agent" \
  "vspec member invite --email <email> --role editor --format=agent" \
  "default null" \
  "data.api_key.id" \
  "data.plaintext_token" \
  "data.api_keys" \
  "plaintext_token field" \
  "data.invitation.email" \
  "suggested_next_actions"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing member/API-key agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[23.C1 command files discovered by Goal 7 agent-branch source]"
C1_OFFENDERS=()
DISCOVERED=$(grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null)
for file in "$MEMBER_CMD" "$API_KEY_CMD"; do
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

echo "[23.C2 targeted handlers build an agent envelope]"
C2_OFFENDERS=()
for spec in "$MEMBER_CMD:inviteMember" "$API_KEY_CMD:createApiKey" "$API_KEY_CMD:listApiKeys" "$API_KEY_CMD:revokeApiKey"; do
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

echo "[23.C3 write handlers preserve guidance]"
C3_OFFENDERS=()
for spec in "$MEMBER_CMD:inviteMember" "$API_KEY_CMD:createApiKey" "$API_KEY_CMD:revokeApiKey"; do
  file="${spec%%:*}"
  fn="${spec##*:}"
  block=$(extract_function "$file" "$fn")
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

echo "[23.C4 api-key list keeps default guidance]"
LIST_BLOCK=$(extract_function "$API_KEY_CMD" "listApiKeys")
if printf '%s\n' "$LIST_BLOCK" | grep -F "buildAgentEnvelope({ data: body })" >/dev/null 2>&1 &&
   ! printf '%s\n' "$LIST_BLOCK" | grep -F "suggested_next_actions:" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — listApiKeys should use default empty suggested_next_actions"
  PASS=false
fi

echo "[23.C5 commands expose format flag]"
if grep -F "format: Flags.string()" "$MEMBER_CMD" >/dev/null 2>&1 &&
   grep -F "format: Flags.string()" "$API_KEY_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — MemberCommand or ApiKeyCommand flags missing format"
  PASS=false
fi

echo "[23.D1 unit tests prove member/API-key agent envelopes]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent member invite" \
    "agent api-key create" \
    "agent api-key list" \
    "agent api-key revoke" \
    "human member and api-key output" \
    "--format=agent" \
    "format_version" \
    "data.invitation.email" \
    "data.api_key.id" \
    "data.plaintext_token" \
    "data.api_keys" \
    "not.toHaveProperty(\"plaintext_token\")" \
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

echo "[23.E1 honest E2E proves member/API-key agent lifecycle]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent member and api-key admin lifecycle" \
    "runCli([" \
    '"member"' \
    '"invite"' \
    '"api-key"' \
    '"create"' \
    '"list"' \
    '"revoke"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.invitation.email" \
    "data.api_key.id" \
    "data.api_keys" \
    "not.toHaveProperty(\"plaintext_token\")" \
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

echo "[23.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — member/API-key agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'member-api-key-agent|Goal 23' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 23"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[23.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/23-member-api-key-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/23-member-api-key-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
