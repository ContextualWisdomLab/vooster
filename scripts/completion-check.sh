#!/usr/bin/env bash
# completion-check.sh — Are we done?
#
# Iterates every goal in goals/ in numeric order and runs that goal's
# `<n>-<name>.gates.sh`. Writes the path of the first failing goal to
# .state/active-goal so diagnose.sh and next-task.sh can route correctly.
# Exit 0 only when every gate of every goal passes.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p "$ROOT/.state"
ACTIVE_FILE="$ROOT/.state/active-goal"

GOALS=()
while IFS= read -r f; do
  GOALS+=("$f")
done < <(find goals -maxdepth 1 -name '*.md' -type f 2>/dev/null | sort)

if [ "${#GOALS[@]}" -eq 0 ]; then
  echo "✗ completion-check: no goals/*.md found."
  echo "(none)" > "$ACTIVE_FILE"
  exit 1
fi

OVERALL_PASS=true
ACTIVE_RECORDED=false

echo "=== COMPLETION CHECK ==="
echo ""

for goal_md in "${GOALS[@]}"; do
  goal_name=$(basename "$goal_md" .md)
  gate_script="goals/${goal_name}.gates.sh"
  echo "--- Goal: $goal_name ($goal_md) ---"

  if [ ! -x "$gate_script" ] && [ ! -f "$gate_script" ]; then
    echo "    ✗ missing gate script: $gate_script"
    OVERALL_PASS=false
    if [ "$ACTIVE_RECORDED" = false ]; then
      echo "$goal_md" > "$ACTIVE_FILE"
      ACTIVE_RECORDED=true
    fi
    echo ""
    continue
  fi

  if bash "$gate_script"; then
    echo "    ✓ goal $goal_name passes all gates."
  else
    echo "    ✗ goal $goal_name has failing gates."
    OVERALL_PASS=false
    if [ "$ACTIVE_RECORDED" = false ]; then
      echo "$goal_md" > "$ACTIVE_FILE"
      ACTIVE_RECORDED=true
    fi
  fi
  echo ""
done

if [ "$OVERALL_PASS" = true ]; then
  echo "ALL_DONE" > "$ACTIVE_FILE"
  echo "🎉 ALL GOALS ACHIEVED. Every gate of every goal passes."
  exit 0
fi

echo "⚠ Active goal: $(cat "$ACTIVE_FILE")"
echo "  Continue iterating against that goal."
exit 1
