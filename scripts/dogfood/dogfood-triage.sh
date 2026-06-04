#!/usr/bin/env bash
# scripts/dogfood/dogfood-triage.sh — Step 3 of a dogfood cycle: decide stop/continue.
#
# Aggregate every case's findings.json for this cycle. The loop ENDS only when
# there are zero P0 and zero P1 findings across all cases; P2 findings are debt,
# not a reason to keep spinning. Design: docs/dogfood-loop.md § "종료 조건".
#
# Usage:  bash scripts/dogfood/dogfood-triage.sh <cycle-id>
# Exit:   0  clean pass (P0+P1 == 0)
#         10 actionable findings exist (P0/P1 > 0)
#         3  budget/cycle cap hit (blocker written)
#         1  hard error

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
# shellcheck source=./_dogfood-lib.sh
source "$ROOT/scripts/dogfood/_dogfood-lib.sh"

CYCLE="${1:?usage: dogfood-triage.sh <cycle-id>}"
CYCLE_DIR="$(df_runs_dir)/$CYCLE"
df_require_cmd jq

echo "=== triage cycle $CYCLE ==="

shopt -s nullglob
findings_files=("$CYCLE_DIR"/*/findings.json)
[ "${#findings_files[@]}" -gt 0 ] || df_die "no findings.json under $CYCLE_DIR — did analyze run?"

# Merge all findings into one stream, count by severity.
merged="$(jq -s '[.[].findings[]?]' "${findings_files[@]}")"
p0="$(echo "$merged" | jq '[.[]|select(.severity=="P0")]|length')"
p1="$(echo "$merged" | jq '[.[]|select(.severity=="P1")]|length')"
p2="$(echo "$merged" | jq '[.[]|select(.severity=="P2")]|length')"
total="$(echo "$merged" | jq 'length')"

echo "  findings: P0=$p0  P1=$p1  P2=$p2  (total $total)"
ledger_append "$CYCLE" "triage" "0" "P0=$p0 P1=$p1 P2=$p2"

actionable="$((p0 + p1))"
if [ "$actionable" -eq 0 ]; then
  echo "✓ clean pass — no P0/P1 findings. Loop can stop."
  exit 0
fi

# Budget/cap guard runs here too, so a long cycle with remaining actionable
# findings can't blow past the cap silently before the next cycle's pre-flight.
cycle_guard_or_exit3

echo "→ $actionable actionable finding(s); cycle continues to FINDINGS + GOALIFY."
exit 10
