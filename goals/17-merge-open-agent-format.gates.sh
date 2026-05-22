#!/usr/bin/env bash
# goals/17-merge-open-agent-format.gates.sh — Gate suite for goal 17.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="17-merge-open-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/merge.ts
  apps/cli/src/commands/merge-output.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/17-merge-open-agent-format.gates.sh
  goals/17-merge-open-agent-format.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
CLI_SPEC=docs/07-cli-spec.md
MERGE_CMD=apps/cli/src/commands/merge.ts
MERGE_OUTPUT=apps/cli/src/commands/merge-output.ts
UNIT_TEST=apps/cli/tests/unit/merge-open-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/merge-open-agent-format.test.ts

extract_function() {
  local file="$1"
  local fn="$2"
  awk -v fn="$fn" '
    $0 ~ "^(async )?function " fn "\\(" { capture=1 }
    capture && $0 ~ "^(async )?function " && $0 !~ "^(async )?function " fn "\\(" { exit }
    capture { print }
  ' "$file"
}

echo "[17.A1 merge findings narrowed]"
if grep -F '`merge open` / `merge resolve`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — old grouped merge open/resolve debt remains"
  PASS=false
elif ! grep -F '`merge resolve public conflict setup`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — merge resolve public setup debt is missing"
  PASS=false
elif ! grep -F '`lock release`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unimplemented lock release/renew debt was removed"
  PASS=false
elif ! grep -F '`lock release`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
elif ! grep -F 'merge resolve public conflict setup' "$FINDINGS" >/dev/null 2>&1 ||
     ! grep -F '__test' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — merge resolve deferral note is missing"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[17.B1 docs/07-cli-spec.md documents merge open agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format — Merges" \
  "vspec merge open <branch-id> --format=agent" \
  "suggested_next_actions" \
  "context.branch" \
  "data.source_branch.name" \
  "warnings" \
  "vspec merge resolve <id> --format=agent"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing merge agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[17.C1 merge.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$MERGE_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $MERGE_CMD is not in grep -rl 'format === \"agent\"' set"
  PASS=false
fi

echo "[17.C2 openMerge builds an agent envelope]"
OPEN_BLOCK=$(extract_function "$MERGE_CMD" "openMerge")
if [ -n "$OPEN_BLOCK" ] &&
   printf '%s\n' "$OPEN_BLOCK" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
   printf '%s\n' "$OPEN_BLOCK" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — openMerge does not build an agent envelope"
  PASS=false
fi

echo "[17.C3 merge.ts routes only open/resolve actions]"
MERGE_ACTIONS=$(grep -oE 'action === "[a-z]+"' "$MERGE_CMD" | sed -E 's/.*"([^"]+)"/\1/' | sort | tr '\n' ' ' | sed 's/ $//')
if [ "$MERGE_ACTIONS" = "open resolve" ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — merge actions = '$MERGE_ACTIONS' (expected 'open resolve')"
  PASS=false
fi

echo "[17.C4 merge open maps branch context and guidance]"
C4_OFFENDERS=()
if ! printf '%s\n' "$OPEN_BLOCK" | grep -F "suggested_next_actions: body.suggested_next_actions" >/dev/null 2>&1; then
  C4_OFFENDERS+=("suggested_next_actions")
fi
if ! printf '%s\n' "$OPEN_BLOCK" | grep -F "branch: body.source_branch.name" >/dev/null 2>&1; then
  C4_OFFENDERS+=("context.branch")
fi
if ! awk '/source_branch: \{/ { capture=1; next } capture && /\};/ { exit } capture { print }' "$MERGE_OUTPUT" |
   grep -F "name: string;" >/dev/null 2>&1; then
  C4_OFFENDERS+=("MergeOpenResponse.source_branch.name")
fi
if [ "${#C4_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing branch/guidance mapping:"
  printf '        %s\n' "${C4_OFFENDERS[@]}"
  PASS=false
fi

echo "[17.C5 merge resolve public setup remains out of scope]"
RESOLVE_BLOCK=$(extract_function "$MERGE_CMD" "resolveMerge")
if [ -f apps/cli/tests/e2e-cli-honest/merge-resolve-agent-format.test.ts ]; then
  echo "    ✗ fail — merge resolve claimed honest public setup"
  PASS=false
elif ! grep -F '`merge resolve public conflict setup`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — merge resolve public setup debt is missing"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[17.D1 unit tests prove merge open agent envelope]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent merge open" \
    "human merge open" \
    "--format=agent" \
    "format_version" \
    "data.merge_request.id" \
    "data.source_branch.id" \
    "data.source_branch.name" \
    "context.branch" \
    "suggested_next_actions" \
    "warnings" \
    "not.toContain(\"Merge request \")" \
    "not.toContain(\"Status \")" \
    "not.toContain(\"Strategy \")" \
    "not.toContain(\"Conflicts \")" \
    "not.toContain(\"Impacted entities \")" \
    "not.toContain(\"Source branch \")" \
    "not.toContain(\"Main heads \")"; do
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

echo "[17.E1 honest E2E proves merge open agent envelope]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent merge open" \
    "runCli(" \
    '"branch"' \
    '"merge"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "data.merge_request.id" \
    "data.source_branch.id" \
    "data.source_branch.name" \
    "context.branch"; do
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

echo "[17.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — merge agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'merge-agent|Goal 17' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 17"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[17.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/17-merge-open-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/17-merge-open-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
