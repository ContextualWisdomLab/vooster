#!/usr/bin/env bash
# goals/18-history-agent-format.gates.sh — Gate suite for goal 18.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="18-history-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/history.ts
  apps/cli/tests/unit/history-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/history-agent-format.test.ts
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
UNIT_TEST=apps/cli/tests/unit/history-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/history-agent-format.test.ts
OLD_HISTORY_BULLET='`history`, `impact`, `revert`, `wh''o`, `comment add|list|edit|resolve|''delete`'
NEW_HISTORY_BULLET='`lock release`'
MEMBER_BULLET='`lock release`'

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

echo "[18.B1 unit tests prove history agent and human behavior]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — unit proof failed: pnpm exec vitest run $UNIT_TEST"
  PASS=false
fi

echo "[18.C1 honest E2E proves history agent envelope]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest proof failed: pnpm exec vitest run $HONEST_TEST"
  PASS=false
fi

echo "[18.D1 honest proof does not widen Goal 7 UC set]"
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

echo "[18.E1 Gate rigor]"
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
