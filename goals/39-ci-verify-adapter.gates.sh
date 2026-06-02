#!/usr/bin/env bash
# goals/39-ci-verify-adapter.gates.sh -- CI verify adapter.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="39-ci-verify-adapter"
GATE_INPUTS=(
  action.yml
  .github/workflows/vspec-verify.yml
  docs/07-cli-spec.md
  apps/cli/src/commands/init.ts
  apps/cli/src/cli-help.ts
  apps/cli/tests/unit/init-command.test.ts
  apps/cli/tests/unit/verify-action.test.ts
  goals/39-ci-verify-adapter.md
  goals/39-ci-verify-adapter.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[39.A1] CLI typecheck covers init workflow option"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[39.A2] init workflow and action tests pass"
if pnpm exec vitest run \
  apps/cli/tests/unit/init-command.test.ts \
  apps/cli/tests/unit/verify-action.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[39.B1] action and workflow invoke deterministic verify"
if rg -q 'using: composite' action.yml &&
  rg -q 'apps/cli/bin/run\.js" verify' action.yml &&
  rg -q 'uses: \./' .github/workflows/vspec-verify.yml &&
  rg -q 'actions/github-script@v7' .github/workflows/vspec-verify.yml; then
  echo "    pass"
else
  echo "    fail -- action/workflow adapter contract missing"
  PASS=false
fi

echo "[39.B2] init advertises workflow generation"
if rg -q -- '--verify-workflow' apps/cli/src/commands/init.ts apps/cli/src/cli-help.ts docs/07-cli-spec.md; then
  echo "    pass"
else
  echo "    fail -- init workflow option is not documented and implemented"
  PASS=false
fi

echo "[39.C1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/39-ci-verify-adapter.md" >/dev/null 2>&1; then
  echo "    pass"
else
  echo "    fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/39-ci-verify-adapter.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
