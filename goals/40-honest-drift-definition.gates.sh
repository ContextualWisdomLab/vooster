#!/usr/bin/env bash
# goals/40-honest-drift-definition.gates.sh -- honest drift definition.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="40-honest-drift-definition"
GATE_INPUTS=(
  apps/cli/src/commands/verify.ts
  apps/cli/tests/unit/verify-command.test.ts
  apps/www/src/components/sections/HowItWorks.astro
  apps/www/src/components/sections/Onboarding.astro
  apps/www/tests/unit/landing-drift-copy.test.ts
  docs/07-cli-spec.md
  goals/40-honest-drift-definition.md
  goals/40-honest-drift-definition.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[40.A1] CLI typecheck covers verify drift output"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[40.A2] web typecheck covers landing copy edits"
if pnpm --filter @vooster/www typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[40.A3] drift output and landing copy tests pass"
if pnpm exec vitest run \
  apps/cli/tests/unit/verify-command.test.ts \
  apps/www/tests/unit/landing-drift-copy.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[40.B1] CLI spec labels drift as non-semantic"
if rg -q 'not semantic mismatch detection' docs/07-cli-spec.md &&
  rg -q 'broken_link.*failing_test.*unlinked_step' docs/07-cli-spec.md; then
  echo "    pass"
else
  echo "    fail -- docs/07-cli-spec.md does not define deterministic drift scope"
  PASS=false
fi

echo "[40.C1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/40-honest-drift-definition.md" >/dev/null 2>&1; then
  echo "    pass"
else
  echo "    fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/40-honest-drift-definition.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
