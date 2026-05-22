#!/usr/bin/env bash
# goals/19-impact-agent-format.gates.sh — Gate suite for goal 19.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="19-impact-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/impact.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  goals/18-history-agent-format.gates.sh
  scripts/check-gate-rigor.sh
  goals/19-impact-agent-format.gates.sh
  goals/19-impact-agent-format.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
IMPACT_CMD=apps/cli/src/commands/impact.ts
UNIT_TEST=apps/cli/tests/unit/impact-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/impact-agent-format.test.ts
OLD_IMPACT_BULLET='`impact`, `revert`, `wh''o`, `comment add|list|edit|resolve|''delete`'
NEW_IMPACT_BULLET='`lock release`'
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

echo "[19.A1 impact findings narrowed]"
if grep -F "$OLD_IMPACT_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — old grouped impact debt remains"
  PASS=false
elif ! grep -F "$NEW_IMPACT_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — narrowed revert/who/comment debt is missing"
  PASS=false
elif ! grep -F "$MEMBER_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[19.A2 Goal 18 sentinel retargeted]"
if grep -F "NEW_HISTORY_BULLET='$OLD_IMPACT_BULLET'" goals/18-history-agent-format.gates.sh >/dev/null 2>&1; then
  echo "    ✗ fail — Goal 18 still requires pre-impact sentinel"
  PASS=false
elif ! grep -F "NEW_HISTORY_BULLET='$NEW_IMPACT_BULLET'" goals/18-history-agent-format.gates.sh >/dev/null 2>&1; then
  echo "    ✗ fail — Goal 18 missing post-impact sentinel"
  PASS=false
elif ! grep -F "$MEMBER_BULLET" goals/18-history-agent-format.gates.sh >/dev/null 2>&1; then
  echo "    ✗ fail — Goal 18 lost unrelated pull/push/sync sentinel"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[19.B1 docs/07-cli-spec.md documents impact agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format — Impact" \
  "vspec impact <KEY-NNN> --format=agent" \
  "suggested_next_actions" \
  "context.revision" \
  "base_revision" \
  "data.preview_id" \
  "data.impact.input_hash"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing impact agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[19.C1 impact.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$IMPACT_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $IMPACT_CMD is not in grep -rl 'format === \"agent\"' set"
  PASS=false
fi

echo "[19.C2 runImpact builds an agent envelope]"
IMPACT_BLOCK=$(extract_function "$IMPACT_CMD" "runImpact")
if [ -n "$IMPACT_BLOCK" ] &&
   printf '%s\n' "$IMPACT_BLOCK" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
   printf '%s\n' "$IMPACT_BLOCK" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — runImpact does not build an agent envelope"
  PASS=false
fi

echo "[19.C3 impact maps revision context and guidance]"
C3_OFFENDERS=()
if ! printf '%s\n' "$IMPACT_BLOCK" | grep -F "suggested_next_actions: body.suggested_next_actions" >/dev/null 2>&1; then
  C3_OFFENDERS+=("suggested_next_actions")
fi
if ! printf '%s\n' "$IMPACT_BLOCK" | grep -E "revision: .*revision" >/dev/null 2>&1; then
  C3_OFFENDERS+=("context.revision")
fi
if [ "${#C3_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing impact context/guidance mapping:"
  printf '        %s\n' "${C3_OFFENDERS[@]}"
  PASS=false
fi

echo "[19.C4 impact exposes format flag]"
if grep -F "format: Flags.string()" "$IMPACT_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — ImpactCommand.flags missing format"
  PASS=false
fi

echo "[19.D1 unit tests prove impact agent envelope]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent impact" \
    "human impact" \
    "--format=agent" \
    "format_version" \
    "data.preview_id" \
    "data.impact.input_hash" \
    "context.revision" \
    "suggested_next_actions" \
    "vspec lock" \
    "history response" \
    "impact response" \
    "JSON.parse(stdout)" \
    "not.toContain(\"Preview \")" \
    "not.toContain(\"Cached \")" \
    "not.toContain(\"Severity \")" \
    "not.toContain(\"Confidence \")" \
    "not.toContain(\"Affected sessions \")" \
    "not.toContain(\"Affected branches \")" \
    "not.toContain(\"Affected tests \")" \
    "not.toContain(\"Input hash \")"; do
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

echo "[19.E1 honest E2E proves impact agent envelope]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent impact" \
    "runCli([" \
    '"impact"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.preview_id" \
    "data.impact.input_hash" \
    "context.revision" \
    "suggested_next_actions" \
    "vspec lock"; do
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

echo "[19.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — impact agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'impact-agent|Goal 19' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 19"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[19.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/19-impact-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/19-impact-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
