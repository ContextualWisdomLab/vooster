#!/usr/bin/env bash
# scripts/dogfood/dogfood-run.sh — Step 1 of a dogfood cycle: run ONE case.
#
# Hand the case's "## Task" prompt to `claude -p` inside the dogfood repo, then
# capture the session transcript, the generated spec snapshot, and the run
# metrics into dogfood/runs/<cycle>/<case>/. Design: docs/dogfood-loop.md.
#
# Usage:  bash scripts/dogfood/dogfood-run.sh <cycle-id> <DF-id>
# Exit:   0 ok · 1 hard error (missing tooling, non-JSON claude failure, etc.)

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
# shellcheck source=./_dogfood-lib.sh
source "$ROOT/scripts/dogfood/_dogfood-lib.sh"

CYCLE="${1:?usage: dogfood-run.sh <cycle-id> <DF-id>}"
CASE="${2:?usage: dogfood-run.sh <cycle-id> <DF-id>}"

CASE_FILE="$(case_file "$CASE")" || df_die "unknown case: $CASE"
RUN_DIR="$(df_runs_dir)/$CYCLE/$CASE"
mkdir -p "$RUN_DIR"

BUDGET="$(case_field "$CASE_FILE" case_budget_usd)"; : "${BUDGET:=$VSPEC_DOGFOOD_CASE_BUDGET_USD}"
BASELINE="$(case_field "$CASE_FILE" baseline)"; : "${BASELINE:=empty}"
TASK="$(case_task_prompt "$CASE_FILE")"
[ -n "$TASK" ] || df_die "case $CASE has an empty ## Task section"

# Per-case pristine reset (cases declare different baselines). The globally
# linked CLI and seeded .vspec auth are preserved by reset_repo_to_baseline.
if df_dry_run; then
  echo "  [dry-run] would reset dogfood repo to baseline/$BASELINE"
else
  reset_repo_to_baseline "$BASELINE" || df_die "could not reset repo to baseline '$BASELINE' for $CASE"
  prepare_case_baseline "$BASELINE"
fi

PROMPT="You are an AI coding agent working in this repository. The team manages
software specifications with a CLI tool called \`vspec\` that is installed here.
Use it as your spec tool. Complete the task below; when done, stop and summarize.

--- TASK ---
$TASK"

echo "=== run $CASE (cycle $CYCLE, budget \$$BUDGET) ==="

CWD="${VSPEC_DOGFOOD_REPO:-$ROOT}"
df_require_cmd jq
out="$(df_claude "$CWD" "$BUDGET" "$PROMPT")"
rc=$?
if [ "$rc" -ne 0 ]; then
  if echo "$out" | jq -e '.is_error == true and (.session_id | type == "string")' >/dev/null 2>&1; then
    echo "  ⚠ claude exited $rc for $CASE with a structured error result; capturing as evidence"
  else
    echo "$out" > "$RUN_DIR/result.json" 2>/dev/null || true
    df_die "claude exited $rc for $CASE"
  fi
fi

echo "$out" | jq '{type,subtype,total_cost_usd,num_turns,duration_ms,is_error,session_id,stop_reason,errors}' > "$RUN_DIR/result.json" 2>/dev/null \
  || printf '%s' "$out" > "$RUN_DIR/result.json"

cost="$(echo "$out" | jq -r '.total_cost_usd // 0' 2>/dev/null)"
ledger_append "$CYCLE" "run:$CASE" "$cost" "$(echo "$out" | jq -r '.session_id // "-"' 2>/dev/null)"

if [ "$(echo "$out" | jq -r '.is_error // false' 2>/dev/null)" = "true" ]; then
  echo "  ⚠ claude reported is_error for $CASE (captured in result.json)"
  # An errored agent run is still evidence — analysis will classify it.
fi

if df_dry_run; then
  echo "  [dry-run] would capture session.jsonl + specs-snapshot/ here"
  : > "$RUN_DIR/session.jsonl"
  echo "✓ run $CASE (dry-run)"
  exit 0
fi

sid="$(echo "$out" | jq -r '.session_id // empty' 2>/dev/null)"
jsonl="$(locate_session_jsonl "$sid")"
if [ -n "$jsonl" ]; then
  cp "$jsonl" "$RUN_DIR/session.jsonl"
else
  echo "  ⚠ could not locate session transcript for session_id=$sid"
  : > "$RUN_DIR/session.jsonl"
fi

snapshot_specs "$VSPEC_DOGFOOD_REPO" "$RUN_DIR/specs-snapshot"
echo "✓ run $CASE captured → $RUN_DIR"
