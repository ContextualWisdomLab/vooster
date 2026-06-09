#!/usr/bin/env bash
# goals/47-dogfood-step-edit-failure-leaks-an-opaque-409-and-the-agen.gates.sh
# `vspec step edit` failures must render through the shared status-bearing
# envelope (status:"ok"/"error", classified error.code, suggested next actions)
# instead of leaking a raw ApiError / a status-less agent payload.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="47-dogfood-step-edit-failure-leaks-an-opaque-409-and-the-agen"
GATE_INPUTS=(
  apps/cli/src
  apps/cli/src/commands/step.ts
  apps/cli/src/application/mutation-runner.ts
  apps/cli/src/domain/envelope.ts
  apps/api/src
  apps/api/src/http/step-results.ts
  apps/cli/tests/unit/step-edit-envelope.test.ts
  apps/cli/tests/unit/step-agent-format.test.ts
  apps/api/tests/unit/http/step-edit-conflict-problem.test.ts
  apps/api/tests/unit/http/step-results.test.ts
  docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-001-step-edit-failure-leaks-an-opaque-409-and-t.md
  goals/47-dogfood-step-edit-failure-leaks-an-opaque-409-and-the-agen.md
  goals/47-dogfood-step-edit-failure-leaks-an-opaque-409-and-the-agen.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[47.A1] API typecheck"
if pnpm --filter @vooster/api typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[47.A2] CLI typecheck (edit routed through the shared mutation runner resolves)"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[47.A3] edit-envelope + conflict-shape suites pass (existing step suites stay green)"
if pnpm exec vitest run \
  apps/cli/tests/unit/step-edit-envelope.test.ts \
  apps/cli/tests/unit/step-agent-format.test.ts \
  apps/api/tests/unit/http/step-edit-conflict-problem.test.ts \
  apps/api/tests/unit/http/step-results.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[47.B1] no step write path bypasses the shared status-bearing envelope"
# Negative universal invariant: a single-path behavior test cannot cover a step
# write path it does not exercise (nor a future one), so it cannot prove the
# top-level `status` is *always* present and a raw exception never leaks. Two
# bypasses break the contract, so the step command surface must reference
# neither -- it must route every write through the shared mutation runner:
#   - buildAgentEnvelope: the legacy status-less envelope builder
#     (apps/cli/src/agent-envelope.ts); its payload has no top-level `status`.
#   - patchJson: the raw http client, used directly, escapes runMutation's
#     ApiError catch -> the exception string leaks instead of an error envelope.
# Loop over the bypass set and assert the step command uses none. (for-loop, not
# mapfile -- system bash is 3.2 and lacks readarray.)
STEP_CMD="apps/cli/src/commands/step.ts"
BYPASS_SYMBOLS=(buildAgentEnvelope patchJson)
if [ ! -f "$STEP_CMD" ]; then
  echo "    fail -- $STEP_CMD is missing"
  PASS=false
else
  for sym in "${BYPASS_SYMBOLS[@]}"; do
    if grep -qE "\\b$sym\\b" "$STEP_CMD"; then
      echo "    fail -- $STEP_CMD still references $sym; a step write can bypass the status-bearing envelope"
      PASS=false
    else
      echo "    ok: $STEP_CMD does not reference $sym"
    fi
  done
fi

echo "[47.C1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/$GOAL_NAME.md" >/dev/null 2>&1; then
  echo "    pass"
else
  echo "    fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/$GOAL_NAME.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
