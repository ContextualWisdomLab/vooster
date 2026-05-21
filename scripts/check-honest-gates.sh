#!/usr/bin/env bash
# check-honest-gates.sh — reject tests that assert on raw config text.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TESTS_DIR="${HONEST_GATES_TESTS_DIR:-tests}"
CONFIG_FILES=(
  eslint.config.js
  tsconfig.json
  package.json
  apps/api/prisma/schema.prisma
  docker-compose.yml
  docker-compose.prod.yml
  vitest.config.ts
)

OFFENDERS=()

while IFS= read -r test_file; do
  reads_config=false
  for cfg in "${CONFIG_FILES[@]}"; do
    if grep -q "readFileSync.*${cfg##*/}" "$test_file" 2>/dev/null; then
      reads_config=true
      break
    fi
  done

  if [ "$reads_config" != true ]; then
    continue
  fi
  if ! grep -qE 'toMatch\(|toContain\(' "$test_file" 2>/dev/null; then
    continue
  fi
  if grep -qE 'JSON\.parse|yaml\.|safe_load|ESLint\(|new Linter' "$test_file" 2>/dev/null; then
    continue
  fi

  OFFENDERS+=("$test_file")
done < <(find "$TESTS_DIR" -type f -name '*.test.ts' 2>/dev/null)

if [ "${#OFFENDERS[@]}" -eq 0 ]; then
  echo "✓ check-honest-gates: no config-grep tests found"
  exit 0
fi

printf 'dishonest test: %s\n' "${OFFENDERS[@]}"
exit 1
