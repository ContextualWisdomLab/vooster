#!/usr/bin/env bash
# check-ci.sh — workflow files parse and exercise the Postgres-backed suite.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0
FOUND=false

while IFS= read -r workflow; do
  FOUND=true

  if ! ruby -e 'require "yaml"; YAML.load_file(ARGV.fetch(0))' "$workflow" >/dev/null 2>&1; then
    echo "✗ check-ci: $workflow is not parseable YAML"
    FAIL=1
  fi

  if ! grep -q 'postgres' "$workflow"; then
    echo "✗ check-ci: $workflow does not reference postgres"
    FAIL=1
  fi

  if ! grep -q 'completion-check.sh' "$workflow"; then
    echo "✗ check-ci: $workflow does not run completion-check.sh"
    FAIL=1
  fi
done < <(find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | sort)

if [ "$FOUND" != true ]; then
  echo "✗ check-ci: no workflow files found"
  exit 1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "✓ check-ci: workflow YAML parses and references Postgres plus completion-check"
