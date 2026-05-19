#!/usr/bin/env bash
# check-db-consistency.sh — Goal 2 gate (2.B2): DB configuration is
# consistent across prisma/schema.prisma, .env.example, package.json, and
# docker-compose*.yml.
#
# The current repo has a known drift:
#   - .env.example          → postgres://…
#   - prisma/schema.prisma  → provider = "sqlite"
#   - package.json start    → DATABASE_URL=file:.state/dev.sqlite (default)
# This script makes that mismatch a hard failure.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0

# ── 1. Schema provider ───────────────────────────────────────────────────
SCHEMA_PROVIDER=$(grep -E 'provider\s*=\s*"(postgres|postgresql|sqlite)"' prisma/schema.prisma 2>/dev/null \
  | head -1 \
  | sed -E 's/.*"([a-z]+)".*/\1/')

if [ -z "$SCHEMA_PROVIDER" ]; then
  # Allow env-driven provider e.g. provider = env("DATABASE_PROVIDER")
  if grep -qE 'provider\s*=\s*env\(' prisma/schema.prisma 2>/dev/null; then
    SCHEMA_PROVIDER='env'
  else
    echo "✗ check-db-consistency: prisma/schema.prisma has no recognizable provider"
    FAIL=1
  fi
fi

# ── 2. .env.example DATABASE_URL ─────────────────────────────────────────
ENV_URL=$(grep -E '^DATABASE_URL=' .env.example 2>/dev/null | head -1 | sed 's/^DATABASE_URL=//')
case "$ENV_URL" in
  postgres://*|postgresql://*) ENV_PROVIDER=postgresql ;;
  file:*)                       ENV_PROVIDER=sqlite ;;
  '')                           ENV_PROVIDER='' ;;
  *)                            ENV_PROVIDER='unknown' ;;
esac

if [ -z "$ENV_PROVIDER" ]; then
  echo "✗ check-db-consistency: .env.example DATABASE_URL is missing"
  FAIL=1
elif [ "$ENV_PROVIDER" = unknown ]; then
  echo "✗ check-db-consistency: .env.example DATABASE_URL is unrecognized: $ENV_URL"
  FAIL=1
fi

# ── 3. Schema vs env must agree ──────────────────────────────────────────
if [ "$SCHEMA_PROVIDER" != env ] && [ -n "$ENV_PROVIDER" ] && [ "$ENV_PROVIDER" != unknown ]; then
  CANON_SCHEMA="$SCHEMA_PROVIDER"
  [ "$CANON_SCHEMA" = postgres ] && CANON_SCHEMA=postgresql
  if [ "$CANON_SCHEMA" != "$ENV_PROVIDER" ]; then
    echo "✗ check-db-consistency: schema='$SCHEMA_PROVIDER' disagrees with .env.example='$ENV_PROVIDER'"
    echo "    Either move schema to env(\"DATABASE_PROVIDER\") or align .env.example."
    FAIL=1
  fi
fi

# ── 4. package.json start script must not hardcode a dev path in prod ────
# Allowed: "start": "... DATABASE_URL=\${DATABASE_URL:-postgres://...} ..."
# Forbidden: hardcoded ":-file:.state/dev.sqlite" when ENV says Postgres.
if [ "$ENV_PROVIDER" = postgresql ] \
    && grep -qE '"start"[^"]*"[^"]*file:\.state/dev\.sqlite' package.json 2>/dev/null; then
  echo "✗ check-db-consistency: package.json 'start' defaults DATABASE_URL to dev SQLite"
  echo "    while .env.example advertises Postgres. Pick one."
  FAIL=1
fi

# ── 5. docker-compose.prod.yml must exist and reference DATABASE_URL ─────
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
echo "✓ check-db-consistency: schema, env, package.json, compose all aligned"
