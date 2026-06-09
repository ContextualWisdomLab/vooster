#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source "$ROOT/scripts/_gate-cache.sh"

GATE_INPUTS=(
  "goals/51-dogfood-session-complete-with-no-id-leaks-a-raw-apierror-4.md"
  "docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-003-session-complete-with-no-id-leaks-a-raw-api.md"
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "51-dogfood-session-complete-with-no-id-leaks-a-raw-apierror-4" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] 51-dogfood-session-complete-with-no-id-leaks-a-raw-apierror-4 inputs unchanged"
  exit 0
fi

PASS=true

echo "[51.A1] source dogfood finding is resolved"
if grep -q '^resolved: true' "docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-003-session-complete-with-no-id-leaks-a-raw-api.md"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — resolve the finding and set resolved: true in docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-003-session-complete-with-no-id-leaks-a-raw-api.md"
  PASS=false
fi

echo "[51.B1] gate rigor"
if bash scripts/check-gate-rigor.sh "goals/51-dogfood-session-complete-with-no-id-leaks-a-raw-apierror-4.md" >/dev/null; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — gate rigor failed for goals/51-dogfood-session-complete-with-no-id-leaks-a-raw-apierror-4.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "51-dogfood-session-complete-with-no-id-leaks-a-raw-apierror-4" "${GATE_INPUTS[@]}"
  exit 0
fi
exit 1
