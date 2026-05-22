#!/usr/bin/env bash
# goals/21-revert-agent-format.gates.sh — Gate suite for goal 21.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="21-revert-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/revert.ts
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
  scripts/check-gate-rigor.sh
  goals/21-revert-agent-format.gates.sh
  goals/21-revert-agent-format.md
  goals/21-revert-agent-format.next-task.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
REVERT_CMD=apps/cli/src/commands/revert.ts
UNIT_TEST=apps/cli/tests/unit/revert-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/revert-agent-format.test.ts
OLD_REVERT_BULLET='`revert`, `comment add|list|edit|resolve|''delete`'
NEW_REVERT_BULLET='`lock release`'
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

echo "[21.A1 revert findings narrowed]"
if grep -F "$OLD_REVERT_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — old grouped revert debt remains"
  PASS=false
elif ! grep -F "$NEW_REVERT_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — narrowed comment debt is missing"
  PASS=false
elif ! grep -F "$MEMBER_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[21.A2 prior sentinels retargeted]"
A2_OFFENDERS=()
for file in goals/18-history-agent-format.gates.sh \
  goals/18-history-agent-format.next-task.sh \
  goals/19-impact-agent-format.gates.sh \
  goals/19-impact-agent-format.next-task.sh \
  goals/20-who-agent-format.gates.sh \
  goals/20-who-agent-format.next-task.sh; do
  if grep -F "$OLD_REVERT_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file still checks old revert sentinel")
  fi
  if ! grep -F "$NEW_REVERT_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file missing post-revert sentinel")
  fi
done
while IFS= read -r file; do
  case "$file" in
    goals/21-revert-agent-format.gates.sh|goals/21-revert-agent-format.next-task.sh)
      continue
      ;;
  esac
  A2_OFFENDERS+=("$file still contains old revert sentinel")
done < <(grep -lF "$OLD_REVERT_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[21.B1 docs/07-cli-spec.md documents revert agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format — Revert" \
  "vspec revert <KEY-NNN> --to <revision-id> --format=agent" \
  "suggested_next_actions" \
  "warnings" \
  "context.revision" \
  "data.revision.id" \
  "data.usecase.current_revision_id"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing revert agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[21.C1 revert.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$REVERT_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $REVERT_CMD is not in grep -rl 'format === \"agent\"' set"
  PASS=false
fi

echo "[21.C2 runRevert builds an agent envelope]"
REVERT_BLOCK=$(extract_function "$REVERT_CMD" "runRevert")
if [ -n "$REVERT_BLOCK" ] &&
   printf '%s\n' "$REVERT_BLOCK" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
   printf '%s\n' "$REVERT_BLOCK" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — runRevert does not build an agent envelope"
  PASS=false
fi

echo "[21.C3 revert maps revision context, guidance, and warnings]"
C3_OFFENDERS=()
if ! printf '%s\n' "$REVERT_BLOCK" | grep -F "suggested_next_actions: body.suggested_next_actions" >/dev/null 2>&1; then
  C3_OFFENDERS+=("suggested_next_actions")
fi
if ! printf '%s\n' "$REVERT_BLOCK" | grep -F "warnings: body.warnings ?? []" >/dev/null 2>&1; then
  C3_OFFENDERS+=("warnings")
fi
if ! printf '%s\n' "$REVERT_BLOCK" | grep -F "revision: body.revision.id" >/dev/null 2>&1; then
  C3_OFFENDERS+=("context.revision")
fi
if [ "${#C3_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — revert context/guidance/warning mapping gaps:"
  printf '        %s\n' "${C3_OFFENDERS[@]}"
  PASS=false
fi

echo "[21.C4 revert exposes format flag]"
if grep -F "format: Flags.string()" "$REVERT_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — RevertCommand.flags missing format"
  PASS=false
fi

echo "[21.D1 unit tests prove revert agent envelope]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent revert" \
    "human revert" \
    "--format=agent" \
    "format_version" \
    "data.usecase.current_revision_id" \
    "data.revision.id" \
    "context.revision" \
    "warnings" \
    "suggested_next_actions" \
    "vspec history" \
    "JSON.parse(stdout)" \
    "toBe(envelope.data.revision.id)" \
    "toBe(envelope.data.usecase.current_revision_id)" \
    "not.toContain(\"UseCase \")" \
    "not.toContain(\"Title \")" \
    "not.toContain(\"Current revision \")" \
    "not.toContain(\"Revision \")" \
    "not.toContain(\"Parent \")" \
    "not.toContain(\"Change \")" \
    "not.toContain(\"Version \")" \
    "not.toContain(\"Severity \")" \
    "not.toContain(\"Impact \")" \
    "not.toContain(\"Affected sessions \")" \
    "not.toContain(\"Affected branches \")" \
    "not.toContain(\"Warning \")"; do
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

echo "[21.E1 honest E2E proves revert agent envelope]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent revert" \
    "runCli([" \
    '"revert"' \
    "--format=agent" \
    "--to" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.revision.id" \
    "data.usecase.current_revision_id" \
    "context.revision" \
    "addMainStepViaCli" \
    "initialRevision" \
    "not.toBe(initialRevision)" \
    "suggested_next_actions" \
    "vspec history"; do
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

echo "[21.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — revert agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'revert-agent|Goal 21' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 21"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[21.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/21-revert-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/21-revert-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
