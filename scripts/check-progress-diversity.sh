#!/usr/bin/env bash
# check-progress-diversity.sh — Detect stuck patterns (same file edited many commits).

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

COMMITS=$(git log --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$COMMITS" -lt 5 ]; then
  exit 0
fi

DIVERSITY=$(git diff --name-only HEAD~5 HEAD 2>/dev/null | sort -u | wc -l | tr -d ' ')

if [ "$DIVERSITY" -lt 2 ]; then
  echo "⚠ check-progress-diversity: only $DIVERSITY distinct file(s) in last 5 commits."
  echo "  You may be stuck. Consider:"
  echo "    1. Document the blocker in docs/state/blockers.md"
  echo "    2. Run scripts/next-task.sh and move to a different UC"
  exit 1
fi

echo "✓ check-progress-diversity: $DIVERSITY distinct files touched in last 5 commits."
exit 0
