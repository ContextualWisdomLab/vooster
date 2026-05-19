#!/usr/bin/env bash
# goals/0-init.gates.sh — Gate suite for goal 0 (MVP via TDD).
# Mirrors the four conditions documented in goals/0-init.md.
# Exits 0 only if every gate passes. Prints per-gate status to stdout.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=true

# ---------- Gate 1: structural ----------
echo "[0.1/6] Structural check..."
MISSING_TESTS=0
for f in docs/usecases/UC-*.md; do
  [ -f "$f" ] || continue
  UC_ID=$(basename "$f" | grep -oE "UC-[0-9]+" | head -1)
  if [ ! -f "tests/e2e/${UC_ID}.test.ts" ]; then
    echo "    ✗ Missing test for $UC_ID"
    MISSING_TESTS=$((MISSING_TESTS+1))
    PASS=false
  fi
done
if [ "$MISSING_TESTS" -eq 0 ]; then
  echo "    ✓ All UC test files present"
fi

# ---------- Gate 2: functional ----------
echo "[0.2/6] Functional check..."
if [ -f package.json ] && npx --no-install vitest run >/dev/null 2>&1; then
  echo "    ✓ All tests pass"
else
  echo "    ✗ Some tests failing (or no scaffolding)"
  PASS=false
fi

# ---------- Gate 3: integrity ----------
echo "[0.3/6] Integrity check..."
if bash "$ROOT/scripts/check-bypass.sh" >/dev/null 2>&1; then
  echo "    ✓ No bypass patterns"
else
  echo "    ✗ Bypass patterns detected"
  bash "$ROOT/scripts/check-bypass.sh" | sed 's/^/      /'
  PASS=false
fi

# ---------- Gate 4: lint + type ----------
echo "[0.4/6] Lint & type check..."
if [ -f package.json ]; then
  if npx --no-install tsc --noEmit >/dev/null 2>&1; then
    echo "    ✓ TypeScript clean"
  else
    echo "    ✗ TypeScript errors"
    PASS=false
  fi
  if npx --no-install eslint . >/dev/null 2>&1; then
    echo "    ✓ ESLint clean"
  else
    echo "    ✗ ESLint errors"
    PASS=false
  fi
else
  echo "    ⚠ No package.json — skip"
  PASS=false
fi

# ---------- Gate 5: coverage ----------
echo "[0.5/6] Coverage check..."
if [ -f package.json ]; then
  if npx --no-install vitest run --coverage >/dev/null 2>&1; then
    echo "    ✓ Coverage thresholds met (per vitest.config.ts)"
  else
    echo "    ✗ Coverage below thresholds (or run failed)"
    PASS=false
  fi
else
  echo "    ⚠ No package.json — skip"
  PASS=false
fi

# ---------- Gate 6: dogfooding ----------
echo "[0.6/6] Self-dogfooding..."
if [ -f "$ROOT/scripts/dogfood-test.sh" ] && bash "$ROOT/scripts/dogfood-test.sh" >/dev/null 2>&1; then
  echo "    ✓ vspec manages its own use cases"
else
  echo "    ✗ Self-dogfooding failed (or not yet runnable)"
  PASS=false
fi

if [ "$PASS" = true ]; then
  exit 0
else
  exit 1
fi
