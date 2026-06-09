#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
source "$ROOT/scripts/_gate-cache.sh"

GATE_INPUTS=(
  "goals/50-dogfood-session-start-format-agent-returns-a-bare-error-mi.md"
  "docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-002-session-start-format-agent-returns-a-bare-e.md"
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "50-dogfood-session-start-format-agent-returns-a-bare-error-mi" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] 50-dogfood-session-start-format-agent-returns-a-bare-error-mi inputs unchanged"
  exit 0
fi

PASS=true

echo "[50.A1] source dogfood finding is resolved"
if grep -q '^resolved: true' "docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-002-session-start-format-agent-returns-a-bare-e.md"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — resolve the finding and set resolved: true in docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-002-session-start-format-agent-returns-a-bare-e.md"
  PASS=false
fi

echo "[50.B1] gate rigor"
if bash scripts/check-gate-rigor.sh "goals/50-dogfood-session-start-format-agent-returns-a-bare-error-mi.md" >/dev/null; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — gate rigor failed for goals/50-dogfood-session-start-format-agent-returns-a-bare-error-mi.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "50-dogfood-session-start-format-agent-returns-a-bare-error-mi" "${GATE_INPUTS[@]}"
  exit 0
fi
exit 1
