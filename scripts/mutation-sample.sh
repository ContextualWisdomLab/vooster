#!/usr/bin/env bash
# mutation-sample.sh — Run the current targeted Stryker sample.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MUTATE_TARGET="${1:-src/http/usecase-from-goal.ts}"
TEST_FILES="${2:-tests/e2e/UC-009*.test.ts}"
CONCURRENCY="${STRYKER_CONCURRENCY:-2}"
TIMEOUT_MS="${STRYKER_TIMEOUT_MS:-10000}"

npx --no-install stryker run \
  --testRunner vitest \
  --mutate "$MUTATE_TARGET" \
  --testFiles "$TEST_FILES" \
  --reporters clear-text \
  --coverageAnalysis off \
  --concurrency "$CONCURRENCY" \
  --timeoutMS "$TIMEOUT_MS"
