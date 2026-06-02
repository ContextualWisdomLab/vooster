#!/usr/bin/env bash
# goals/35-korean-verb-phrase.gates.sh — Korean-first verb phrase invariant.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="35-korean-verb-phrase"
GATE_INPUTS=(
  apps/api/src/application/verb-phrases.ts
  apps/api/src/application/usecases.ts
  apps/api/src/application/doctor.ts
  apps/api/tests/unit/application/verb-phrases.test.ts
  apps/api/tests/unit/application/usecases.test.ts
  apps/api/tests/unit/application/doctor.test.ts
  apps/api/tests/e2e/UC-009.test.ts
  goals/35-korean-verb-phrase.md
  goals/35-korean-verb-phrase.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[35.A1] Korean/English verb phrase and doctor tests pass"
if pnpm exec vitest run \
  apps/api/tests/unit/application/verb-phrases.test.ts \
  apps/api/tests/unit/application/usecases.test.ts \
  apps/api/tests/unit/application/doctor.test.ts \
  apps/api/tests/e2e/UC-009.test.ts; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  PASS=false
fi

echo "[35.B1] spec_language concept exists under apps/"
if rg -q "spec_language" apps; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — no spec_language selector/default found under apps/"
  PASS=false
fi

echo "[35.C1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/35-korean-verb-phrase.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/35-korean-verb-phrase.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
