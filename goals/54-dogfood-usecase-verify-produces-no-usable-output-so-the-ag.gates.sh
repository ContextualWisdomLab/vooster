#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source "$ROOT/scripts/_gate-cache.sh"

FINDING="docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-004-usecase-verify-produces-no-usable-output-so.md"

GATE_INPUTS=(
  "goals/54-dogfood-usecase-verify-produces-no-usable-output-so-the-ag.md"
  "$FINDING"
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "54-dogfood-usecase-verify-produces-no-usable-output-so-the-ag" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] 54-dogfood-usecase-verify-produces-no-usable-output-so-the-ag inputs unchanged"
  exit 0
fi

PASS=true

echo "[54.A1] source dogfood finding is resolved"
if grep -q '^resolved: true' "$FINDING"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — resolve the finding and set resolved: true in $FINDING"
  PASS=false
fi

echo "[54.B1] gate rigor"
if bash scripts/check-gate-rigor.sh "goals/54-dogfood-usecase-verify-produces-no-usable-output-so-the-ag.md" >/dev/null; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — gate rigor failed for goals/54-dogfood-usecase-verify-produces-no-usable-output-so-the-ag.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "54-dogfood-usecase-verify-produces-no-usable-output-so-the-ag" "${GATE_INPUTS[@]}"
  exit 0
fi
exit 1
