#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HONEST_DIR="$ROOT/apps/cli/tests/e2e-cli-honest"
LOCK_DIR="$ROOT/.state/honest-cli-e2e.lock"

if [ ! -d "$HONEST_DIR" ]; then
  echo "missing $HONEST_DIR" >&2
  exit 1
fi

TEST_COUNT="$(find "$HONEST_DIR" -name '*.test.ts' -type f | wc -l | tr -d ' ')"
if [ "$TEST_COUNT" -eq 0 ]; then
  echo "$HONEST_DIR has no *.test.ts files" >&2
  exit 1
fi

while IFS= read -r file; do
  if grep -qE '\bfetch\(' "$file"; then
    echo "$file calls fetch(" >&2
    exit 1
  fi
done < <(find "$HONEST_DIR" -name '*.ts' -type f)

cd "$ROOT"
mkdir -p "$ROOT/.state"
start=$SECONDS
until mkdir "$LOCK_DIR" 2>/dev/null; do
  if [ $((SECONDS - start)) -gt 300 ]; then
    echo "timed out waiting for honest CLI E2E lock" >&2
    exit 1
  fi
  sleep 1
done
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

pnpm exec vitest run apps/cli/tests/e2e-cli-honest
