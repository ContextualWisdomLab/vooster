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
    # A green: commit must be preceded by a red: for the same UC-ID within 5 commits.
    UC_ID=$(echo "$LAST_MSG" | grep -oE 'UC-[0-9]+' | head -1)
    if [ -z "$UC_ID" ]; then
      echo "✗ verify-tdd: green: commit missing UC-ID."
      echo "  Got: $LAST_MSG"
      exit 1
    fi
    if ! git log -6 --pretty=%s | tail -5 | grep -qE "^red: $UC_ID"; then
      echo "✗ verify-tdd: green: $UC_ID has no preceding red: $UC_ID within last 5 commits."
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
    # Red commits should reference a UC-ID and the working tree should leave
    # at least one failing test (best-effort; we run quickly).
    if ! echo "$LAST_MSG" | grep -qE 'UC-[0-9]+'; then
      echo "⚠ verify-tdd: red: commit lacks UC-ID. Recommended pattern: 'red: UC-NNN <desc>'."
    fi
    ;;
esac

# Test count must not have decreased compared to recorded baseline.
STATE_DIR="$ROOT/.state"
mkdir -p "$STATE_DIR"
BASELINE="$STATE_DIR/passing_tests.txt"
if [ -f package.json ] && command -v node >/dev/null 2>&1; then
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
