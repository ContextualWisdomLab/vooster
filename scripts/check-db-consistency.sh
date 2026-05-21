#!/usr/bin/env bash
# check-db-consistency.sh — DB configuration agrees on PostgreSQL.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0

SCHEMA="apps/api/prisma/schema.prisma"

SCHEMA_PROVIDER=$(grep -E 'provider\s*=\s*"(postgres|postgresql)"' "$SCHEMA" 2>/dev/null \
  | head -1 \
  | sed -E 's/.*"([a-z]+)".*/\1/')

if [ "$SCHEMA_PROVIDER" != postgresql ]; then
  echo "✗ check-db-consistency: $SCHEMA provider must be postgresql"
  FAIL=1
fi

ENV_URL=$(grep -E '^DATABASE_URL=' .env.example 2>/dev/null | head -1 | sed 's/^DATABASE_URL=//')
TEST_ENV_URL=$(grep -E '^TEST_DATABASE_URL=' .env.example 2>/dev/null | head -1 | sed 's/^TEST_DATABASE_URL=//')

case "$ENV_URL" in
  postgres://*|postgresql://*) ;;
  '')
    echo "✗ check-db-consistency: .env.example DATABASE_URL is missing"
    FAIL=1
    ;;
  *)
    echo "✗ check-db-consistency: .env.example DATABASE_URL must be PostgreSQL"
    FAIL=1
    ;;
esac

case "$TEST_ENV_URL" in
  postgres://*|postgresql://*) ;;
  '')
    echo "✗ check-db-consistency: .env.example TEST_DATABASE_URL is missing"
    FAIL=1
    ;;
  *)
    echo "✗ check-db-consistency: .env.example TEST_DATABASE_URL must be PostgreSQL"
    FAIL=1
    ;;
esac

if grep -qE '"(prestart|start)"[^"]*"[^"]*file:' package.json 2>/dev/null; then
  echo "✗ check-db-consistency: package.json start scripts must not default to file URLs"
  FAIL=1
fi

if [ ! -f docker-compose.prod.yml ]; then
  echo "✗ check-db-consistency: docker-compose.prod.yml missing"
  FAIL=1
elif ! grep -qE 'DATABASE_URL' docker-compose.prod.yml 2>/dev/null; then
  echo "✗ check-db-consistency: docker-compose.prod.yml has no DATABASE_URL"
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "✓ check-db-consistency: schema, env, package.json, compose all align on PostgreSQL"
