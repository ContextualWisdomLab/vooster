#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source "$ROOT/scripts/_gate-cache.sh"

GOAL="62-dogfood-doctor-s-n-use-case-s-visible-count-includes-archi"

GATE_INPUTS=(
  "goals/$GOAL.md"
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] $GOAL inputs unchanged"
  exit 0
fi

PASS=true

echo "[62.A1] source dogfood finding is resolved"
if grep -q '^resolved: true' "goals/$GOAL.md"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — resolve the finding and set 'resolved: true' in goals/$GOAL.md"
  PASS=false
fi

echo "[62.B1] gate rigor"
if bash scripts/check-gate-rigor.sh "goals/$GOAL.md" >/dev/null; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — gate rigor failed for goals/$GOAL.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL" "${GATE_INPUTS[@]}"
  exit 0
fi
exit 1
