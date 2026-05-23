#!/usr/bin/env bash
# goals/22-comment-agent-format.gates.sh — Gate suite for goal 22.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="22-comment-agent-format"

GATE_INPUTS=(
  apps/cli/src
  apps/cli/tests/unit/comment-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/comment-agent-format.test.ts
  apps/api/src
  apps/api/prisma
  apps/api/tests/helpers
  goals/7-cli-spec-parity.gates.sh
  goals/18-history-agent-format.gates.sh
  goals/18-history-agent-format.next-task.sh
  goals/19-impact-agent-format.gates.sh
  goals/19-impact-agent-format.next-task.sh
  goals/20-who-agent-format.gates.sh
  goals/20-who-agent-format.next-task.sh
  goals/21-revert-agent-format.gates.sh
  goals/21-revert-agent-format.next-task.sh
  goals/22-comment-agent-format.gates.sh
  goals/22-comment-agent-format.md
  scripts/_gate-cache.sh
  scripts/check-gate-rigor.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

OLD_COMMENT_BULLET='`comment add|list|edit|resolve|delete`'
MEMBER_BULLET='`lock release`'

run_gate() {
  local label="$1"
  shift
  echo "[$label]"
  if "$@"; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — re-run: $*"
    PASS=false
  fi
}

echo "[22.A1 prior sentinels still target remaining agent-format debt]"
A1_OFFENDERS=()
for file in goals/18-history-agent-format.gates.sh \
  goals/18-history-agent-format.next-task.sh \
  goals/19-impact-agent-format.gates.sh \
  goals/19-impact-agent-format.next-task.sh \
  goals/20-who-agent-format.gates.sh \
  goals/20-who-agent-format.next-task.sh \
  goals/21-revert-agent-format.gates.sh \
  goals/21-revert-agent-format.next-task.sh; do
  if grep -F "$OLD_COMMENT_BULLET" "$file" >/dev/null 2>&1; then
    A1_OFFENDERS+=("$file still checks old comment sentinel")
  fi
  if ! grep -F "$MEMBER_BULLET" "$file" >/dev/null 2>&1; then
    A1_OFFENDERS+=("$file missing remaining-debt sentinel")
  fi
done
while IFS= read -r file; do
  case "$file" in
    goals/22-comment-agent-format.gates.sh|goals/22-comment-agent-format.next-task.sh)
      continue
      ;;
  esac
  A1_OFFENDERS+=("$file still contains old comment sentinel")
done < <(grep -lF "$OLD_COMMENT_BULLET" goals/*.gates.sh goals/*.next-task.sh 2>/dev/null)
if [ "${#A1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — sentinel retarget gaps:"
  printf '        %s\n' "${A1_OFFENDERS[@]}"
  PASS=false
fi

run_gate \
  "22.B1 unit behavior proves comment agent envelopes" \
  pnpm exec vitest run apps/cli/tests/unit/comment-agent-format.test.ts --passWithNoTests=false

run_gate \
  "22.C1 honest CLI behavior proves comment agent lifecycle" \
  pnpm exec vitest run apps/cli/tests/e2e-cli-honest/comment-agent-format.test.ts --passWithNoTests=false

run_gate \
  "22.D1 Gate rigor" \
  "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/22-comment-agent-format.md"

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
