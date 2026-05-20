#!/usr/bin/env bash
# update-state.sh — Refresh docs/state/* based on git + test + goal status.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STATE="$ROOT/docs/state"
mkdir -p "$STATE"

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
COMMITS=$(git log --oneline 2>/dev/null | wc -l | tr -d ' ')
LAST=$(git log -1 --pretty='%h %s' 2>/dev/null || echo '(none)')

# ----- Per-UC test matrix (goal-0 carry-over) -----
TOTAL=0
COMPLETED=0
declare -a ROWS

UC_STATUS_FILE=$(mktemp)
trap 'rm -f "$UC_STATUS_FILE"' EXIT
node "$ROOT/scripts/_uc-status.mjs" tests/e2e tests/e2e-cli >"$UC_STATUS_FILE" 2>/dev/null || true

uc_status() {
  grep -F "$1"$'\t' "$UC_STATUS_FILE" | awk -F'\t' '{print $2}' | head -1
}

for f in $(ls docs/usecases/UC-*.md 2>/dev/null | sort); do
  TOTAL=$((TOTAL+1))
  UC_ID=$(basename "$f" | grep -oE "UC-[0-9]+" | head -1)
  TITLE=$(grep -m1 '^title:' "$f" 2>/dev/null | sed 's/^title:[[:space:]]*//' || echo "")
  TEST_FILE="tests/e2e/${UC_ID}.test.ts"
  CLI_FILE="tests/e2e-cli/${UC_ID}.test.ts"
  STATUS="○ NOT STARTED"
  TESTS="0/0"
  CLI="○"
  if [ -f "$TEST_FILE" ]; then
    TEST_COUNT=$(grep -cE '\b(test|it)\(' "$TEST_FILE" 2>/dev/null || echo 0)
    if [ "$(uc_status "$TEST_FILE")" = "PASS" ]; then
      STATUS="✓ DONE"
      COMPLETED=$((COMPLETED+1))
      TESTS="$TEST_COUNT/$TEST_COUNT"
    else
      STATUS="⚙ IN PROGRESS"
      TESTS="?/$TEST_COUNT"
    fi
  fi
  if [ -f "$CLI_FILE" ]; then
    if [ "$(uc_status "$CLI_FILE")" = "PASS" ]; then
      CLI="✓"
    else
      CLI="⚙"
    fi
  fi
  ROWS+=("| $UC_ID | $TITLE | $STATUS | $TESTS | $CLI |")
done

# ----- Goal-1 runnability matrix -----
RUN_BOOT="○"
RUN_PERSIST="○"
RUN_CLI="○"
RUN_LAYERS="○"
if [ -f "$ROOT/scripts/check-bootable.sh" ]; then
  bash "$ROOT/scripts/check-bootable.sh"    >/dev/null 2>&1 && RUN_BOOT="✓"   || RUN_BOOT="✗"
fi
if [ -f "$ROOT/scripts/check-persistence.sh" ]; then
  bash "$ROOT/scripts/check-persistence.sh" >/dev/null 2>&1 && RUN_PERSIST="✓" || RUN_PERSIST="✗"
fi
if [ -f "$ROOT/scripts/check-cli.sh" ]; then
  bash "$ROOT/scripts/check-cli.sh"         >/dev/null 2>&1 && RUN_CLI="✓"     || RUN_CLI="✗"
fi
if [ -f "$ROOT/scripts/check-layers.sh" ]; then
  bash "$ROOT/scripts/check-layers.sh"      >/dev/null 2>&1 && RUN_LAYERS="✓"  || RUN_LAYERS="✗"
fi

ACTIVE_GOAL="(unknown — run scripts/completion-check.sh)"
if [ -f "$ROOT/.state/active-goal" ]; then
  ACTIVE_GOAL=$(cat "$ROOT/.state/active-goal")
fi

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
  echo "- Active goal: $ACTIVE_GOAL"
  echo ""
  echo "## Runnability (goal 1)"
  echo ""
  echo "| Gate | Status |"
  echo "| --- | --- |"
  echo "| Bootable (npm start, /healthz) | $RUN_BOOT |"
  echo "| Persistence (restart survival) | $RUN_PERSIST |"
  echo "| CLI binary + subcommands | $RUN_CLI |"
  echo "| Layered architecture | $RUN_LAYERS |"
  echo ""
  echo "## By Use Case"
  echo ""
  echo "| ID | Title | E2E Status | API Tests | CLI E2E |"
  echo "| --- | --- | --- | --- | --- |"
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

_Append-only. One bullet per learning. Keep it terse._

EOF

echo "✓ update-state: refreshed progress.md and next-task.md."
