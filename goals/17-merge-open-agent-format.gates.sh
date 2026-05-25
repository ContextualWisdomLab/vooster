#!/usr/bin/env bash
# goals/17-merge-open-agent-format.gates.sh — Gate suite for goal 17.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="17-merge-open-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/merge.ts
  apps/cli/src/commands/merge-output.ts
  apps/cli/tests/unit/merge-open-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/merge-open-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/merge-resolve-agent-format.test.ts
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/17-merge-open-agent-format.gates.sh
  goals/17-merge-open-agent-format.md
  goals/17-merge-open-agent-format.next-task.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
MERGE_CMD=apps/cli/src/commands/merge.ts
UNIT_TEST=apps/cli/tests/unit/merge-open-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/merge-open-agent-format.test.ts

echo "[17.A1 merge findings narrowed]"
if grep -F '`merge open` / `merge resolve`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — old grouped merge open/resolve debt remains"
  PASS=false
elif ! grep -F '`merge resolve public conflict setup`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — merge resolve public setup debt is missing"
  PASS=false
elif ! grep -F '`lock release`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unimplemented lock release/renew debt was removed"
  PASS=false
elif ! grep -F '`lock release`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
elif ! grep -F 'merge resolve public conflict setup' "$FINDINGS" >/dev/null 2>&1 ||
     ! grep -F '__test' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — merge resolve deferral note is missing"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[17.B1 merge resolve public setup remains out of scope]"
if [ -f apps/cli/tests/e2e-cli-honest/merge-resolve-agent-format.test.ts ]; then
  echo "    ✗ fail — merge resolve claimed honest public setup"
  PASS=false
elif ! grep -F '`merge resolve public conflict setup`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — merge resolve public setup debt is missing"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[17.C1 unit tests prove merge open agent envelope]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — merge open agent unit proof failed"
  PASS=false
fi

echo "[17.D1 honest E2E proves merge open agent envelope]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — merge open agent honest E2E proof failed"
  PASS=false
fi

echo "[17.E1 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — merge agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'merge-agent|Goal 17' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 17"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[17.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/17-merge-open-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/17-merge-open-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
