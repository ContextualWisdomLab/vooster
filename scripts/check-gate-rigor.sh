#!/usr/bin/env bash
# check-gate-rigor.sh — Meta-gate: if a goal's markdown claims universality
# ("every entity / UC / model / route / file / command"), the matching
# `<n>-<name>.gates.sh` MUST contain at least one iteration construct
# (for / while / find / xargs / mapfile / readarray).
#
# Why this exists: Goal 1's persistence gate passed by testing a single
# workspace slug while the goal text claimed "every entity." The fix is
# not to police phrasing but to require gates to enumerate from a source
# of truth.
#
# Usage:
#   scripts/check-gate-rigor.sh                       # checks the active goal
#   scripts/check-gate-rigor.sh goals/2-shippable.md  # checks one goal
#   scripts/check-gate-rigor.sh --all                 # checks all goals

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

UNIVERSAL_RE='every (entity|use case|usecase|UC|model|route|endpoint|file|command|gate)'
ITER_RE='\<for\>|while\s+IFS|while\s+read|\<find\>|\<xargs\>|mapfile|readarray'

check_one() {
  local md="$1"
  local name gate
  name=$(basename "$md" .md)
  gate="goals/${name}.gates.sh"

  if [ ! -f "$gate" ]; then
    echo "✗ check-gate-rigor: $gate missing"
    return 1
  fi

  local claims
  claims=$(grep -iEo "$UNIVERSAL_RE" "$md" | sort -u || true)
  if [ -z "$claims" ]; then
    return 0
  fi

  if grep -qE "$ITER_RE" "$gate" 2>/dev/null; then
    return 0
  fi

  echo "✗ check-gate-rigor: $name claims universality:"
  echo "$claims" | sed 's/^/        /'
  echo "    but $gate has no for / while / find / xargs iteration."
  return 1
}

case "${1:-}" in
  --all)
    FAIL=0
    while IFS= read -r md; do
      check_one "$md" || FAIL=1
    done < <(find goals -maxdepth 1 -name '*.md' -type f | sort)
    if [ "$FAIL" -ne 0 ]; then
      exit 1
    fi
    echo "✓ check-gate-rigor: every goal with universal claims has an iterating gate"
    exit 0
    ;;
  '')
    ACTIVE_FILE="$ROOT/.state/active-goal"
    if [ -f "$ACTIVE_FILE" ]; then
      ACTIVE=$(cat "$ACTIVE_FILE")
    else
      ACTIVE=""
    fi
    if [ -z "$ACTIVE" ] || [ "$ACTIVE" = ALL_DONE ] || [ ! -f "$ACTIVE" ]; then
      echo "✓ check-gate-rigor: no failing goal to check"
      exit 0
    fi
    if check_one "$ACTIVE"; then
      echo "✓ check-gate-rigor: $(basename "$ACTIVE" .md) gate iterates as required"
      exit 0
    fi
    exit 1
    ;;
  *)
    if [ ! -f "$1" ]; then
      echo "✗ check-gate-rigor: '$1' is not a file"
      exit 1
    fi
    if check_one "$1"; then
      echo "✓ check-gate-rigor: $(basename "$1" .md) gate iterates as required"
      exit 0
    fi
    exit 1
    ;;
esac
