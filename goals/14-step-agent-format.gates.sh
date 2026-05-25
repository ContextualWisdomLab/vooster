#!/usr/bin/env bash
# goals/14-step-agent-format.gates.sh — Gate suite for goal 14.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="14-step-agent-format"

GATE_INPUTS=(
  apps/cli/src/commands/step.ts
  apps/cli/tests/unit/step-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/step-agent-format.test.ts
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/14-step-agent-format.gates.sh
  goals/14-step-agent-format.md
  goals/14-step-agent-format.next-task.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
UNIT_TEST=apps/cli/tests/unit/step-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/step-agent-format.test.ts

echo "[14.A1 step findings narrowed]"
if grep -F '`step add` / `step edit`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — old step add/edit debt remains"
  PASS=false
elif ! grep -F '`lock release`' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated pull/push/sync debt was removed"
  PASS=false
elif ! grep -F 'context.revision is therefore null' "$FINDINGS" >/dev/null 2>&1; then
  echo "    ✗ fail — step edit revision-id asymmetry note missing"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[14.B1 unit tests prove step agent envelopes]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — step agent unit proof failed"
  PASS=false
fi

echo "[14.C1 honest E2E proves step agent envelopes]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — step agent honest E2E proof failed"
  PASS=false
fi

echo "[14.D1 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — step agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'step-agent|Goal 14' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 14"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[14.E1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/14-step-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/14-step-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
