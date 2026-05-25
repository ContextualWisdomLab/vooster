#!/usr/bin/env bash
# goals/26-pull-sync-agent-format.gates.sh — Gate suite for goal 26.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="26-pull-sync-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/pull.ts
  apps/cli/src/commands/sync.ts
  apps/cli/tests/unit/pull-sync-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/pull-sync-agent-format.test.ts
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
UNIT_TEST=apps/cli/tests/unit/pull-sync-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/pull-sync-agent-format.test.ts
OLD_SYNC_BULLET='`pull`, `pu''sh`, `sync`'
PUSH_BULLET='`lock release`'

echo "[26.A1 pull/sync findings narrowed]"
if grep -F "$OLD_SYNC_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — pull/push/sync debt remains grouped"
  PASS=false
elif ! grep -F "$PUSH_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — push debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[26.A2 prior sentinels retargeted]"
A2_OFFENDERS=()
while IFS= read -r file; do
  case "$file" in
    goals/26-pull-sync-agent-format.gates.sh|goals/26-pull-sync-agent-format.next-task.sh)
      continue
      ;;
  esac
  A2_OFFENDERS+=("$file still contains old pull/push/sync sentinel")
done < <(grep -lF "$OLD_SYNC_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[26.B1 unit tests prove pull/sync agent envelopes]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — pull/sync agent unit proof failed"
  PASS=false
fi

echo "[26.C1 honest E2E proves pull/sync agent lifecycle]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — pull/sync agent honest E2E proof failed"
  PASS=false
fi

echo "[26.D1 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — pull/sync agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'pull-sync-agent|Goal 26' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 26"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[26.E1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/26-pull-sync-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/26-pull-sync-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
