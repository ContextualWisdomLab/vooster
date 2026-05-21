#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HONEST_DIR="$ROOT/apps/cli/tests/e2e-cli-honest"

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
pnpm exec vitest run apps/cli/tests/e2e-cli-honest
