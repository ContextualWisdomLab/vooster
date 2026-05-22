#!/usr/bin/env bash
# goals/12-branch-agent-format.gates.sh — Gate suite for goal 12.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="12-branch-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/branch.ts
  apps/cli/src/index.ts
  apps/cli/tests/unit
  apps/cli/tests/e2e-cli-honest
  apps/api/src/http/branch-routes.ts
  apps/api/src/http/branch-results.ts
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/12-branch-agent-format.gates.sh
  goals/12-branch-agent-format.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

CLI_SPEC=docs/07-cli-spec.md
FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
BRANCH_CMD=apps/cli/src/commands/branch.ts
UNIT_TEST=apps/cli/tests/unit/branch-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/branch-agent-format.test.ts

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
    $0 ~ "^(async )?function " fn "\\(" { capture=1 }
    capture && $0 ~ "^(async )?function " && $0 !~ "^(async )?function " fn "\\(" { exit }
    capture { print }
  ' "$file"
}

echo "[12.A1 branch-create agent debt removed from findings]"
A1_LINES=$(agent_debt_bullets)
A1_COUNT=$(printf '%s\n' "$A1_LINES" | sed '/^$/d' | wc -l | tr -d ' ')
if printf '%s\n' "$A1_LINES" | grep -F "branch create" >/dev/null 2>&1; then
  echo "    ✗ fail — branch create still appears in $FINDINGS"
  PASS=false
elif ! printf '%s\n' "$A1_LINES" | grep -F "lock" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated lock debt was removed from $FINDINGS"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[12.B1 docs/07-cli-spec.md documents branch agent format]"
B1_OFFENDERS=()
for token in \
  "### Agent Format for Branches" \
  "vspec branch create <name> --format=agent" \
  "context.branch" \
  "data.branch.name"; do
  if ! grep -F -- "$token" "$CLI_SPEC" >/dev/null 2>&1; then
    B1_OFFENDERS+=("$token")
  fi
done
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing branch agent spec text:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[12.C1 branch.ts discovered by Goal 7 agent-branch source]"
if grep -rlE 'format === "agent"' apps/cli/src/commands 2>/dev/null |
   grep -Fx "$BRANCH_CMD" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $BRANCH_CMD is not in grep -rl 'format === \"agent\"' set"
  PASS=false
fi

echo "[12.C2 branch create builds an agent envelope]"
C2_BLOCK=$(extract_function "$BRANCH_CMD" "createBranch")
if [ -n "$C2_BLOCK" ] &&
   printf '%s\n' "$C2_BLOCK" | grep -F 'format === "agent"' >/dev/null 2>&1 &&
   printf '%s\n' "$C2_BLOCK" | grep -F "buildAgentEnvelope" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — createBranch must contain format === \"agent\" and buildAgentEnvelope"
  PASS=false
fi

echo "[12.C3 branch API files do not own agent envelope]"
C3_OFFENDERS=()
for file in apps/api/src/http/branch-routes.ts apps/api/src/http/branch-results.ts; do
  if grep -E 'buildAgentEnvelope|format_version|format === "agent"' "$file" >/dev/null 2>&1; then
    C3_OFFENDERS+=("$file")
  fi
done
if [ "${#C3_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — API branch files mention agent-envelope details:"
  printf '        %s\n' "${C3_OFFENDERS[@]}"
  PASS=false
fi

echo "[12.D1 unit tests prove branch create agent envelope]"
D1_OFFENDERS=()
if [ ! -f "$UNIT_TEST" ]; then
  D1_OFFENDERS+=("$UNIT_TEST missing")
else
  for token in \
    "agent branch create" \
    "human branch create" \
    "--format=agent" \
    "format_version" \
    "context.branch" \
    "data.branch.id" \
    "data.branch.name" \
    "data.branch.status"; do
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

echo "[12.E1 honest E2E proves branch create agent envelope]"
E1_OFFENDERS=()
if [ ! -f "$HONEST_TEST" ]; then
  E1_OFFENDERS+=("$HONEST_TEST missing")
else
  if grep -E '\bfetch\(' "$HONEST_TEST" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$HONEST_TEST calls fetch(")
  fi
  for token in \
    "agent branch create" \
    "runCli([" \
    '"branch"' \
    '"create"' \
    "--format=agent" \
    "VSPEC_CONFIG_PATH" \
    "format_version" \
    "context.branch" \
    "data.branch.id" \
    "data.branch.name" \
    "data.branch.status"; do
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

echo "[12.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — branch agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'branch-agent|Goal 12' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 12"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[12.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/12-branch-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/12-branch-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
