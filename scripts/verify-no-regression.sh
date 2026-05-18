#!/usr/bin/env bash
# verify-no-regression.sh — Compare current passing tests against last baseline.
# If decreased, prints offending commit and recommends rollback.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STATE="$ROOT/.state"
mkdir -p "$STATE"
BASELINE="$STATE/passing_tests.txt"

if [ ! -f package.json ]; then
  echo "verify-no-regression: no package.json — OK."
  exit 0
fi

CURRENT=$(node "$ROOT/scripts/_count-passing.mjs" 2>/dev/null | tail -1 || echo 0)
case "$CURRENT" in ''|*[!0-9]*) CURRENT=0 ;; esac
PREV=$(cat "$BASELINE" 2>/dev/null || echo 0)
case "$PREV" in ''|*[!0-9]*) PREV=0 ;; esac

if [ "$CURRENT" -lt "$PREV" ]; then
  echo "⛔ REGRESSION: was $PREV passing, now $CURRENT."
  echo "  Offending commit: $(git log -1 --pretty='%h %s')"
  echo "  Recommended: git revert HEAD (do NOT reset --hard)"
  exit 1
fi

echo "$CURRENT" > "$BASELINE"
echo "✓ verify-no-regression: $CURRENT >= $PREV"
exit 0
