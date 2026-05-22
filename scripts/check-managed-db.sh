#!/usr/bin/env bash
# check-managed-db.sh — prove the image runs against an external Postgres.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "✗ check-managed-db: docker not installed"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "✗ check-managed-db: docker daemon not reachable"
  exit 1
fi

PORT=${VSPEC_MANAGED_DB_TEST_PORT:-4410}
SUFFIX="$$"
NETWORK="vspec_managed_test_${SUFFIX}"
PG="vspec_managed_pg_${SUFFIX}"
APP="vspec_managed_app_${SUFFIX}"
IMAGE="vspec-managed-test:${SUFFIX}"
LOG=$(mktemp)
COOKIE_JAR=$(mktemp)
CALLBACK_BODY=$(mktemp)

cleanup() {
  docker rm -f "$APP" "$PG" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  docker image rm "$IMAGE" >/dev/null 2>&1 || true
  rm -f "$LOG" "$COOKIE_JAR" "$CALLBACK_BODY"
}
trap cleanup EXIT

if ! docker network create "$NETWORK" >"$LOG" 2>&1; then
  echo "✗ check-managed-db: network creation failed"
  cat "$LOG" | sed 's/^/    /'
  exit 1
fi

if ! docker run -d --name "$PG" --network "$NETWORK" \
    -e POSTGRES_USER=vspec \
    -e POSTGRES_PASSWORD=vspec \
    -e POSTGRES_DB=vspec \
    postgres:16-alpine >"$LOG" 2>&1; then
  echo "✗ check-managed-db: external Postgres container failed"
  cat "$LOG" | sed 's/^/    /'
  exit 1
fi

pg_ready=false
for _ in $(seq 1 60); do
  if docker exec "$PG" pg_isready -U vspec -d vspec >/dev/null 2>&1; then
    pg_ready=true
    break
  fi
  sleep 1
done
if [ "$pg_ready" != true ]; then
  echo "✗ check-managed-db: external Postgres never became healthy"
  docker logs "$PG" --tail=40 2>&1 | sed 's/^/    /'
  exit 1
fi

if ! docker build -t "$IMAGE" . >"$LOG" 2>&1; then
  echo "✗ check-managed-db: app image build failed"
  tail -20 "$LOG" | sed 's/^/    /'
  exit 1
fi

if ! docker run -d --name "$APP" --network "$NETWORK" \
    -e DATABASE_URL=postgresql://vspec:vspec@"$PG":5432/vspec \
    -e VSPEC_AUTH_STUB=1 \
    -e PORT=3000 \
    -p "127.0.0.1:${PORT}:3000" \
    "$IMAGE" >"$LOG" 2>&1; then
  echo "✗ check-managed-db: app container failed"
  cat "$LOG" | sed 's/^/    /'
  exit 1
fi

app_ready=false
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then
    app_ready=true
    break
  fi
  sleep 1
done
if [ "$app_ready" != true ]; then
  echo "✗ check-managed-db: app never became healthy"
  docker logs "$APP" --tail=60 2>&1 | sed 's/^/    /'
  exit 1
fi

SLUG="managed-$(date +%s)-$$"
START=$(curl -fsS -c "$COOKIE_JAR" -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"workspace\":{\"name\":\"Managed Test\",\"slug\":\"$SLUG\"}}" \
  "http://127.0.0.1:${PORT}/v1/auth/github/start" 2>/dev/null || echo "")
STATE=$(echo "$START" | sed -n 's/.*"state":"\([^"]*\)".*/\1/p')
if [ -z "$STATE" ]; then
  echo "✗ check-managed-db: signup-start did not return state"
  echo "  body: $START"
  exit 1
fi

CB_STATUS=$(curl -s -b "$COOKIE_JAR" -o "$CALLBACK_BODY" -w '%{http_code}' \
  "http://127.0.0.1:${PORT}/v1/auth/github/callback?code=stub-managed&state=${STATE}" \
  2>/dev/null || echo "000")
if [ "$CB_STATUS" != "201" ]; then
  echo "✗ check-managed-db: signup callback returned $CB_STATUS"
  cat "$CALLBACK_BODY" 2>/dev/null | sed 's/^/    /'
  exit 1
fi

echo "✓ check-managed-db: image persisted signup data through external Postgres"
