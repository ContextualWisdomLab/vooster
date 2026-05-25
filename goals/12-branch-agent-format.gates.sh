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
  apps/cli/tests/unit/branch-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/branch-agent-format.test.ts
  apps/api/src/http/branch-routes.ts
  apps/api/src/http/branch-results.ts
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/12-branch-agent-format.gates.sh
  goals/12-branch-agent-format.next-task.sh
  goals/12-branch-agent-format.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
UNIT_TEST=apps/cli/tests/unit/branch-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/branch-agent-format.test.ts

agent_debt_bullets() {
  awk '
    /^## `--format=agent` coverage debt/ { capture=1; next }
    capture && /^## / { capture=0 }
    capture && /^-/ { print }
  ' "$FINDINGS"
}

echo "[12.A1 branch-create agent debt removed from findings]"
A1_LINES=$(agent_debt_bullets)
if printf '%s\n' "$A1_LINES" | grep -F "branch create" >/dev/null 2>&1; then
  echo "    ✗ fail — branch create still appears in $FINDINGS"
  PASS=false
elif ! printf '%s\n' "$A1_LINES" | grep -F "lock" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated lock debt was removed from $FINDINGS"
  PASS=false
else
  echo "    ✓ pass"
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
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: pnpm exec vitest run $UNIT_TEST"
  PASS=false
fi

echo "[12.E1 honest E2E proves branch create agent envelope]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: pnpm exec vitest run $HONEST_TEST"
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
