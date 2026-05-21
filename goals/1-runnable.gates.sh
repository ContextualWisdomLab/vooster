#!/usr/bin/env bash
# goals/1-runnable.gates.sh — Gate suite for goal 1 (make vspec runnable).
# Mirrors the six conditions documented in goals/1-runnable.md.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="1-runnable"

# Inputs that determine this goal's gate result.
# Gates exercised: check-bootable.sh, check-persistence.sh, check-cli.sh,
# CLI E2E vitest run, check-layers.sh, plus goal-0 regression (whose own
# input list covers its own surface — we still re-list shared files so a
# tsconfig/eslint tweak invalidates here too).
GATE_INPUTS=(
  apps/api/src
  apps/api/tests
  apps/api/prisma
  apps/api/package.json
  apps/api/tsconfig.json
  apps/cli/src
  apps/cli/tests
  apps/cli/bin
  apps/cli/package.json
  apps/cli/tsconfig.json
  docs/usecases
  package.json
  pnpm-lock.yaml
  tsconfig.json
  tsconfig.eslint.json
  vitest.config.ts
  eslint.config.js
  scripts/check-bootable.sh
  scripts/check-persistence.sh
  scripts/check-cli.sh
  scripts/check-layers.sh
  scripts/check-bypass.sh
  scripts/dogfood-test.sh
  scripts/dogfood-smoke.ts
  goals/0-init.gates.sh
  goals/1-runnable.gates.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

run_gate() {
  local label="$1"
  local cmd="$2"
  echo "[$label]"
  if bash -c "$cmd" >/dev/null 2>&1; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — re-run for detail: $cmd"
    PASS=false
  fi
}

run_gate "1.1/6 Bootable"    "$ROOT/scripts/check-bootable.sh"
run_gate "1.2/6 Persistence" "$ROOT/scripts/check-persistence.sh"
run_gate "1.3/6 CLI binary"  "$ROOT/scripts/check-cli.sh"

echo "[1.4/6 CLI E2E]"
if [ -d apps/cli/tests/e2e-cli ] && [ "$(find apps/cli/tests/e2e-cli -name 'UC-*.test.ts' 2>/dev/null | wc -l | tr -d ' ')" -gt 0 ]; then
  UC_COUNT=$(ls docs/usecases/UC-*.md 2>/dev/null | wc -l | tr -d ' ')
  CLI_COUNT=$(find apps/cli/tests/e2e-cli -name 'UC-*.test.ts' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$CLI_COUNT" -ge "$UC_COUNT" ] \
      && pnpm exec vitest run apps/cli/tests/e2e-cli >/dev/null 2>&1; then
    echo "    ✓ pass ($CLI_COUNT/$UC_COUNT CLI E2E files, all green)"
  else
    echo "    ✗ fail — expected $UC_COUNT CLI E2E files, found $CLI_COUNT (or tests failing)"
    PASS=false
  fi
else
  echo "    ✗ fail — apps/cli/tests/e2e-cli/ is missing or empty"
  PASS=false
fi

run_gate "1.5/6 Layers"      "$ROOT/scripts/check-layers.sh"

echo "[1.6/6 No goal-0 regression]"
if bash "$ROOT/goals/0-init.gates.sh" >/dev/null 2>&1; then
  echo "    ✓ goal-0 still green"
else
  echo "    ✗ goal-0 regressed — fix before continuing goal 1"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
