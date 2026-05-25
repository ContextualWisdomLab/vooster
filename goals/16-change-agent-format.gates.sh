#!/usr/bin/env bash
# goals/16-change-agent-format.gates.sh — Gate suite for goal 16.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="16-change-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/change.ts
  apps/cli/src/commands/change-output.ts
  apps/cli/tests/unit/change-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/change-agent-format.test.ts
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/16-change-agent-format.gates.sh
  goals/16-change-agent-format.md
  goals/16-change-agent-format.next-task.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
UNIT_TEST=apps/cli/tests/unit/change-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/change-agent-format.test.ts

echo "[16.A1 change findings narrowed]"
if grep -F '`change propose` / `change commit`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — old change propose/commit debt remains"
  PASS=false
elif ! grep -F '`lock release`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unimplemented lock release/renew debt was removed"
  PASS=false
elif ! grep -F '`lock release`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[16.B1 unit tests prove change agent envelopes]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — change agent unit proof failed"
  PASS=false
fi

echo "[16.C1 honest E2E proves change agent envelopes]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — change agent honest E2E proof failed"
  PASS=false
fi

echo "[16.D1 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — change agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'change-agent|Goal 16' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 16"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[16.E1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/16-change-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/16-change-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
