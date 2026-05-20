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

UC_STATUS_FILE=$(mktemp)
trap 'rm -f "$UC_STATUS_FILE"' EXIT
node "$ROOT/scripts/_uc-status.mjs" tests/e2e >"$UC_STATUS_FILE" 2>/dev/null || true

for f in docs/usecases/UC-*.md; do
  [ -f "$f" ] || continue
  TOTAL=$((TOTAL+1))
  UC_ID=$(basename "$f" | grep -oE "UC-[0-9]+" | head -1)
  TEST_FILE="tests/e2e/${UC_ID}.test.ts"
  if [ -f "$TEST_FILE" ]; then
    STATUS=$(grep -F "${TEST_FILE}"$'\t' "$UC_STATUS_FILE" | awk -F'\t' '{print $2}' | head -1)
    if [ "$STATUS" = "PASS" ]; then
      COMPLETED=$((COMPLETED+1))
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

echo "=== Goal 2 Coverage (shippability) ==="
if [ -f prisma/schema.prisma ] && [ -d src/infrastructure ]; then
  MODELS=$(grep -E '^model ' prisma/schema.prisma | awk '{print $2}')
  TOTAL_M=0; PERSISTED_M=0
  for m in $MODELS; do
    TOTAL_M=$((TOTAL_M+1))
    lower=$(echo "$m" | awk '{print tolower(substr($0,1,1)) substr($0,2)}')
    if grep -rq "prisma\.${lower}\." src/infrastructure/ 2>/dev/null; then
      PERSISTED_M=$((PERSISTED_M+1))
    fi
  done
  echo "  Persistence:    $PERSISTED_M / $TOTAL_M Prisma models wired in src/infrastructure/"
else
  echo "  Persistence:    (prisma or src/infrastructure missing)"
fi

if [ -f src/http/signup-types.ts ]; then
  ALLOWED='^(pendingOAuth|sessionsByToken|readOnlyMemberships)$'
  LEFT=$(awk '/^export type SignupState = \{/,/^\};/' src/http/signup-types.ts \
    | grep -E '^\s+[a-zA-Z]+\s*:\s*(Map|Set)<' \
    | awk -F: '{gsub(/^[ \t]+/,"",$1); print $1}' \
    | grep -vcE "$ALLOWED" || true)
  echo "  SignupState:    $LEFT non-ephemeral in-memory field(s) still to migrate"
fi

if [ -d src/http ]; then
  OVER=$(find src/http -name '*-routes.ts' -type f -exec wc -l {} \; 2>/dev/null \
    | awk '$1>150 {n++} END {print n+0}')
  echo "  Fat routes:     $OVER file(s) over 150 lines"
fi

APP_C=$(find src/application -name '*.ts' -type f 2>/dev/null | wc -l | tr -d ' ')
UNIT_C=$(find tests/unit/application -name '*.test.ts' 2>/dev/null | wc -l | tr -d ' ')
echo "  Application:    $APP_C modules, $UNIT_C unit tests (target ≥ 18 each)"

if grep -rq 'GITHUB_CLIENT_ID' src/ 2>/dev/null; then
  echo "  Real OAuth:     ✓ GITHUB_CLIENT_ID read in src/"
else
  echo "  Real OAuth:     ✗ stub only (GITHUB_CLIENT_ID never read)"
fi

if [ -f Dockerfile ] && [ -f docker-compose.prod.yml ]; then
  echo "  Deploy assets:  ✓ Dockerfile + docker-compose.prod.yml present"
else
  MISSING_ASSETS=""
  [ ! -f Dockerfile ] && MISSING_ASSETS="$MISSING_ASSETS Dockerfile"
  [ ! -f docker-compose.prod.yml ] && MISSING_ASSETS="$MISSING_ASSETS docker-compose.prod.yml"
  echo "  Deploy assets:  ✗ missing$MISSING_ASSETS"
fi
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
