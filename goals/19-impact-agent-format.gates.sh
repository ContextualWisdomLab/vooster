#!/usr/bin/env bash
# goals/19-impact-agent-format.gates.sh — Gate suite for goal 19.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="19-impact-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/impact.ts
  apps/cli/tests/unit/impact-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/impact-agent-format.test.ts
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
UNIT_TEST=apps/cli/tests/unit/impact-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/impact-agent-format.test.ts
OLD_IMPACT_BULLET='`impact`, `revert`, `wh''o`, `comment add|list|edit|resolve|''delete`'
NEW_IMPACT_BULLET='`lock release`'
MEMBER_BULLET='`lock release`'

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

echo "[19.B1 unit tests prove impact agent and human behavior]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — unit proof failed: pnpm exec vitest run $UNIT_TEST"
  PASS=false
fi

echo "[19.C1 honest E2E proves impact agent envelope]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest proof failed: pnpm exec vitest run $HONEST_TEST"
  PASS=false
fi

echo "[19.D1 honest proof does not widen Goal 7 UC set]"
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

echo "[19.E1 Gate rigor]"
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
