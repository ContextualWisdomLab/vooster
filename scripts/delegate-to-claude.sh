#!/usr/bin/env bash
# scripts/delegate-to-claude.sh — Delegate a claude-owned goal to Claude Code (headless).
#
# A goal whose .md declares a `## Delegation` section (owner: claude) is built
# by Claude Code instead of by the looping agent itself — used for the
# presentation layer (UI/UX, copy, design) where Claude's judgment is the
# point. This script is the deterministic single owner of ONE such goal: it
# self-loops, handing Claude one step at a time (the goal's own next-task.sh
# output) until the goal's gate suite passes — or it stalls / exceeds budget,
# at which point it records a blocker and stops.
#
# Why a self-looping script (not the agent looping):
#   - stall counting, cumulative budget, and the round cap must be
#     deterministic across invocations; an LLM loop forgets. This mirrors how
#     completion-check.sh is the single deterministic owner of chain semantics.
#   - Each Claude invocation is FRESH (no --resume): progress lives on disk +
#     in the gate, not in a session. The next round re-derives "where are we"
#     from goals/<n>.next-task.sh, exactly like the agent's own loop.
#
# Boundary model:
#   We invoke with --dangerously-skip-permissions (no permission prompt to
#   hang on) but WITHOUT --bare (so the cwd's CLAUDE.md / DESIGN.md auto-load).
#   skip-permissions removes the *prompt*, not the *blast radius* — the cwd
#   (the goal's declared app dir) is therefore the ONLY boundary. We never run
#   at the repo root and never --add-dir api/domain/ports/scripts/goals.
#
# Usage:
#   bash scripts/delegate-to-claude.sh <goal-name|path/to/goal.md|active>
#   bash scripts/delegate-to-claude.sh --self-test
#
# Env:
#   VSPEC_DELEGATE_DRY_RUN=1         parse + compose + print the claude command; no call
#   VSPEC_DELEGATE_MODEL=opus        override the goal's declared model
#   VSPEC_DELEGATE_CALL_BUDGET_USD   per-invocation --max-budget-usd (default 2.00)
#   VSPEC_DELEGATE_BUDGET_USD        cumulative cap for the whole goal (default 10.00)
#   VSPEC_DELEGATE_STALL_ROUNDS      consecutive no-progress rounds before stop (default 3)
#   VSPEC_DELEGATE_MAX_ROUNDS        hard round cap (default 40)
#
# Exit codes:
#   0  goal gate suite passes (delegated build complete)
#   1  hard error (no marker, claude is_error, missing tools, bad cwd)
#   3  stalled or budget/round cap hit — blocker written, needs human/decomposition
#
# Contract & rationale: docs/claude/delegation.md

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODEL_DEFAULT=opus
CALL_BUDGET="${VSPEC_DELEGATE_CALL_BUDGET_USD:-2.00}"
TOTAL_BUDGET="${VSPEC_DELEGATE_BUDGET_USD:-10.00}"
STALL_MAX="${VSPEC_DELEGATE_STALL_ROUNDS:-3}"
ROUND_MAX="${VSPEC_DELEGATE_MAX_ROUNDS:-40}"

# ── marker parsing ───────────────────────────────────────────────────────
# Echo the value of `- <field>: <value>` inside the `## Delegation` section.
delegation_field() {
  awk -v field="$2" '
    /^## Delegation/ { sect=1; next }
    /^## / { sect=0 }
    sect && $0 ~ ("^[[:space:]]*-[[:space:]]*" field "[[:space:]]*:") {
      sub(("^[[:space:]]*-[[:space:]]*" field "[[:space:]]*:[[:space:]]*"), "")
      gsub(/[[:space:]]+$/, "")
      print
      exit
    }
  ' "$1"
}

is_delegated() {
  [ -n "$(delegation_field "$1" owner)" ]
}

