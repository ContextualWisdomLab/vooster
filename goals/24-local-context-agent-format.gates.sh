#!/usr/bin/env bash
# goals/24-local-context-agent-format.gates.sh — Gate suite for goal 24.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="24-local-context-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/status.ts
  apps/cli/src/commands/workspace.ts
  apps/cli/src/commands/project.ts
  apps/cli/tests/unit/local-context-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/local-context-agent-format.test.ts
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/24-local-context-agent-format.gates.sh
  goals/24-local-context-agent-format.md
  goals/24-local-context-agent-format.next-task.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
UNIT_TEST=apps/cli/tests/unit/local-context-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/local-context-agent-format.test.ts
OLD_PROJECT_BULLET='`project cre''ate` / `project switch`'
NEW_PROJECT_BULLET='`lock release`'
WORKSPACE_BULLET='`workspace switch`'
STATUS_BULLET='`status`'
SYNC_BULLET='`lock release`'

echo "[24.A1 local-context findings narrowed]"
A1_OFFENDERS=()
if grep -F "$OLD_PROJECT_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  A1_OFFENDERS+=("project switch still grouped with project create")
fi
if ! grep -F "$NEW_PROJECT_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  A1_OFFENDERS+=("pull/push/sync sentinel was removed")
fi
if grep -F "$WORKSPACE_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  A1_OFFENDERS+=("workspace switch debt remains")
fi
if grep -F "$STATUS_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  A1_OFFENDERS+=("status debt remains")
fi
if ! grep -F "$SYNC_BULLET" "$FINDINGS" >/dev/null 2>&1; then
  A1_OFFENDERS+=("pull/push/sync sentinel was removed")
fi
if [ "${#A1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — findings gaps:"
  printf '        %s\n' "${A1_OFFENDERS[@]}"
  PASS=false
fi

echo "[24.B1 unit tests prove local-context agent envelopes]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — local-context agent unit proof failed"
  PASS=false
fi

echo "[24.C1 honest E2E proves local-context agent lifecycle]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — local-context agent honest E2E proof failed"
  PASS=false
fi

echo "[24.D1 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — local-context agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'local-context-agent|Goal 24' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 24"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[24.E1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/24-local-context-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/24-local-context-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
