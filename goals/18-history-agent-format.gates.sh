#!/usr/bin/env bash
# goals/18-history-agent-format.gates.sh — Gate suite for goal 18.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="18-history-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/history.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  goals/14-step-agent-format.gates.sh
  goals/15-scenario-agent-format.gates.sh
  goals/16-change-agent-format.gates.sh
  goals/17-merge-open-agent-format.gates.sh
  scripts/check-gate-rigor.sh
  goals/18-history-agent-format.gates.sh
  goals/18-history-agent-format.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
HISTORY_CMD=apps/cli/src/commands/history.ts
UNIT_TEST=apps/cli/tests/unit/history-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/history-agent-format.test.ts
OLD_HISTORY_BULLET='`history`, `impact`, `revert`, `wh''o`, `comment add|list|edit|resolve|''delete`'
NEW_HISTORY_BULLET='`lock release`'
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

echo "[18.A1 history findings narrowed]"
if grep -F "$OLD_HISTORY_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — old grouped history debt remains"
  PASS=false
elif ! grep -F "$NEW_HISTORY_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — narrowed impact/revert/who/comment debt is missing"
  PASS=false
elif ! grep -F "$MEMBER_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[18.A2 prior sentinels retargeted]"
A2_OFFENDERS=()
for gate in \
  goals/14-step-agent-format.gates.sh \
  goals/15-scenario-agent-format.gates.sh \
  goals/16-change-agent-format.gates.sh \
  goals/17-merge-open-agent-format.gates.sh; do
  if grep -F "$OLD_HISTORY_BULLET" "$gate" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$gate still checks old history sentinel")
  fi
  if ! grep -F "$MEMBER_BULLET" "$gate" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$gate missing pull/push/sync sentinel")
  fi
done
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[18.B1 docs/07-cli-spec.md documents history agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format — History" \
  "vspec history <KEY-NNN> --format=agent" \
  "suggested_next_actions" \
  "newest-first" \
  "context.revision" \
  "data.revisions[0].revision"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing history agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[18.C1 history.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$HISTORY_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $HISTORY_CMD is not in grep -rl 'format === \"agent\"' set"
  PASS=false
fi

echo "[18.C2 runHistory builds an agent envelope]"
HISTORY_BLOCK=$(extract_function "$HISTORY_CMD" "runHistory")
if [ -n "$HISTORY_BLOCK" ] &&
   printf '%s\n' "$HISTORY_BLOCK" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
   printf '%s\n' "$HISTORY_BLOCK" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — runHistory does not build an agent envelope"
  PASS=false
fi

echo "[18.C3 history maps revision context and guidance]"
C3_OFFENDERS=()
if ! printf '%s\n' "$HISTORY_BLOCK" | grep -F "suggested_next_actions: body.suggested_next_actions" >/dev/null 2>&1; then
  C3_OFFENDERS+=("suggested_next_actions")
fi
if ! printf '%s\n' "$HISTORY_BLOCK" | grep -F "revision: body.revisions[0]?.revision ?? null" >/dev/null 2>&1; then
  C3_OFFENDERS+=("context.revision")
fi
if [ "${#C3_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing history context/guidance mapping:"
  printf '        %s\n' "${C3_OFFENDERS[@]}"
  PASS=false
fi

echo "[18.D1 unit tests prove history agent envelope]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent history" \
    "agent history without revisions" \
    "human history" \
    "--format=agent" \
    "format_version" \
    "data.usecase.key" \
    "firstRevision.revision" \
    "context.revision" \
    "suggested_next_actions" \
    "not.toContain(\"UseCase \")" \
    "not.toContain(\"Limit \")" \
    "not.toContain(\"Truncated \")" \
    "not.toContain(\"Suppressed \")" \
    "not.toContain(\"Revision \")" \
    "not.toContain(\"Version \")" \
    "not.toContain(\"Entity \")" \
    "not.toContain(\"Author \")" \
    "not.toContain(\"Timestamp \")" \
    "not.toContain(\"\\nCreated use case\\n\")"; do
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

echo "[18.E1 honest E2E proves history agent envelope]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent history" \
    "runCli([" \
    '"history"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "firstRevision.revision" \
    "context.revision" \
    "vspec usecase show"; do
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

echo "[18.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — history agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'history-agent|Goal 18' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 18"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[18.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/18-history-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/18-history-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
