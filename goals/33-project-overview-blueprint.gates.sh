#!/usr/bin/env bash
# goals/33-project-overview-blueprint.gates.sh — project overview blueprint invariant.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="33-project-overview-blueprint"
GATE_INPUTS=(
  apps/app/app/data.tsx
  'apps/app/app/(app)/projects/[key]/page.tsx'
  apps/app/tests/unit
  apps/app/tests/e2e-web
  apps/app/package.json
  goals/33-project-overview-blueprint.md
  goals/33-project-overview-blueprint.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true
DATA='apps/app/app/data.tsx'
PAGE='apps/app/app/(app)/projects/[key]/page.tsx'

echo "[33.A1] UsecaseSummary carries scenario and extension counts"
if grep -q "scenario_count" "$DATA" && grep -q "extension_count" "$DATA"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $DATA does not model both scenario_count and extension_count"
  PASS=false
fi

echo "[33.A2] project actors are fetched through the existing API surface"
if grep -q "fetchProjectActors" "$DATA" && grep -q "/actors" "$DATA"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $DATA has no project actors fetcher"
  PASS=false
fi

echo "[33.B1] overview renders substance counts"
MISSING_COPY=()
for token in "유스케이스" "액터" "시나리오"; do
  if ! grep -q "$token" "$PAGE"; then
    MISSING_COPY+=("$token")
  fi
done
if [ "${#MISSING_COPY[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — overview missing count copy: ${MISSING_COPY[*]}"
  PASS=false
fi

echo "[33.B2] every overview row renders an exception count"
if grep -q "extension_count" "$PAGE" && grep -q "예외" "$PAGE"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — overview rows do not render 예외 N from extension_count"
  PASS=false
fi

echo "[33.B3] overview renders total prepared exceptions block"
if grep -q "대비된 예외 상황" "$PAGE"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — missing 대비된 예외 상황 N건 block"
  PASS=false
fi

echo "[33.C1] web unit tests pass"
if pnpm --filter @vooster/app test; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  PASS=false
fi

echo "[33.C2] web typecheck passes"
if pnpm --filter @vooster/app typecheck; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  PASS=false
fi

echo "[33.D1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/33-project-overview-blueprint.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/33-project-overview-blueprint.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
