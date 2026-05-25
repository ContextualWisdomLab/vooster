#!/usr/bin/env bash
# goals/13-lock-agent-format.gates.sh — Gate suite for goal 13.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="13-lock-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/lock-output.ts
  apps/cli/src/commands/lock.ts
  apps/cli/tests/unit/lock-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/lock-agent-format.test.ts
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/13-lock-agent-format.gates.sh
  goals/13-lock-agent-format.next-task.sh
  goals/13-lock-agent-format.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
UNIT_TEST=apps/cli/tests/unit/lock-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/lock-agent-format.test.ts

agent_debt_bullets() {
  awk '
    /^## `--format=agent` coverage debt/ { capture=1; next }
    capture && /^## / { capture=0 }
    capture && /^-/ { print }
  ' "$FINDINGS"
}

echo "[13.A1 lock findings narrowed]"
A1_LINES=$(agent_debt_bullets)
if printf '%s\n' "$A1_LINES" | grep -F "lock (acquire/release/renew)" >/dev/null 2>&1; then
  echo "    ✗ fail — old broad lock debt remains"
  PASS=false
elif ! printf '%s\n' "$A1_LINES" | grep -F '`lock release`' >/dev/null 2>&1; then
  echo "    ✗ fail — remaining lock release/renew debt is missing"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[13.D1 unit tests prove lock agent envelopes]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: pnpm exec vitest run $UNIT_TEST"
  PASS=false
fi

echo "[13.E1 honest E2E proves lock agent envelopes]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: pnpm exec vitest run $HONEST_TEST"
  PASS=false
fi

echo "[13.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — lock agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'lock-agent|Goal 13' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 13"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[13.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/13-lock-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/13-lock-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
