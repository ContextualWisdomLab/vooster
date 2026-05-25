#!/usr/bin/env bash
# goals/29-merge-resolve-agent-format.gates.sh — Gate suite for goal 29.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="29-merge-resolve-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/merge.ts
  apps/cli/src/commands/merge-output.ts
  apps/cli/tests/unit/merge-resolve-agent-format.test.ts
  apps/cli/tests/e2e-cli/merge-resolve-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/merge-resolve-agent-format.test.ts
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
MERGE_CMD=apps/cli/src/commands/merge.ts
UNIT_TEST=apps/cli/tests/unit/merge-resolve-agent-format.test.ts
E2E_TEST=apps/cli/tests/e2e-cli/merge-resolve-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/merge-resolve-agent-format.test.ts
OLD_MERGE_BULLET='`merge resolve`'
SETUP_BULLET='`merge resolve public conflict setup`'
LOCK_RELEASE_BULLET='`lock release`'

echo "[29.A1 merge resolve findings split]"
if grep -F -- "- $OLD_MERGE_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — exact merge resolve agent-format debt remains"
  PASS=false
elif ! grep -F "$LOCK_RELEASE_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — lock release debt was removed"
  PASS=false
elif ! grep -F "$SETUP_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — merge resolve public setup debt is missing"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[29.A2 prior merge sentinels retargeted]"
A2_OFFENDERS=()
while IFS= read -r file; do
  case "$file" in
    goals/29-merge-resolve-agent-format.gates.sh|goals/29-merge-resolve-agent-format.next-task.sh)
      continue
      ;;
  esac
  if grep -F -- "- $OLD_MERGE_BULLET" "$file" >/dev/null 2>&1 ||
     grep -F "MERGE_BULLET='$OLD_MERGE_BULLET'" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file still contains old merge resolve sentinel")
  fi
done < <(grep -lF "$OLD_MERGE_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — prior sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[29.B1 production merge command has no test setup route]"
if grep -F "__test" "$MERGE_CMD" >/dev/null 2>&1; then
  echo "    ✗ fail — merge command contains __test"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[29.C1 unit tests prove merge resolve agent envelope]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — merge resolve agent unit proof failed"
  PASS=false
fi

echo "[29.D1 CLI E2E proves merge resolve agent envelope]"
if pnpm exec vitest run "$E2E_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — merge resolve agent CLI E2E proof failed"
  PASS=false
fi

echo "[29.E1 proof does not pretend to be honest public setup]"
E2_OFFENDERS=()
if [ -f "$HONEST_TEST" ]; then
  E2_OFFENDERS+=("$HONEST_TEST must not exist")
fi
if [ -f "$E2E_TEST" ]; then
  if grep -E 'fetch\([^)]*/v1/merges/[^)]*/resolve' "$E2E_TEST" >/dev/null 2>&1; then
    E2_OFFENDERS+=("$E2E_TEST fetches merge resolve API directly")
  fi
  if grep -E '\bfetch\(' "$E2E_TEST" >/dev/null 2>&1 &&
     ! grep -F "/__test/" "$E2E_TEST" >/dev/null 2>&1; then
    E2_OFFENDERS+=("$E2E_TEST fetch setup does not show __test use")
  fi
fi
if awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'merge-resolve-agent|Goal 29' >/dev/null 2>&1; then
  E2_OFFENDERS+=("HONEST_UC_SET was widened for Goal 29")
fi
if [ "${#E2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest-boundary gaps:"
  printf '        %s\n' "${E2_OFFENDERS[@]}"
  PASS=false
fi

echo "[29.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/29-merge-resolve-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/29-merge-resolve-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
