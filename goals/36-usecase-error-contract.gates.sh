#!/usr/bin/env bash
# goals/36-usecase-error-contract.gates.sh — typed self-teaching usecase errors.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="36-usecase-error-contract"
GATE_INPUTS=(
  packages/contracts/src/common.ts
  apps/api/src/http/usecase-routes.ts
  apps/api/src/http/usecase-results.ts
  apps/api/src/http/usecase-validation-problem.ts
  apps/api/tests/integration/http/usecase-route.test.ts
  apps/api/tests/unit/http/usecase-results.test.ts
  apps/cli/src/domain/error-codes.ts
  apps/cli/tests/unit/error-codes.test.ts
  goals/36-usecase-error-contract.md
  goals/36-usecase-error-contract.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[36.A1] contracts package builds for runtime exports"
if pnpm --filter @vooster/contracts build; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  PASS=false
fi

echo "[36.A2] usecase API and CLI error-code tests pass"
if pnpm exec vitest run \
  apps/api/tests/integration/http/usecase-route.test.ts \
  apps/api/tests/unit/http/usecase-results.test.ts \
  apps/cli/tests/unit/error-codes.test.ts; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  PASS=false
fi

echo "[36.B1] CLI usecase classification has no problem-title literals"
if rg -q "Use case title should be a verb phrase|Primary actor is not available" \
  apps/cli/src/domain/error-codes.ts; then
  echo "    ✗ fail — title literals still drive CLI error classification"
  PASS=false
else
  echo "    ✓ pass"
fi

echo "[36.C1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/36-usecase-error-contract.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/36-usecase-error-contract.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
