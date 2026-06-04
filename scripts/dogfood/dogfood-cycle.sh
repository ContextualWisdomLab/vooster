#!/usr/bin/env bash
# scripts/dogfood/dogfood-cycle.sh — One dogfood cycle (the codex-goal entrypoint).
#
# Exercises the shipped vspec product as an ICP agent across dogfood/cases/*.md,
# analyzes the sessions, and — if real friction is found — records findings and
# spawns improvement goals for the build loop. This is a STANDALONE codex goal
# (dogfood/DOGFOOD-GOAL.md), independent of the goals/ build stack; it alternates
# with the build loop via its exit code. Full design: docs/dogfood-loop.md.
#
# Usage:  bash scripts/dogfood/dogfood-cycle.sh
#         bash scripts/dogfood/dogfood-cycle.sh --self-test
# Exit:   0  clean pass (no P0/P1)            → loop done, STOP
#         2  findings written + goals spawned → run build loop, then re-invoke
#         1  hard error
#         3  cycle/budget cap hit (blocker written)

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
# shellcheck source=./_dogfood-lib.sh
source "$ROOT/scripts/dogfood/_dogfood-lib.sh"

DF="$ROOT/scripts/dogfood"

# ── self-test: exercise the whole pipeline in dry-run, no claude, no repo ─────
if [ "${1:-}" = "--self-test" ]; then
  echo "=== dogfood-cycle --self-test (dry-run, no claude) ==="
  export VSPEC_DOGFOOD_DRY_RUN=1
  export VSPEC_DOGFOOD_CASES="${VSPEC_DOGFOOD_CASES:-DF-001}"
  bash "$DF/_dogfood-lib.sh" --self-test || exit 1
  bash "$DF/dogfood-provision.sh" || exit 1
  cyc="selftest-$(date -u +%H%M%S)"
  for c in $(select_cases); do
    bash "$DF/dogfood-run.sh" "$cyc" "$c" || exit 1
    bash "$DF/dogfood-analyze.sh" "$cyc" "$c" || exit 1
  done
  bash "$DF/dogfood-triage.sh" "$cyc"; tr=$?
  [ "$tr" = "0" ] || { echo "✗ expected clean pass (0) on empty dry-run findings, got $tr"; exit 1; }
  rm -rf "$(df_runs_dir)/$cyc"
  echo "✓ dogfood-cycle --self-test passed"
  exit 0
fi

# ── pre-flight: stop if we've hit the cycle/budget cap ───────────────────────
if current_cycle_has_clean_triage; then
  CYCLE="$(current_cycle_id)"
  bash "$DF/dogfood-goalify.sh" "$CYCLE" || exit 1
  echo "✓ cycle $CYCLE: clean pass already recorded — dogfood loop is DONE."
  exit 0
fi
cycle_guard_or_exit3

# ── 0. provision ─────────────────────────────────────────────────────────────
bash "$DF/dogfood-provision.sh" || exit 1

# ── 1+2. run + analyze every selected case ──────────────────────────────────
CYCLE="$(new_cycle_id)"
echo "=== dogfood cycle $CYCLE ==="
cases="$(select_cases)"
[ -n "$cases" ] || { echo "✗ no cases under $(df_cases_dir)"; exit 1; }
for c in $cases; do
  bash "$DF/dogfood-run.sh" "$CYCLE" "$c"     || exit 1
  bash "$DF/dogfood-analyze.sh" "$CYCLE" "$c" || exit 1
done

# ── 3. triage / stop decision ────────────────────────────────────────────────
bash "$DF/dogfood-triage.sh" "$CYCLE"
case $? in
  0)  bash "$DF/dogfood-goalify.sh" "$CYCLE" || exit 1
      echo "✓ cycle $CYCLE: clean pass — dogfood loop is DONE."; exit 0 ;;
  10) ;;                                  # actionable findings → continue
  3)  exit 3 ;;                           # cap hit (blocker already written)
  *)  exit 1 ;;
esac

# ── 4+5. findings + goalify ──────────────────────────────────────────────────
bash "$DF/dogfood-goalify.sh" "$CYCLE" || exit 1

spawned="$(grep -c . "$(df_state_dir)/spawned-goals" 2>/dev/null)"; spawned="${spawned:-0}"
echo "=== cycle $CYCLE: $spawned goal(s) spawned; build loop must run before next cycle ==="
exit 2
