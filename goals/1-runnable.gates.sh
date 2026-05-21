#!/usr/bin/env bash
# goals/1-runnable.gates.sh — Gate suite for goal 1 (make vspec runnable).
# Mirrors the six conditions documented in goals/1-runnable.md.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="1-runnable"

if gate_cache_hit "$GOAL_NAME"; then
  echo "[cache hit] goal $GOAL_NAME passed at $(gate_cache_sha "$GOAL_NAME")"
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
  gate_cache_save "$GOAL_NAME"
  exit 0
else
  exit 1
fi
