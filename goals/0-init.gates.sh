#!/usr/bin/env bash
# goals/0-init.gates.sh — Gate suite for goal 0 (MVP via TDD).
# Mirrors the four conditions documented in goals/0-init.md.
# Exits 0 only if every gate passes. Prints per-gate status to stdout.
#
# Gate 0.2 ("Tests + Coverage") combines what used to be two separate gates:
# `vitest run` and `vitest run --coverage`. The coverage run exits non-zero
# on either test failure or threshold breach, so it strictly subsumes the
# bare run.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="0-init"

if gate_cache_hit "$GOAL_NAME"; then
  echo "[cache hit] goal $GOAL_NAME passed at $(gate_cache_sha "$GOAL_NAME")"
  exit 0
fi

PASS=true

# ---------- Gate 1: structural ----------
echo "[0.1/5] Structural check..."
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

# ---------- Gate 2: tests + coverage ----------
echo "[0.2/5] Tests + coverage check..."
if [ -f package.json ]; then
  if pnpm exec vitest run --coverage >/dev/null 2>&1; then
    echo "    ✓ All tests pass and coverage thresholds met"
  else
    echo "    ✗ Tests failing or coverage below thresholds (per vitest.config.ts)"
    PASS=false
  fi
else
  echo "    ⚠ No package.json — skip"
  PASS=false
fi

# ---------- Gate 3: integrity ----------
echo "[0.3/5] Integrity check..."
if bash "$ROOT/scripts/check-bypass.sh" >/dev/null 2>&1; then
  echo "    ✓ No bypass patterns"
else
  echo "    ✗ Bypass patterns detected"
  bash "$ROOT/scripts/check-bypass.sh" | sed 's/^/      /'
  PASS=false
fi

# ---------- Gate 4: lint + type ----------
echo "[0.4/5] Lint & type check..."
if [ -f package.json ]; then
  if pnpm exec tsc --noEmit >/dev/null 2>&1; then
    echo "    ✓ TypeScript clean"
  else
    echo "    ✗ TypeScript errors"
    PASS=false
  fi
  if pnpm exec eslint . >/dev/null 2>&1; then
    echo "    ✓ ESLint clean"
  else
    echo "    ✗ ESLint errors"
    PASS=false
  fi
else
  echo "    ⚠ No package.json — skip"
  PASS=false
fi

# ---------- Gate 5: dogfooding ----------
echo "[0.5/5] Self-dogfooding..."
if [ -f "$ROOT/scripts/dogfood-test.sh" ] && bash "$ROOT/scripts/dogfood-test.sh" >/dev/null 2>&1; then
  echo "    ✓ vspec manages its own use cases"
else
  echo "    ✗ Self-dogfooding failed (or not yet runnable)"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME"
  exit 0
else
  exit 1
fi
