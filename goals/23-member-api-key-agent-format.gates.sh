#!/usr/bin/env bash
# goals/23-member-api-key-agent-format.gates.sh — Gate suite for goal 23.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="23-member-api-key-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/member.ts
  apps/cli/src/commands/api-key.ts
  apps/cli/tests/unit/member-api-key-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/member-api-key-agent-format.test.ts
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
UNIT_TEST=apps/cli/tests/unit/member-api-key-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/member-api-key-agent-format.test.ts
OLD_MEMBER_BULLET='`member invite`, `api-key create|list|revoke`'
SYNC_BULLET='`lock release`'

echo "[23.A1 member/API-key findings removed]"
if grep -F "$OLD_MEMBER_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — member/API-key agent debt remains"
  PASS=false
elif ! grep -F "$SYNC_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[23.A2 prior sentinels retargeted]"
A2_OFFENDERS=()
while IFS= read -r file; do
  case "$file" in
    goals/23-member-api-key-agent-format.gates.sh|goals/23-member-api-key-agent-format.next-task.sh)
      continue
      ;;
  esac
  A2_OFFENDERS+=("$file still contains old member/API-key sentinel")
done < <(grep -lF "$OLD_MEMBER_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
while IFS= read -r file; do
  if grep -F "unrelated member/api-key debt" "$file" >/dev/null 2>&1 &&
     ! grep -F "$SYNC_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file has member/API-key wording without sync sentinel")
  fi
done < <(find goals -maxdepth 1 \( -name '*.gates.sh' -o -name '*.next-task.sh' \) -print)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[23.B1 unit tests prove member/API-key agent envelopes]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — unit proof failed: pnpm exec vitest run $UNIT_TEST"
  PASS=false
fi

echo "[23.C1 honest E2E proves member/API-key agent lifecycle]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest proof failed: pnpm exec vitest run $HONEST_TEST"
  PASS=false
fi

echo "[23.D1 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — member/API-key agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'member-api-key-agent|Goal 23' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 23"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[23.E1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/23-member-api-key-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/23-member-api-key-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
