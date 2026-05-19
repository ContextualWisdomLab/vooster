#!/usr/bin/env bash
# check-layers.sh — Goal 1 gate: src/http/ is a thin routing layer.
#
# Definition of "thin":
#   - No module-scope `new Map(`, `new Set(`, or top-level `const X: Record<...>`
#     that holds entity state inside src/http/.
#   - No `@prisma/client` import inside src/http/ (Prisma belongs to
#     src/infrastructure/).
#   - src/application/ is not empty (business logic actually moved).
#   - eslint-plugin-boundaries is configured (boundaries/* rule referenced in
#     eslint.config.js).

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL=0

# 1. No in-memory entity stores in src/http/.
INMEM_VIOLATIONS=$(grep -nE '^(const|let)\s+[A-Za-z_]+\s*(:|=).*\b(new (Map|Set)\(|Record<)' \
  src/http/*.ts 2>/dev/null | grep -v 'state\.\|SignupState\|ServerState\|node_modules' || true)
if [ -n "$INMEM_VIOLATIONS" ]; then
  echo "✗ check-layers: in-memory entity stores still live in src/http/:"
  echo "$INMEM_VIOLATIONS" | head -30 | sed 's/^/    /'
  FAIL=1
fi

# 2. No direct Prisma imports in src/http/.
PRISMA_LEAKS=$(grep -nE '^import .* from .*@prisma/client' src/http/*.ts 2>/dev/null || true)
if [ -n "$PRISMA_LEAKS" ]; then
  echo "✗ check-layers: src/http/ imports @prisma/client directly:"
  echo "$PRISMA_LEAKS" | sed 's/^/    /'
  FAIL=1
fi

# 3. src/application/ must contain real modules.
APP_FILES=$(find src/application -type f -name '*.ts' 2>/dev/null | wc -l | tr -d ' ')
if [ "$APP_FILES" -eq 0 ]; then
  echo "✗ check-layers: src/application/ is empty — business logic not extracted."
  FAIL=1
fi

# 4. src/domain/ must contain real modules.
DOMAIN_FILES=$(find src/domain -type f -name '*.ts' 2>/dev/null | wc -l | tr -d ' ')
if [ "$DOMAIN_FILES" -eq 0 ]; then
  echo "✗ check-layers: src/domain/ is empty — domain types not extracted."
  FAIL=1
fi

# 5. eslint.config.js must reference the boundaries plugin.
if ! grep -q 'boundaries' eslint.config.js 2>/dev/null; then
  echo "✗ check-layers: eslint.config.js does not reference eslint-plugin-boundaries."
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

echo "✓ check-layers: src/http/ is thin, application/domain populated, boundaries configured."
exit 0
