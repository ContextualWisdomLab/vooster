#!/usr/bin/env bash
# next-task.sh — Dispatch to the active goal's per-goal task hint script.
#
# Reads .state/active-goal (written by completion-check.sh).
# If absent, falls back to the lowest-numbered goal in goals/.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ACTIVE_FILE="$ROOT/.state/active-goal"

if [ -f "$ACTIVE_FILE" ]; then
  ACTIVE=$(cat "$ACTIVE_FILE")
else
  ACTIVE=""
fi

if [ "$ACTIVE" = "ALL_DONE" ]; then
  cat <<'EOF'
TASK: All goals complete.
  - Every gate of every goal in goals/ passes.
  - Either add a new goals/<n>-<name>.md (+ .gates.sh + .next-task.sh) or stop.
EOF
  exit 0
fi

# Fallback: pick the lowest-numbered goal whose gate script is not provably green.
if [ -z "$ACTIVE" ] || [ ! -f "$ACTIVE" ]; then
  ACTIVE=$(find goals -maxdepth 1 -name '*.md' -type f 2>/dev/null | sort -V | head -1)
fi

if [ -z "$ACTIVE" ] || [ ! -f "$ACTIVE" ]; then
  echo "TASK: No goal files found under goals/."
  echo "  - Create goals/0-init.md (mission), goals/0-init.gates.sh (gates),"
  echo "    goals/0-init.next-task.sh (next-task hints)."
  exit 0
fi

goal_name=$(basename "$ACTIVE" .md)

# Delegated goal? If the active goal's .md declares a `## Delegation` section
# with `owner: claude`, route to the headless delegation dispatcher instead of
# the normal TDD next-task. The dispatcher (scripts/delegate-to-claude.sh)
# calls the per-goal next-task.sh directly to obtain each step, so detecting it
# here does not recurse. See docs/claude/delegation.md.
if awk '/^## Delegation/{s=1;next} /^## /{s=0} s && /owner:[[:space:]]*claude/{found=1} END{exit !found}' "$ACTIVE" 2>/dev/null; then
  cat <<EOF
TASK: '$goal_name' is a claude-owned goal (## Delegation marker).
  Do NOT build it with TDD yourself. Delegate to Claude Code headless:

    bash scripts/delegate-to-claude.sh $goal_name

  The dispatcher self-loops (one Claude step per round) until the goal's
  gates pass (exit 0), or it stalls / exceeds budget (exit 3 — a blocker is
  written to docs/state/blockers.md). After it returns 0, run:

    bash scripts/completion-check.sh

  to verify the gate and advance .state/active-goal.
  Contract: docs/claude/delegation.md
EOF
  exit 0
fi

task_script="goals/${goal_name}.next-task.sh"

if [ ! -f "$task_script" ]; then
  cat <<EOF
TASK: Active goal '$goal_name' has no next-task script.
  - Run: bash goals/${goal_name}.gates.sh   # see which gate is failing
  - Then address it directly per goals/${goal_name}.md.
EOF
  exit 0
fi

exec bash "$task_script"
