#!/usr/bin/env bash
# goals/25-project-create-agent-format.gates.sh — Gate suite for goal 25.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="25-project-create-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/project.ts
  apps/cli/src/commands/status.ts
  apps/cli/tests/unit/project-create-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/project-create-agent-format.test.ts
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/24-local-context-agent-format.gates.sh
  goals/24-local-context-agent-format.next-task.sh
  goals/25-project-create-agent-format.gates.sh
  goals/25-project-create-agent-format.md
  goals/25-project-create-agent-format.next-task.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
UNIT_TEST=apps/cli/tests/unit/project-create-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/project-create-agent-format.test.ts
PROJECT_BULLET='`project create`'
SYNC_BULLET='`lock release`'

echo "[25.A1 project-create findings removed]"
if grep -F "$PROJECT_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — project-create agent debt remains"
  PASS=false
elif ! grep -F "$SYNC_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[25.A2 Goal 24 sentinel retargeted]"
A2_OFFENDERS=()
for file in goals/24-local-context-agent-format.gates.sh \
  goals/24-local-context-agent-format.next-task.sh; do
  if grep -F "$PROJECT_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file still checks project-create sentinel")
  fi
  if ! grep -F "$SYNC_BULLET" "$file" >/dev/null 2>&1; then
    A2_OFFENDERS+=("$file missing pull/push/sync sentinel")
  fi
done
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — Goal 24 sentinel retarget gaps:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

echo "[25.B1 unit tests prove project create agent envelope]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — project create agent unit proof failed"
  PASS=false
fi

echo "[25.C1 honest E2E proves project create agent envelope]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — project create agent honest E2E proof failed"
  PASS=false
fi

echo "[25.D1 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — project-create agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'project-create-agent|Goal 25' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 25"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[25.E1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/25-project-create-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/25-project-create-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
