#!/usr/bin/env bash
# goals/20-who-agent-format.gates.sh — Gate suite for goal 20.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="20-who-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/who.ts
  apps/cli/tests/unit/who-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/who-agent-format.test.ts
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  goals/18-history-agent-format.gates.sh
  goals/18-history-agent-format.next-task.sh
  goals/19-impact-agent-format.gates.sh
  goals/19-impact-agent-format.next-task.sh
  scripts/check-gate-rigor.sh
  goals/20-who-agent-format.gates.sh
  goals/20-who-agent-format.md
  goals/20-who-agent-format.next-task.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
UNIT_TEST=apps/cli/tests/unit/who-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/who-agent-format.test.ts
OLD_WHO_BULLET='`revert`, `who`, `comment add|list|edit|resolve|''delete`'
NEW_WHO_BULLET='`lock release`'
MEMBER_BULLET='`lock release`'

echo "[20.A1 who findings narrowed]"
if grep -F "$OLD_WHO_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — old grouped who debt remains"
  PASS=false
elif ! grep -F "$NEW_WHO_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — narrowed revert/comment debt is missing"
  PASS=false
elif ! grep -F "$MEMBER_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[20.A2 prior sentinels retargeted]"
A2_OFFENDERS=()
for file in goals/18-history-agent-format.gates.sh \
  goals/18-history-agent-format.next-task.sh \
  goals/19-impact-agent-format.gates.sh \
  goals/19-impact-agent-format.next-task.sh; do
  if grep -F "$OLD_WHO_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file still checks old who sentinel")
  fi
  if ! grep -F "$NEW_WHO_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file missing post-who sentinel")
  fi
done
while IFS= read -r file; do
  case "$file" in
    goals/20-who-agent-format.gates.sh|goals/20-who-agent-format.next-task.sh)
      continue
      ;;
  esac
  A2_OFFENDERS+=("$file still contains old who sentinel")
done < <(grep -lF "$OLD_WHO_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[20.B1 unit tests prove who agent and human behavior]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — unit proof failed: pnpm exec vitest run $UNIT_TEST"
  PASS=false
fi

echo "[20.C1 honest E2E proves who agent envelope]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest proof failed: pnpm exec vitest run $HONEST_TEST"
  PASS=false
fi

echo "[20.D1 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — who agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'who-agent|Goal 20' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 20"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[20.E1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/20-who-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/20-who-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