resolve_goal() {
  local arg="$1"
  if [ "$arg" = "active" ] || [ -z "$arg" ]; then
    arg=$(cat "$ROOT/.state/active-goal" 2>/dev/null || true)
  fi
  case "$arg" in
    */*) printf '%s' "$arg" ;;                 # explicit path
    *)   printf 'goals/%s.md' "${arg%.md}" ;;  # bare goal name
  esac
}

# ── self-test (no claude, no goal mutation) ──────────────────────────────
if [ "${1:-}" = "--self-test" ]; then
  tmp=$(mktemp)
  cat >"$tmp" <<'EOF'
# Goal X
## Delegation
- owner: claude
- cwd: apps/web
- model: opus
## The Goal
every page renders.
EOF
  fail=0
  [ "$(delegation_field "$tmp" owner)" = "claude" ]   || { echo "✗ owner parse"; fail=1; }
  [ "$(delegation_field "$tmp" cwd)" = "apps/web" ]   || { echo "✗ cwd parse"; fail=1; }
  [ "$(delegation_field "$tmp" model)" = "opus" ]     || { echo "✗ model parse"; fail=1; }
  is_delegated "$tmp"                                 || { echo "✗ is_delegated should be true"; fail=1; }
  cat >"$tmp" <<'EOF'
# Goal Y
## The Goal
just a normal goal, no delegation.
EOF
  ! is_delegated "$tmp"                               || { echo "✗ false positive on non-delegated goal"; fail=1; }
  rm -f "$tmp"
  if [ "$fail" -eq 0 ]; then
    echo "✓ delegate-to-claude --self-test passed"
    exit 0
  fi
  exit 1
fi

# ── resolve target goal ──────────────────────────────────────────────────
GOAL_MD=$(resolve_goal "${1:-active}")
if [ -z "$GOAL_MD" ] || [ ! -f "$GOAL_MD" ]; then
  echo "✗ delegate: goal not found: '${1:-active}' → '$GOAL_MD'"
  exit 1
fi
GOAL_NAME=$(basename "$GOAL_MD" .md)
GATE="goals/${GOAL_NAME}.gates.sh"
TASK="goals/${GOAL_NAME}.next-task.sh"

if ! is_delegated "$GOAL_MD"; then
  echo "✗ delegate: $GOAL_NAME has no '## Delegation' (owner: claude) marker."
  echo "  This goal is not claude-owned; build it with the normal TDD loop."
  exit 1
fi

CWD_REL=$(delegation_field "$GOAL_MD" cwd)
MODEL=$(delegation_field "$GOAL_MD" model)
[ -n "${VSPEC_DELEGATE_MODEL:-}" ] && MODEL="$VSPEC_DELEGATE_MODEL"
[ -n "$MODEL" ] || MODEL="$MODEL_DEFAULT"

if [ -z "$CWD_REL" ] || [ ! -d "$ROOT/$CWD_REL" ]; then
  echo "✗ delegate: ## Delegation cwd '$CWD_REL' is missing or not a directory."
  exit 1
fi
CWD_ABS="$ROOT/$CWD_REL"

if [ "${VSPEC_DELEGATE_DRY_RUN:-}" != "1" ]; then
  command -v claude >/dev/null 2>&1 || { echo "✗ delegate: claude CLI not on PATH"; exit 1; }
  command -v jq >/dev/null 2>&1     || { echo "✗ delegate: jq required to parse claude json"; exit 1; }
fi

LOG_DIR="$ROOT/.state/delegation"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/${GOAL_NAME}.log"

# ── helpers bound to the resolved goal ───────────────────────────────────
gate_green() {
  VSPEC_GATES_SKIP_DEEP=1 bash "$GATE" >/dev/null 2>&1
}

current_step() {
  if [ -f "$TASK" ]; then
    bash "$TASK" 2>/dev/null
  else
    echo "(no next-task script for $GOAL_NAME — satisfy $GATE)"
  fi
}

build_prompt() {
  local step="$1"
  printf '## Goal contract\n\n'
  cat "$GOAL_MD"
  printf '\n\n---\n\n## Current step (do ONLY this, then commit and stop)\n\n%s\n\n---\n\nComplete the current step now, then commit it.\n' "$step"
}

write_blocker() {
  local reason="$1" rnd="$2"
  local bf="$ROOT/docs/state/blockers.md"
  {
    echo
    echo "- **[delegation:$GOAL_NAME]** stopped (${reason}) after ${rnd} round(s), \$${total_cost} spent ($(date -u +%FT%TZ))."
    echo "  - Step that would not clear:"
    current_step | head -12 | sed 's/^/    > /'
    echo "  - Likely too big for single-shot delegation — decompose into smaller numbered"
    echo "    sub-goals, or inspect $LOG and $CWD_REL by hand. See docs/claude/delegation.md."
  } >> "$bf"
  echo "✗ delegation ${reason} — blocker appended to docs/state/blockers.md"
}

SYS="You are Claude Code completing ONE step of a delegated build goal for the vspec project.
The full goal contract and the single current step are in the user message.
The whole goal is accepted only when \`bash $ROOT/$GATE\` exits 0, but right now do JUST the current step.
Hard constraints:
- Work ONLY inside $CWD_ABS ($CWD_REL). Never edit files outside it — api, domain, ports, scripts/, and goals/ are off-limits.
- When the step is done, make ONE commit for it per the commit convention in CLAUDE.md, then stop.
Do not attempt the whole goal at once; the orchestrator re-invokes you for the next step."

# ── main loop ────────────────────────────────────────────────────────────
echo "=== DELEGATE: $GOAL_NAME → Claude Code (cwd=$CWD_REL, model=$MODEL) ==="

if gate_green; then
  echo "✓ $GOAL_NAME gates already pass — nothing to delegate."
  exit 0
fi

round=0
stall=0
prev_fp=""
total_cost="0.0000"

while [ "$round" -lt "$ROUND_MAX" ]; do
  round=$((round + 1))

  step=$(current_step)
  fp=$(printf '%s' "$step" | shasum -a 256 | awk '{print $1}')

  echo
  echo "--- round $round (stall $stall/$STALL_MAX, spent \$$total_cost / $TOTAL_BUDGET) ---"

  if [ "${VSPEC_DELEGATE_DRY_RUN:-}" = "1" ]; then
    echo "[dry-run] would run, from $CWD_ABS:"
    echo "  claude --dangerously-skip-permissions --model $MODEL \\"
    echo "    --append-system-prompt <contract framing, ${#SYS} chars> \\"
    echo "    --output-format json --max-budget-usd $CALL_BUDGET -p <goal.md + step>"
    echo "[dry-run] current step preview:"
    printf '%s\n' "$step" | head -20 | sed 's/^/    /'
    echo "[dry-run] stopping after composing one round."
    exit 0
  fi

  prompt=$(build_prompt "$step")

  out=$(cd "$CWD_ABS" && claude --dangerously-skip-permissions \
          --model "$MODEL" \
          --append-system-prompt "$SYS" \
          --output-format json \
          --max-budget-usd "$CALL_BUDGET" \
          -p "$prompt" 2>"$LOG_DIR/${GOAL_NAME}.stderr")
  rc=$?

  if [ "$rc" -ne 0 ]; then
    echo "✗ claude exited $rc (see $LOG_DIR/${GOAL_NAME}.stderr)"
    exit 1
  fi

  is_error=$(printf '%s' "$out" | jq -r '.is_error // false' 2>/dev/null)
  cost=$(printf '%s' "$out" | jq -r '.total_cost_usd // 0' 2>/dev/null)
  sid=$(printf '%s' "$out" | jq -r '.session_id // "-"' 2>/dev/null)
  printf '%s\tround=%s\tcost=%s\tsession=%s\tis_error=%s\n' \
    "$(date -u +%FT%TZ)" "$round" "$cost" "$sid" "$is_error" >> "$LOG"

  if [ "$is_error" = "true" ]; then
    echo "✗ claude reported is_error (round $round). Result:"
    printf '%s' "$out" | jq -r '.result' | sed 's/^/    /'
    exit 1
  fi

  total_cost=$(awk -v a="$total_cost" -v b="$cost" 'BEGIN{printf "%.4f", a + b}')

  if [ -n "$(git -C "$ROOT" status --porcelain -- "$CWD_REL" 2>/dev/null)" ]; then
    echo "⚠ working tree under $CWD_REL is dirty after round $round — claude may not have committed its step."
  fi

  if gate_green; then
    echo
    echo "✓ $GOAL_NAME gates pass after $round round(s), \$$total_cost spent."
    exit 0
  fi

  over=$(awk -v t="$total_cost" -v b="$TOTAL_BUDGET" 'BEGIN{print (t >= b) ? 1 : 0}')
  if [ "$over" = "1" ]; then
    write_blocker "budget" "$round"
    exit 3
  fi

  if [ "$fp" = "$prev_fp" ]; then
    stall=$((stall + 1))
  else
    stall=0
  fi
  prev_fp="$fp"
  if [ "$stall" -ge "$STALL_MAX" ]; then
    write_blocker "stall" "$round"
    exit 3
  fi
done

write_blocker "max-rounds" "$round"
exit 3
