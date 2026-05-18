#!/usr/bin/env bash
# dogfood-test.sh — End-to-end self-test.
# Boots a fresh vspec instance, registers vspec's own use cases via the CLI,
# performs a session/branch/merge cycle, and exports Gherkin.
#
# Pre-conditions:
#   - DATABASE_URL points to a disposable Postgres.
#   - npm dependencies installed (npm ci already run).
#   - prisma migrations applied (prisma migrate deploy).
#   - GitHub OAuth stub enabled (VSPEC_AUTH_STUB=1).

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG="$ROOT/.state/dogfood.log"
mkdir -p "$(dirname "$LOG")"
: > "$LOG"

note() { echo "[dogfood] $*" | tee -a "$LOG"; }
fail() { note "✗ $*"; exit 1; }

if [ ! -f package.json ]; then
  fail "no package.json; cannot run dogfood"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  note "DATABASE_URL not set; using DATABASE_URL=postgres://vspec:vspec@localhost:5432/vspec_dogfood"
  export DATABASE_URL="postgres://vspec:vspec@localhost:5432/vspec_dogfood"
fi

export VSPEC_AUTH_STUB=1
export VSPEC_PROFILE=dogfood

note "1/8  Reset database"
npx --no-install prisma migrate reset --force --skip-seed >>"$LOG" 2>&1 || fail "prisma reset failed"

note "2/8  Start server (background)"
PORT=4456
VSPEC_PORT=$PORT npm run --silent start:server >>"$LOG" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

for i in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/v1/health" >/dev/null 2>&1; then
    note "  server healthy"
    break
  fi
  sleep 1
  [ "$i" -eq 30 ] && fail "server did not start"
done

note "3/8  Authenticate stub user + create workspace + project"
npx vspec login --stub --as "alice@vooster.dev" >>"$LOG" 2>&1 || fail "login stub failed"
npx vspec workspace create --name "Dogfood" --slug "dogfood" >>"$LOG" 2>&1 || fail "workspace create failed"
npx vspec project create --name "vspec" --key "VSPEC" >>"$LOG" 2>&1 || fail "project create failed"

note "4/8  Push every UC spec from docs/usecases/"
COUNT=0
for f in docs/usecases/UC-*.md; do
  [ -f "$f" ] || continue
  npx vspec push --file "$f" >>"$LOG" 2>&1 || fail "push $f failed"
  COUNT=$((COUNT+1))
done
note "  pushed $COUNT use cases"

note "5/8  Start a session + create branch + small change + merge"
SID=$(npx vspec session start --intent "dogfood smoke" --pin UC-001 --auto-branch --format=json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.id))')
[ -n "$SID" ] || fail "session id empty"
note "  session: $SID"

npx vspec comment add UC-001 --body "dogfood comment" >>"$LOG" 2>&1 || fail "comment add failed"
npx vspec session complete >>"$LOG" 2>&1 || fail "session complete failed"

note "6/8  Verify the comment landed on main"
COMMENT_COUNT=$(npx vspec comment list UC-001 --format=json | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).data.items.length))')
[ "$COMMENT_COUNT" -ge 1 ] || fail "comment did not persist"

note "7/8  Export Gherkin for UC-001 and validate"
npx vspec export gherkin UC-001 --output /tmp/UC-001.feature >>"$LOG" 2>&1 || fail "gherkin export failed"
head -1 /tmp/UC-001.feature | grep -q "^Feature:" || fail "gherkin output missing Feature: header"

note "8/8  Run completion-check on the resulting workspace"
HEALTH=$(curl -sf "http://localhost:$PORT/v1/health" || echo "")
echo "$HEALTH" | grep -q '"ok"' || fail "health check failed"

note "✓ dogfood test passed"
exit 0
