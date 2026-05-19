#!/usr/bin/env bash
# diagnose.sh — Tell the agent what state the codebase is in.
# Idempotent, read-only.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== VSPEC DEVELOPMENT STATE ==="
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

echo "=== Iteration / Commits ==="
if git rev-parse --git-dir >/dev/null 2>&1; then
  COMMITS=$(git log --oneline 2>/dev/null | wc -l | tr -d ' ')
  echo "Total commits: $COMMITS"
  echo ""
  echo "Last 10:"
  git log --oneline -10 2>/dev/null || echo "  (no commits yet)"
else
  echo "  (not a git repo)"
fi
echo ""

echo "=== Active Goal ==="
ACTIVE_FILE="$ROOT/.state/active-goal"
if [ -f "$ACTIVE_FILE" ]; then
  ACTIVE=$(cat "$ACTIVE_FILE")
else
  ACTIVE="(unknown — run scripts/completion-check.sh first)"
fi
echo "  $ACTIVE"
if [ -d goals ]; then
  echo "  All goals:"
  for f in $(find goals -maxdepth 1 -name '*.md' -type f 2>/dev/null | sort); do
    name=$(basename "$f" .md)
    gate="goals/${name}.gates.sh"
    if [ -f "$gate" ]; then
      status="(not yet checked)"
      if [ -f "$ACTIVE_FILE" ]; then
        if [ "$(cat "$ACTIVE_FILE")" = "ALL_DONE" ]; then
          status="✓ passed"
        elif [ "$ACTIVE" = "$f" ]; then
          status="⚙ active (failing)"
        else
          # If a goal precedes the active one, completion-check confirmed it passed.
          if [ "$f" \< "$ACTIVE" ]; then
            status="✓ passed"
          else
            status="(deferred — earlier goal is active)"
          fi
        fi
      fi
      echo "    - $f $status"
    else
      echo "    - $f (no gate script)"
    fi
  done
fi
echo ""

echo "=== Scaffolding ==="
[ -f package.json ]      && echo "  ✓ package.json"      || echo "  ✗ package.json (run scaffolding)"
[ -f tsconfig.json ]     && echo "  ✓ tsconfig.json"     || echo "  ✗ tsconfig.json"
[ -f vitest.config.ts ]  && echo "  ✓ vitest.config.ts"  || echo "  ✗ vitest.config.ts"
[ -d prisma ]            && echo "  ✓ prisma/"           || echo "  ✗ prisma/"
[ -d src ]               && echo "  ✓ src/"              || echo "  ✗ src/"
[ -d tests/e2e ]         && echo "  ✓ tests/e2e/"        || echo "  ✗ tests/e2e/"
[ -d tests/e2e-cli ]     && echo "  ✓ tests/e2e-cli/"    || echo "  ⊘ tests/e2e-cli/ (goal 1)"
[ -f bin/run.js ]        && echo "  ✓ bin/run.js"        || echo "  ⊘ bin/run.js (goal 1)"
[ -s src/index.ts ]      && echo "  ✓ src/index.ts non-empty" || echo "  ⊘ src/index.ts empty (goal 1)"
echo ""

echo "=== Test Status ==="
if [ -f package.json ] && command -v npm >/dev/null 2>&1; then
  if npm run --silent test -- --run >/tmp/vspec_test_out.txt 2>&1; then
    echo "  ✓ Tests passing"
    grep -E "Tests +[0-9]" /tmp/vspec_test_out.txt | tail -5 || true
  else
    echo "  ✗ Tests failing"
    echo "  First failures:"
    grep -E "FAIL|✗|Error|×" /tmp/vspec_test_out.txt | head -15 | sed 's/^/    /'
  fi
else
  echo "  ⚠ No package.json — skip"
fi
echo ""

echo "=== Use Case Progress ==="
TOTAL=0
COMPLETED=0
IN_PROGRESS=0
NOT_STARTED=0
for f in docs/usecases/UC-*.md; do
  [ -f "$f" ] || continue
  TOTAL=$((TOTAL+1))
  UC_ID=$(basename "$f" | grep -oE "UC-[0-9]+" | head -1)
  TEST_FILE="tests/e2e/${UC_ID}.test.ts"
  if [ -f "$TEST_FILE" ]; then
    if grep -qE "describe\(|test\(|it\(" "$TEST_FILE"; then
      if npx --no-install vitest run "$TEST_FILE" --reporter=dot >/dev/null 2>&1; then
        COMPLETED=$((COMPLETED+1))
      else
        IN_PROGRESS=$((IN_PROGRESS+1))
      fi
    else
      IN_PROGRESS=$((IN_PROGRESS+1))
    fi
  else
    NOT_STARTED=$((NOT_STARTED+1))
  fi
done
echo "  Completed:   $COMPLETED / $TOTAL"
echo "  In progress: $IN_PROGRESS"
echo "  Not started: $NOT_STARTED"
echo ""

echo "=== Blockers ==="
if [ -s docs/state/blockers.md ]; then
  grep -vE '^(#|$)' docs/state/blockers.md | head -10 | sed 's/^/  /'
else
  echo "  (none)"
fi
echo ""

echo "=== Uncommitted Changes ==="
git status --short 2>/dev/null | head -20 | sed 's/^/  /' || echo "  (clean)"
echo ""

echo "=== Recommended Next Action ==="
bash "$ROOT/scripts/next-task.sh"
