#!/usr/bin/env bash
# goals/15-scenario-agent-format.gates.sh — Gate suite for goal 15.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="15-scenario-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/scenario.ts
  apps/cli/tests/unit/scenario-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/scenario-agent-format.test.ts
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/15-scenario-agent-format.gates.sh
  goals/15-scenario-agent-format.md
  goals/15-scenario-agent-format.next-task.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
UNIT_TEST=apps/cli/tests/unit/scenario-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/scenario-agent-format.test.ts

echo "[15.A1 scenario findings narrowed]"
if grep -F '`scenario add`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — old scenario add debt remains"
  PASS=false
elif ! grep -F '`lock release`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[15.B1 unit tests prove scenario agent envelope]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — scenario agent unit proof failed"
  PASS=false
fi

echo "[15.C1 honest E2E proves scenario agent envelope]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — scenario agent honest E2E proof failed"
  PASS=false
fi

echo "[15.D1 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — scenario agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'scenario-agent|Goal 15' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 15"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[15.E1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/15-scenario-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/15-scenario-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
