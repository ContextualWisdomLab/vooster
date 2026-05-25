#!/usr/bin/env bash
# goals/11-session-agent-format.gates.sh — Gate suite for goal 11.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="11-session-agent-format"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/session.ts
  apps/cli/src/commands/session-flags.ts
  apps/cli/src/commands/session-output.ts
  apps/cli/tests/unit/session-agent-format.test.ts
  apps/cli/tests/e2e-cli-honest/session-agent-format.test.ts
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  goals/7-cli-spec-parity.gates.sh
  scripts/check-gate-rigor.sh
  goals/11-session-agent-format.gates.sh
  goals/11-session-agent-format.next-task.sh
  goals/11-session-agent-format.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
UNIT_TEST=apps/cli/tests/unit/session-agent-format.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/session-agent-format.test.ts

echo "[11.A1 session agent debt removed from findings]"
A1_LINES=$(awk '
  /^## `--format=agent` coverage debt/ { capture=1; next }
  capture && /^## / { capture=0 }
  capture && /^-/ { print }
' "$FINDINGS")
if printf '%s\n' "$A1_LINES" | grep -F "session start" >/dev/null 2>&1 ||
   printf '%s\n' "$A1_LINES" | grep -F "session complete" >/dev/null 2>&1 ||
   printf '%s\n' "$A1_LINES" | grep -F "session list" >/dev/null 2>&1; then
  echo "    ✗ fail — session agent debt still appears in $FINDINGS"
  PASS=false
elif ! printf '%s\n' "$A1_LINES" | grep -F "lock" >/dev/null 2>&1; then
  echo "    ✗ fail — unrelated agent debt was removed from $FINDINGS"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[11.D1 unit tests prove session agent envelopes]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: pnpm exec vitest run $UNIT_TEST"
  PASS=false
fi

echo "[11.E1 honest E2E proves session agent envelopes]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: pnpm exec vitest run $HONEST_TEST"
  PASS=false
fi

echo "[11.E2 honest proof does not widen Goal 7 UC set]"
if [ -f "$HONEST_TEST" ] &&
   basename "$HONEST_TEST" | grep -E '^UC-' >/dev/null 2>&1; then
  echo "    ✗ fail — session agent proof must be verb-level, not UC-prefixed"
  PASS=false
elif awk 'index($0, "HONEST_UC_SET=(") { capture=1; next } capture && /^\)/ { capture=0 } capture { print }' \
    goals/7-cli-spec-parity.gates.sh | grep -E 'session|agent-format|Goal 11' >/dev/null 2>&1; then
  echo "    ✗ fail — HONEST_UC_SET was widened for Goal 11"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[11.F1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/11-session-agent-format.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/11-session-agent-format.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
