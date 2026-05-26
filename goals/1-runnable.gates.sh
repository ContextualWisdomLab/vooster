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
# CLI E2E file presence (vitest run moved to goals/_meta.gates.sh M.3),
# check-layers.sh. Prior-goal regression lives in scripts/completion-check.sh.
GATE_INPUTS=(
  apps/api/src
  apps/api/tests
  apps/api/prisma
  apps/api/package.json
  apps/cli/src
  apps/cli/tests
  apps/cli/bin
  apps/cli/package.json
  docs/usecases
  package.json
  pnpm-lock.yaml
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

# 1.1 + 1.2 boot the built API (dist/apps/api/src/index.js), produced by
# goals/_meta.gates.sh M.4 — skipped under VSPEC_GATES_SKIP_DEEP=1 (the
# fast/default chain). Skip these consumers in lockstep so a source-only
# local push is not failed by a build it never produced. CI (SKIP_DEEP=0)
# builds first and enforces. See
# docs/findings/2026-05-26T1333-build-artifact-precondition-gates.md.
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "[1.1/5 Bootable]"
  echo "    ⊘ skipped (VSPEC_GATES_SKIP_DEEP=1 — M.4 build not run)"
  echo "[1.2/5 Persistence]"
  echo "    ⊘ skipped (VSPEC_GATES_SKIP_DEEP=1 — M.4 build not run)"
else
  run_gate "1.1/5 Bootable"    "$ROOT/scripts/check-bootable.sh"
  run_gate "1.2/5 Persistence" "$ROOT/scripts/check-persistence.sh"
fi
run_gate "1.3/5 CLI binary"  "$ROOT/scripts/check-cli.sh"

echo "[1.4/5 CLI E2E files present]"
# Iteration is over UCs in docs/usecases/. The "tests pass" half is
# enforced by goals/_meta.gates.sh (M.3); this gate only proves that
# every UC has a corresponding CLI E2E file.
if [ ! -d apps/cli/tests/e2e-cli ]; then
  echo "    ✗ fail — apps/cli/tests/e2e-cli/ missing"
  PASS=false
else
  UC_COUNT=$(ls docs/usecases/UC-*.md 2>/dev/null | wc -l | tr -d ' ')
  CLI_COUNT=$(find apps/cli/tests/e2e-cli -name 'UC-*.test.ts' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$CLI_COUNT" -lt "$UC_COUNT" ]; then
    echo "    ✗ fail — file count: expected $UC_COUNT CLI E2E files, found $CLI_COUNT"
    PASS=false
  else
    echo "    ✓ pass ($CLI_COUNT/$UC_COUNT CLI E2E files present)"
  fi
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
