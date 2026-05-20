#!/usr/bin/env bash
# check-deployable.sh — Goal 2 gate (2.B3): docker-compose.prod.yml brings
# up a working vspec stack on a clean machine.
#
# Strategy:
#   1. docker compose -f docker-compose.prod.yml build
#   2. up -d
#   3. wait for /healthz on the published host port
#   4. Drive the signup start/callback roundtrip against the published port
#   5. tear the stack down (including volumes)
#
# Fails if docker is unavailable. The goal explicitly requires Docker
# deployability — there is no fallback path.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "✗ check-deployable: docker not installed (required for goal 2.B3)"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "✗ check-deployable: docker daemon not reachable"
  exit 1
fi
if [ ! -f Dockerfile ]; then
  echo "✗ check-deployable: Dockerfile missing"
  exit 1
fi
if [ ! -f docker-compose.prod.yml ]; then
  echo "✗ check-deployable: docker-compose.prod.yml missing"
  exit 1
fi

PORT=${VSPEC_DEPLOY_TEST_PORT:-4400}
PROJECT=${VSPEC_DEPLOY_TEST_PROJECT:-vspec-deploy-check}
export VSPEC_DEPLOY_HOST_PORT="$PORT"
export VSPEC_AUTH_STUB=1
LOG=$(mktemp)

compose() {
  docker compose -p "$PROJECT" -f docker-compose.prod.yml "$@"
}

cleanup() {
  compose down -v >/dev/null 2>&1 || true
  rm -f "$LOG"
}
trap cleanup EXIT

if ! compose build >"$LOG" 2>&1; then
  echo "✗ check-deployable: docker compose build failed"
  tail -20 "$LOG" | sed 's/^/    /'
  exit 1
fi
if ! compose up -d >"$LOG" 2>&1; then
  echo "✗ check-deployable: docker compose up failed"
  tail -20 "$LOG" | sed 's/^/    /'
  exit 1
fi

ok=false
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then
    ok=true
    break
  fi
  sleep 1
done
if [ "$ok" != true ]; then
  echo "✗ check-deployable: /healthz never returned 200 within 60s"
  compose logs --tail=40 2>&1 | sed 's/^/    /'
  exit 1
fi

SLUG="deploy-$(date +%s)-$$"
START=$(curl -fsS -c /tmp/dep-jar -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"workspace\":{\"name\":\"Deploy Test\",\"slug\":\"$SLUG\"}}" \
  "http://127.0.0.1:${PORT}/v1/auth/github/start" 2>/dev/null || echo "")
if ! echo "$START" | grep -q '"authorization_url"'; then
  echo "✗ check-deployable: signup-start did not return authorization_url"
  echo "  body: $START"
  exit 1
fi
STATE=$(echo "$START" | sed -n 's/.*"state":"\([^"]*\)".*/\1/p')
if [ -z "$STATE" ]; then
  echo "✗ check-deployable: signup-start did not return state"
  echo "  body: $START"
  exit 1
fi

CB_STATUS=$(curl -s -b /tmp/dep-jar -o /tmp/dep-cb.json -w '%{http_code}' \
  "http://127.0.0.1:${PORT}/v1/auth/github/callback?code=stub-deploy&state=${STATE}" \
  2>/dev/null || echo "000")
if [ "$CB_STATUS" != "201" ]; then
  echo "✗ check-deployable: signup callback returned $CB_STATUS"
  cat /tmp/dep-cb.json 2>/dev/null | sed 's/^/    /'
  exit 1
fi

echo "✓ check-deployable: stack up, /healthz green, signup roundtrip writes on :${PORT}"
