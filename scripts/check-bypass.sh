#!/usr/bin/env bash
# check-bypass.sh — Reject banned test patterns.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0
TESTS=$(find tests -name '*.test.ts' 2>/dev/null)

if [ -z "$TESTS" ]; then
  echo "check-bypass: no tests yet — OK."
  exit 0
fi

# 1. Tautological assertions
if grep -nE 'expect\(\s*true\s*\)\.toBe\(\s*true\s*\)' $TESTS 2>/dev/null; then
  echo "✗ check-bypass: tautological 'expect(true).toBe(true)' found."
  FAIL=1
fi
if grep -nE 'expect\(\s*1\s*\)\.toBe\(\s*1\s*\)' $TESTS 2>/dev/null; then
  echo "✗ check-bypass: tautological 'expect(1).toBe(1)' found."
  FAIL=1
fi

# 2. Skipped / todo tests on main
if grep -nE '\.(skip|todo)\(' $TESTS 2>/dev/null; then
  echo "✗ check-bypass: .skip / .todo present in tests."
  FAIL=1
fi
if grep -nE '\b(xit|xtest|xdescribe)\(' $TESTS 2>/dev/null; then
  echo "✗ check-bypass: xit/xtest/xdescribe present in tests."
  FAIL=1
fi

# 3. Test file with no expect
for f in $TESTS; do
  if ! grep -qE 'expect\(' "$f"; then
    if grep -qE '\b(test|it|describe)\(' "$f"; then
      echo "✗ check-bypass: $f has test() blocks but no expect()."
      FAIL=1
    fi
  fi
done

# 4. E2E mocking application/domain
E2E=$(find apps/api/tests/e2e -name '*.test.ts' 2>/dev/null)
if [ -n "$E2E" ]; then
  if grep -nE "vi\.mock\(['\"](\.\./)*(\.\./)*src/(application|domain)/" $E2E 2>/dev/null; then
    echo "✗ check-bypass: E2E test mocks apps/api/src/application or apps/api/src/domain."
    FAIL=1
  fi
fi

# 5. Always-true negation
if grep -nE 'expect\([^)]*\)\.not\.toBe\(undefined\)\s*;\s*$' $TESTS 2>/dev/null | head -3 >/dev/null; then
  : # too noisy to fail on; informational only
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "✓ check-bypass: no banned patterns."
exit 0
