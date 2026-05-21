#!/usr/bin/env bash
# run-tests.sh — Run the test suite with consistent flags.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f package.json ]; then
  echo "run-tests: no package.json yet."
  exit 1
fi

# Pass through any extra arguments (e.g. a specific file).
pnpm exec vitest run "$@"
