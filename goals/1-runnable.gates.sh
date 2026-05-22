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
# CLI E2E vitest run, check-layers.sh. Prior-goal regression lives in
# scripts/completion-check.sh; this goal's cache only invalidates on its
# own surface.
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
  goals/1-runnable.gates.sh
  goals/1-runnable.md
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

run_gate "1.1/5 Bootable"    "$ROOT/scripts/check-bootable.sh"
run_gate "1.2/5 Persistence" "$ROOT/scripts/check-persistence.sh"
run_gate "1.3/5 CLI binary"  "$ROOT/scripts/check-cli.sh"

echo "[1.4/5 CLI E2E]"
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "    ⊘ skipped (VSPEC_GATES_SKIP_DEEP=1)"
elif [ -d apps/cli/tests/e2e-cli ] && [ "$(find apps/cli/tests/e2e-cli -name 'UC-*.test.ts' 2>/dev/null | wc -l | tr -d ' ')" -gt 0 ]; then
  UC_COUNT=$(ls docs/usecases/UC-*.md 2>/dev/null | wc -l | tr -d ' ')
  CLI_COUNT=$(find apps/cli/tests/e2e-cli -name 'UC-*.test.ts' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$CLI_COUNT" -lt "$UC_COUNT" ]; then
    echo "    ✗ fail — file count: expected $UC_COUNT CLI E2E files, found $CLI_COUNT"
    PASS=false
  elif ! pnpm exec vitest run apps/cli/tests/e2e-cli >/dev/null 2>&1; then
    echo "    ✗ fail — CLI E2E vitest suite is red ($CLI_COUNT/$UC_COUNT files present)"
    PASS=false
  else
    echo "    ✓ pass ($CLI_COUNT/$UC_COUNT CLI E2E files, all green)"
  fi
else
  echo "    ✗ fail — apps/cli/tests/e2e-cli/ is missing or empty"
  PASS=false
fi

run_gate "1.5/5 Layers"      "$ROOT/scripts/check-layers.sh"

# Prior-goal regression is enforced by scripts/completion-check.sh; this
# script only asserts goal-1's own surface. Run completion-check.sh for
# the full chain.

if [ "$PASS" = true ]; then
  if [ "${VSPEC_GATES_SKIP_DEEP:-}" != "1" ]; then
    gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  fi
  exit 0
else
  exit 1
fi
