#!/usr/bin/env bash
# goals/34-web-invocation-links.gates.sh — web invocation link rendering invariant.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="34-web-invocation-links"
GATE_INPUTS=(
  apps/app/app/data.tsx
  apps/app/app/data.stub.tsx
  'apps/app/app/(app)/projects/[key]/usecases/[ucKey]/page.tsx'
  apps/app/tests/unit
  apps/app/tests/e2e-web
  apps/app/package.json
  goals/34-web-invocation-links.md
  goals/34-web-invocation-links.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true
DATA='apps/app/app/data.tsx'
STUB='apps/app/app/data.stub.tsx'
DETAIL_PAGE='apps/app/app/(app)/projects/[key]/usecases/[ucKey]/page.tsx'

echo "[34.A1] detail data models forward invocation links"
if grep -q "invokes" "$DATA"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $DATA does not model step invokes"
  PASS=false
fi

echo "[34.A2] detail data models derived invoked-by links"
if grep -q "invoked_by" "$DATA"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $DATA does not model invoked_by"
  PASS=false
fi

echo "[34.B1] use-case detail renders 호출 / 호출됨 from invocation data"
MISSING=()
for token in "호출" "호출됨" "invokes" "invoked_by"; do
  if ! grep -q "$token" "$DETAIL_PAGE"; then
    MISSING+=("$token")
  fi
done
if [ "${#MISSING[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — detail page missing invocation rendering tokens: ${MISSING[*]}"
  PASS=false
fi

echo "[34.C1] auth-stub detail fixture exposes invocation examples"
if grep -q "invokes" "$STUB" && grep -q "invoked_by" "$STUB"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $STUB has no inspectable invocation example"
  PASS=false
fi

echo "[34.D1] web unit tests pass"
if pnpm --filter @vooster/app test; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  PASS=false
fi

echo "[34.D2] web typecheck passes"
if pnpm --filter @vooster/app typecheck; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  PASS=false
fi

echo "[34.E1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/34-web-invocation-links.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/34-web-invocation-links.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
