#!/bin/bash
docker pull postgres:16-alpine
docker run --name vspec-db-test -e POSTGRES_USER=vspec -e POSTGRES_PASSWORD=vspec -e POSTGRES_DB=vspec_test -p 5433:5432 -d postgres:16-alpine
sleep 5
export DATABASE_URL="postgresql://vspec:vspec@127.0.0.1:5433/vspec_test"
export TEST_DATABASE_URL="postgresql://vspec:vspec@127.0.0.1:5433/vspec_test"
export NODE_OPTIONS="--max-old-space-size=4096"
export VSPEC_TEST_USE_DIST=1
pnpm --filter @vooster/api run test -- apps/api/tests/integration/persistence-matrix-identity.test.ts
