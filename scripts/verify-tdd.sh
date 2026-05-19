#!/usr/bin/env bash
# verify-tdd.sh — Enforce TDD commit pattern.
# Run after every commit. Exits non-zero if the protocol is violated.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ALLOWED='^(red|green|refactor|setup|docs|chore|fix|feat|test|perf|build|ci|revert)(\([^)]+\))?: '
LAST_MSG=$(git log -1 --pretty=%s 2>/dev/null || echo "")

if [ -z "$LAST_MSG" ]; then
  echo "verify-tdd: no commits yet — OK."
  exit 0
fi

if ! echo "$LAST_MSG" | grep -qE "$ALLOWED"; then
  echo "✗ verify-tdd: last commit message does not match allowed prefixes."
  echo "  Got:      $LAST_MSG"
  echo "  Expected: <type>[(<scope>)]: <text>  where <type> ∈ red,green,refactor,setup,docs,chore,fix,feat,test,perf,build,ci,revert"
  exit 1
fi

PREFIX=$(echo "$LAST_MSG" | grep -oE '^[a-z]+' | head -1):

case "$PREFIX" in
  green:)
    # A green commit must be preceded by a matching red within 5 commits.
    # UC-scoped work uses `green: UC-NNN ...`; goal-level work uses
    # `green(scope): ...` as documented by goal 1.
    UC_ID=$(echo "$LAST_MSG" | grep -oE 'UC-[0-9]+' | head -1)
    SCOPE=$(echo "$LAST_MSG" | sed -n 's/^green(\([^)]*\)): .*/\1/p')
    if [ -n "$UC_ID" ]; then
      if ! git log -6 --pretty=%s | tail -5 | grep -qE "^red: $UC_ID"; then
        echo "✗ verify-tdd: green: $UC_ID has no preceding red: $UC_ID within last 5 commits."
        exit 1
      fi
    elif [ -n "$SCOPE" ]; then
      if ! git log -6 --pretty=%s | tail -5 | grep -qE "^red\\($SCOPE\\):"; then
        echo "✗ verify-tdd: green($SCOPE) has no preceding red($SCOPE) within last 5 commits."
        exit 1
      fi
    else
      echo "✗ verify-tdd: green commit missing UC-ID or scope."
      echo "  Got: $LAST_MSG"
      exit 1
    fi
    ;;
  refactor:)
    # Refactor must keep all tests green. We cannot easily verify retroactively;
    # just enforce there is at least one prior green: in history.
    if ! git log --pretty=%s | awk '/^green:/ { found=1 } END { exit !found }'; then
      echo "✗ verify-tdd: refactor: with no prior green: commit."
      exit 1
    fi
    ;;
  red:)
    # Red commits should reference either a UC-ID or a goal-level scope.
    if ! echo "$LAST_MSG" | grep -qE 'UC-[0-9]+|^red\([^)]+\):'; then
      echo "⚠ verify-tdd: red commit lacks UC-ID or scope."
    fi
    ;;
esac

# Test count must not have decreased compared to recorded baseline.
STATE_DIR="$ROOT/.state"
mkdir -p "$STATE_DIR"
BASELINE="$STATE_DIR/passing_tests.txt"
LATEST_TDD_PHASE=$(git log --pretty=%s | awk '/^(red|green|refactor):/ { print $1; exit }')
if [ "$LATEST_TDD_PHASE" = "red:" ]; then
  echo "verify-tdd: red phase active; skip passing test count baseline."
elif [ -f package.json ] && command -v node >/dev/null 2>&1; then
  CURRENT=$(node "$ROOT/scripts/_count-passing.mjs" 2>/dev/null | tail -1 || echo 0)
  # Treat empty/non-numeric as 0; never crash here.
  case "$CURRENT" in ''|*[!0-9]*) CURRENT=0 ;; esac
  PREV=$(cat "$BASELINE" 2>/dev/null || echo 0)
  case "$PREV" in ''|*[!0-9]*) PREV=0 ;; esac
  if [ "$CURRENT" -lt "$PREV" ]; then
    echo "✗ verify-tdd: passing test count decreased ($PREV → $CURRENT). Regression?"
    exit 1
  fi
  echo "$CURRENT" > "$BASELINE"
fi

echo "✓ verify-tdd: protocol respected."
exit 0
