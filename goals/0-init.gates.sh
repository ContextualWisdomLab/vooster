#!/usr/bin/env bash
# goals/0-init.gates.sh — Gate suite for goal 0 (MVP via TDD).
# Mirrors the conditions documented in goals/0-init.md.
# Exits 0 only if every gate passes. Prints per-gate status to stdout.
#
# Cross-cutting checks (lint, tsc, vitest + coverage) used to live here
# as gates 0.2 and 0.4. They now live in goals/_meta.gates.sh
# (M.1/M.2/M.3) and are enforced once per sweep instead of once per goal.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="0-init"

# Inputs whose contents determine this goal's gate result.
# Gates exercised: UC-presence sweep, check-bypass.sh, dogfood-test.sh.
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
  scripts/check-bypass.sh
  scripts/dogfood-test.sh
  scripts/dogfood-smoke.ts
  goals/0-init.gates.sh
  goals/0-init.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

# ---------- Gate 0.1: structural (UC ↔ E2E presence) ----------
echo "[0.1/3] Structural check..."
MISSING_TESTS=0
for f in docs/usecases/UC-*.md; do
  [ -f "$f" ] || continue
  UC_ID=$(basename "$f" | grep -oE "UC-[0-9]+" | head -1)
  if [ ! -f "apps/api/tests/e2e/${UC_ID}.test.ts" ]; then
    echo "    ✗ Missing test for $UC_ID"
    MISSING_TESTS=$((MISSING_TESTS+1))
    PASS=false
  fi
done
if [ "$MISSING_TESTS" -eq 0 ]; then
  echo "    ✓ All UC test files present"
fi

# ---------- Gate 0.2: integrity (no bypass patterns) ----------
echo "[0.2/3] Integrity check..."
if bash "$ROOT/scripts/check-bypass.sh" >/dev/null 2>&1; then
  echo "    ✓ No bypass patterns"
else
  echo "    ✗ Bypass patterns detected"
  bash "$ROOT/scripts/check-bypass.sh" | sed 's/^/      /'
  PASS=false
fi

# ---------- Gate 0.3: dogfooding ----------
# dogfood-test.sh consumes the dist/ build owned by goals/_meta.gates.sh
# M.4, which is skipped under VSPEC_GATES_SKIP_DEEP=1 (the fast/default
# chain). Run it only when M.4 also runs, so a source-only local push is
# not failed by a build it never produced. CI (SKIP_DEEP=0) builds first
# and enforces this. See
# docs/findings/2026-05-26T1333-build-artifact-precondition-gates.md.
echo "[0.3/3] Self-dogfooding..."
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "    ⊘ skipped (VSPEC_GATES_SKIP_DEEP=1 — M.4 build not run)"
elif [ -f "$ROOT/scripts/dogfood-test.sh" ] && bash "$ROOT/scripts/dogfood-test.sh" >/dev/null 2>&1; then
  echo "    ✓ vspec manages its own use cases"
else
  echo "    ✗ Self-dogfooding failed (or not yet runnable)"
  PASS=false
fi

# Cross-cutting checks (lint, tsc, vitest + coverage) are enforced by
# goals/_meta.gates.sh — M.1 (tsc), M.2 (eslint), M.3 (vitest + coverage).

if [ "$PASS" = true ]; then
  if [ "${VSPEC_GATES_SKIP_DEEP:-}" != "1" ]; then
    gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  fi
  exit 0
else
  exit 1
fi
