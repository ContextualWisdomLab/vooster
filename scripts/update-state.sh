#!/usr/bin/env bash
# update-state.sh — Refresh docs/state/* based on git + test status.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STATE="$ROOT/docs/state"
mkdir -p "$STATE"

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
COMMITS=$(git log --oneline 2>/dev/null | wc -l | tr -d ' ')
LAST=$(git log -1 --pretty='%h %s' 2>/dev/null || echo '(none)')

TOTAL=0
COMPLETED=0
declare -a ROWS
for f in $(ls docs/usecases/UC-*.md 2>/dev/null | sort); do
  TOTAL=$((TOTAL+1))
  UC_ID=$(basename "$f" | grep -oE "UC-[0-9]+" | head -1)
  TITLE=$(grep -m1 '^title:' "$f" 2>/dev/null | sed 's/^title:[[:space:]]*//' || echo "")
  TEST_FILE="tests/e2e/${UC_ID}.test.ts"
  STATUS="○ NOT STARTED"
  TESTS="0/0"
  if [ -f "$TEST_FILE" ]; then
    TEST_COUNT=$(grep -cE '\b(test|it)\(' "$TEST_FILE" 2>/dev/null || echo 0)
    if npx --no-install vitest run "$TEST_FILE" --reporter=dot >/dev/null 2>&1; then
      STATUS="✓ DONE"
      COMPLETED=$((COMPLETED+1))
      TESTS="$TEST_COUNT/$TEST_COUNT"
    else
      STATUS="⚙ IN PROGRESS"
      TESTS="?/$TEST_COUNT"
    fi
  fi
  ROWS+=("| $UC_ID | $TITLE | $STATUS | $TESTS |")
done

{
  echo "# Progress Matrix"
  echo ""
  echo "_Last updated: ${NOW}_"
  echo ""
  echo "## Overall"
  echo ""
  echo "- Commits: $COMMITS"
  echo "- Last commit: $LAST"
  echo "- Use cases complete: $COMPLETED / $TOTAL"
  echo ""
  echo "## By Use Case"
  echo ""
  echo "| ID | Title | Status | Tests |"
  echo "| --- | --- | --- | --- |"
  for r in "${ROWS[@]}"; do echo "$r"; done
} > "$STATE/progress.md"

# Update next-task.md by piping next-task.sh output.
{
  echo "# Next Task"
  echo ""
  echo "_Auto-generated $NOW. Do not hand-edit; use blockers.md for overrides._"
  echo ""
  echo '```'
  bash "$ROOT/scripts/next-task.sh"
  echo '```'
} > "$STATE/next-task.md"

# Ensure blockers/learnings exist.
[ -f "$STATE/blockers.md" ] || cat > "$STATE/blockers.md" <<'EOF'
# Blockers

_Append-only. Mark resolved with ~~strikethrough~~ rather than deleting._

EOF

[ -f "$STATE/learnings.md" ] || cat > "$STATE/learnings.md" <<'EOF'
# Learnings

_Append-only. One bullet per learning._

EOF

echo "✓ update-state: refreshed progress.md and next-task.md."
