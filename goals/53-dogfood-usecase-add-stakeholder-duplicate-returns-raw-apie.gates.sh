#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source "$ROOT/scripts/_gate-cache.sh"

GATE_INPUTS=(
  "goals/53-dogfood-usecase-add-stakeholder-duplicate-returns-raw-apie.md"
  "docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-004-usecase-add-stakeholder-duplicate-returns-r.md"
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "53-dogfood-usecase-add-stakeholder-duplicate-returns-raw-apie" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] 53-dogfood-usecase-add-stakeholder-duplicate-returns-raw-apie inputs unchanged"
  exit 0
fi

PASS=true

echo "[53.A1] source dogfood finding is resolved"
if grep -q '^resolved: true' "docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-004-usecase-add-stakeholder-duplicate-returns-r.md"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — resolve the finding and set resolved: true in docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-004-usecase-add-stakeholder-duplicate-returns-r.md"
  PASS=false
fi

echo "[53.B1] gate rigor"
if bash scripts/check-gate-rigor.sh "goals/53-dogfood-usecase-add-stakeholder-duplicate-returns-raw-apie.md" >/dev/null; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — gate rigor failed for goals/53-dogfood-usecase-add-stakeholder-duplicate-returns-raw-apie.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "53-dogfood-usecase-add-stakeholder-duplicate-returns-raw-apie" "${GATE_INPUTS[@]}"
  exit 0
fi
exit 1
