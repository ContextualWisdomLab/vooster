#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source "$ROOT/scripts/_gate-cache.sh"

GATE_INPUTS=(
  "goals/41-dogfood-dogfood-case-exhausted-its-automation-budget-befor.md"
  "docs/findings/2026-06-02T2129-dogfood-dogfood-case-exhausted-its-automation-budget-befor.md"
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "41-dogfood-dogfood-case-exhausted-its-automation-budget-befor" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] 41-dogfood-dogfood-case-exhausted-its-automation-budget-befor inputs unchanged"
  exit 0
fi

PASS=true

echo "[41.A1] source dogfood finding is resolved"
if grep -q '^resolved: true' "docs/findings/2026-06-02T2129-dogfood-dogfood-case-exhausted-its-automation-budget-befor.md"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — resolve the finding and set resolved: true in docs/findings/2026-06-02T2129-dogfood-dogfood-case-exhausted-its-automation-budget-befor.md"
  PASS=false
fi

echo "[41.B1] gate rigor"
if bash scripts/check-gate-rigor.sh "goals/41-dogfood-dogfood-case-exhausted-its-automation-budget-befor.md" >/dev/null; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — gate rigor failed for goals/41-dogfood-dogfood-case-exhausted-its-automation-budget-befor.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "41-dogfood-dogfood-case-exhausted-its-automation-budget-befor" "${GATE_INPUTS[@]}"
  exit 0
fi
exit 1
