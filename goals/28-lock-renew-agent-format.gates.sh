#!/usr/bin/env bash
# goals/28-lock-renew-agent-format.gates.sh — Gate suite for goal 28.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="28-lock-renew-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/lock-output.ts
  apps/cli/src/commands/lock.ts
  apps/cli/src/index.ts
  apps/cli/tests/unit/lock-renew-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/lock-renew-agent-format.test.ts
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
UNIT_TEST=apps/cli/tests/unit/lock-renew-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/lock-renew-agent-format.test.ts
OLD_LOCK_BULLET='`lock release` / `lock renew`'
LOCK_RELEASE_BULLET='`lock release`'
MERGE_SETUP_BULLET='`merge resolve public conflict setup`'

echo "[28.A1 lock renew findings removed]"
if grep -F "$OLD_LOCK_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — combined lock release/renew debt remains"
  PASS=false
elif ! grep -F "$LOCK_RELEASE_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — lock release debt was removed"
  PASS=false
elif ! grep -F "$MERGE_SETUP_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — merge resolve public setup debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[28.A2 prior lock sentinels retargeted]"
A2_OFFENDERS=()
while IFS= read -r file; do
  case "$file" in
    goals/28-lock-renew-agent-format.gates.sh|goals/28-lock-renew-agent-format.next-task.sh)
      continue
      ;;
  esac
  A2_OFFENDERS+=("$file still contains old lock release/renew sentinel")
done < <(grep -lF "$OLD_LOCK_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[28.B1 unit tests prove lock renew]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — lock renew unit proof failed"
  PASS=false
fi

echo "[28.C1 honest E2E proves lock renew]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — lock renew honest E2E proof failed"
  PASS=false
fi

echo "[28.D1 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — lock renew proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'lock-renew|Goal 28' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 28"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[28.E1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/28-lock-renew-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/28-lock-renew-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
