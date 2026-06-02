#!/usr/bin/env bash
# goals/38-deterministic-verify.gates.sh -- deterministic verify command.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="38-deterministic-verify"
GATE_INPUTS=(
  docs/07-cli-spec.md
  apps/cli/src/commands/verify.ts
  apps/cli/src/index.ts
  apps/cli/src/cli-help.ts
  apps/cli/tests/unit/verify-command.test.ts
  apps/cli/tests/unit/dispatcher-routes.test.ts
  goals/38-deterministic-verify.md
  goals/38-deterministic-verify.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[38.A1] CLI typecheck covers verify command types"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[38.A2] verify behavior and dispatcher tests pass"
if pnpm exec vitest run \
  apps/cli/tests/unit/verify-command.test.ts \
  apps/cli/tests/unit/dispatcher-routes.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[38.C1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/38-deterministic-verify.md" >/dev/null 2>&1; then
  echo "    pass"
else
  echo "    fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/38-deterministic-verify.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
