#!/usr/bin/env bash
# goals/27-push-agent-format.gates.sh — Gate suite for goal 27.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="27-push-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/push.ts
  apps/cli/src/commands/sync.ts
  apps/cli/tests/unit/push-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/push-agent-format.test.ts
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/*.gates.sh
  goals/*.next-task.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
UNIT_TEST=apps/cli/tests/unit/push-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/push-agent-format.test.ts
OLD_PUSH_BULLET='`push`'
LOCK_BULLET='`lock release`'
MERGE_SETUP_BULLET='`merge resolve public conflict setup`'

echo "[27.A1 push findings removed]"
if grep -F "$OLD_PUSH_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — push debt remains"
  PASS=false
elif ! grep -F "$LOCK_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — lock release/renew debt was removed"
  PASS=false
elif ! grep -F "$MERGE_SETUP_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — merge resolve public setup debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[27.A2 prior push sentinels retargeted]"
A2_OFFENDERS=()
while IFS= read -r file; do
  case "$file" in
    goals/27-push-agent-format.gates.sh|goals/27-push-agent-format.next-task.sh)
      continue
      ;;
  esac
  A2_OFFENDERS+=("$file still contains old push sentinel")
done < <(grep -lF "$OLD_PUSH_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[27.B1 unit tests prove push agent envelope]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — push agent unit proof failed"
  PASS=false
fi

echo "[27.C1 honest E2E proves push agent lifecycle]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — push agent honest E2E proof failed"
  PASS=false
fi

echo "[27.D1 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — push agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'push-agent|Goal 27' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 27"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[27.E1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/27-push-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/27-push-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
