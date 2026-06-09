#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source "$ROOT/scripts/_gate-cache.sh"

FINDING="docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-004-use-case-level-is-effectively-immutable-use.md"

GATE_INPUTS=(
  "goals/59-dogfood-use-case-level-is-effectively-immutable-usecase-se.md"
  "$FINDING"
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "59-dogfood-use-case-level-is-effectively-immutable-usecase-se" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] 59-dogfood-use-case-level-is-effectively-immutable-usecase-se inputs unchanged"
  exit 0
fi

PASS=true

echo "[59.A1] source dogfood finding is resolved"
if grep -q '^resolved: true' "$FINDING"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — resolve the finding and set resolved: true in $FINDING"
  PASS=false
fi

echo "[59.B1] gate rigor"
if bash scripts/check-gate-rigor.sh "goals/59-dogfood-use-case-level-is-effectively-immutable-usecase-se.md" >/dev/null; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — gate rigor failed for goals/59-dogfood-use-case-level-is-effectively-immutable-usecase-se.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "59-dogfood-use-case-level-is-effectively-immutable-usecase-se" "${GATE_INPUTS[@]}"
  exit 0
fi
exit 1
