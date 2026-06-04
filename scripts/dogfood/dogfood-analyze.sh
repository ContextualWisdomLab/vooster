#!/usr/bin/env bash
# scripts/dogfood/dogfood-analyze.sh — Step 2 of a dogfood cycle: analyze ONE run.
#
# Turn the captured session transcript into machine-readable findings by running
# the analyze-session skill's logic headlessly: distill the .jsonl with the
# skill's extractor, then ask claude (constrained to the findings schema) to
# score it against the rubric. Output: dogfood/runs/<cycle>/<case>/findings.json.
# Design: docs/dogfood-loop.md § "분석".
#
# Usage:  bash scripts/dogfood/dogfood-analyze.sh <cycle-id> <DF-id>
# Exit:   0 ok · 1 hard error.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
# shellcheck source=./_dogfood-lib.sh
source "$ROOT/scripts/dogfood/_dogfood-lib.sh"

CYCLE="${1:?usage: dogfood-analyze.sh <cycle-id> <DF-id>}"
CASE="${2:?usage: dogfood-analyze.sh <cycle-id> <DF-id>}"

RUN_DIR="$(df_runs_dir)/$CYCLE/$CASE"
SESSION="$RUN_DIR/session.jsonl"
OUT="$RUN_DIR/findings.json"
EXTRACT="$ROOT/.claude/skills/analyze-session/scripts/extract.sh"
SKILL="$ROOT/.claude/skills/analyze-session/SKILL.md"
RUBRIC="$ROOT/dogfood/rubric.md"
SCHEMA="$ROOT/dogfood/schema/findings.schema.json"

echo "=== analyze $CASE (cycle $CYCLE) ==="

if df_dry_run; then
  echo "  [dry-run] would: extract.sh → claude -p (schema-constrained) → findings.json"
  printf '{"case_id":"%s","summary":"dry-run","task_succeeded":true,"findings":[]}\n' "$CASE" > "$OUT"
  echo "✓ analyze $CASE (dry-run, empty findings)"
  exit 0
fi

[ -s "$SESSION" ] || df_die "no session transcript at $SESSION (run step did not capture one)"
df_require_cmd jq

# 2.1 distill (never read raw jsonl directly)
DIGEST="$RUN_DIR/digest.txt"
if [ -x "$EXTRACT" ]; then
  bash "$EXTRACT" "$SESSION" > "$DIGEST" 2>/dev/null || df_die "extract.sh failed on $SESSION"
else
  df_die "analyze-session extractor missing: $EXTRACT"
fi

# 2.2 ask claude to score, constrained to the findings schema
ANALYZE_PROMPT="You are analyzing ONE dogfood session for case $CASE. Apply the
analyze-session methodology (friction catalog §3, QUANTS §4, finding format §5)
and the dogfood rubric below. Ground EVERY finding in the digest; no evidence
means no finding. Severity: P0 corruption/contract break, P1 agent-recovery or
core-workflow bug, P2 polish. Set routing='claude' only for presentation
root-cause (apps/app, apps/www); otherwise 'codex'.

Respond with ONLY a JSON object that validates against this schema — no prose,
no markdown fences:

$(cat "$SCHEMA")

=== ANALYZE-SESSION SKILL ===
$(cat "$SKILL")

=== DOGFOOD RUBRIC ===
$(cat "$RUBRIC")

=== SESSION DIGEST (case $CASE) ===
$(cat "$DIGEST")"

run_analyzer() {
  local raw_file pid elapsed rc timeout
  raw_file="$RUN_DIR/analyzer.raw"
  timeout="${VSPEC_DOGFOOD_ANALYZE_TIMEOUT_SECONDS:-420}"
  rm -f "$raw_file"
  df_claude "$ROOT" "$VSPEC_DOGFOOD_CASE_BUDGET_USD" "$ANALYZE_PROMPT" "$@" > "$raw_file" 2>/dev/null &
  pid=$!
  elapsed=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$elapsed" -ge "$timeout" ]; then
      pkill -TERM -P "$pid" 2>/dev/null || true
      kill -TERM "$pid" 2>/dev/null || true
      sleep 1
      pkill -KILL -P "$pid" 2>/dev/null || true
      kill -KILL "$pid" 2>/dev/null || true
      cat "$raw_file" 2>/dev/null || true
      return 124
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  wait "$pid"; rc=$?
  cat "$raw_file" 2>/dev/null || true
  return "$rc"
}

write_fallback_findings() {
  local reason="$1" result_summary title evidence area rec severity task_succeeded
  result_summary="$(jq -c '{subtype,is_error,total_cost_usd,session_id,errors}' "$RUN_DIR/result.json" 2>/dev/null || printf '{}')"
  if echo "$result_summary" | grep -qi 'budget'; then
    title="Dogfood case exhausted its automation budget before completion"
    area="apps/cli/src and apps/api/src/application/ai-guide.ts"
    rec="Reduce cold-start recovery loops: make ai-guide/help/errors teach the authenticated init-to-use-case path without source spelunking or repeated failed commands."
    severity="P1"
    task_succeeded="false"
  elif jq -e '.is_error == false and (.subtype // "") == "success"' "$RUN_DIR/result.json" >/dev/null 2>&1; then
    title="Dogfood analyzer did not return machine-readable findings"
    area="scripts/dogfood/dogfood-analyze.sh"
    rec="Keep analyzer calls bounded and preserve dogfood run evidence as fallback findings when Claude analysis is unavailable."
    severity="P2"
    task_succeeded="true"
  else
    title="Dogfood analyzer did not return machine-readable findings"
    area="scripts/dogfood/dogfood-analyze.sh"
    rec="Keep analyzer calls bounded and preserve dogfood run evidence as fallback findings when Claude analysis is unavailable."
    severity="P1"
    task_succeeded="false"
  fi
  evidence="Analyzer fallback reason: $reason. result.json: $result_summary"
  jq -n \
    --arg case_id "$CASE" \
    --arg summary "Fallback analysis for $CASE: the run did not produce a clean completed task signal; $reason." \
    --arg title "$title" \
    --arg evidence "$evidence" \
    --arg area "$area" \
    --arg rec "$rec" \
    --arg severity "$severity" \
    --argjson task_succeeded "$task_succeeded" \
    '{
      case_id: $case_id,
      summary: $summary,
      task_succeeded: $task_succeeded,
      findings: [
        {
          title: $title,
          severity: $severity,
          quants: ["A", "T"],
          evidence: $evidence,
          root_cause_area: $area,
          recommendation: $rec,
          routing: "codex"
        }
      ]
    }' > "$OUT"
  ledger_append "$CYCLE" "analyze:$CASE" "0" "fallback:$reason"
  echo "✓ analyze $CASE → fallback finding(s) ($reason)"
}

raw="$(run_analyzer --json-schema "$SCHEMA")"; analyzer_rc=$?
if [ "$analyzer_rc" -ne 0 ] || [ -z "$raw" ]; then
  if [ "$analyzer_rc" -ne 124 ]; then
    raw="$(run_analyzer)"; analyzer_rc=$?
  fi
fi
if [ "$analyzer_rc" -ne 0 ] || [ -z "$raw" ]; then
  write_fallback_findings "analyzer unavailable or timed out"
  exit 0
fi

cost="$(echo "$raw" | jq -r '.total_cost_usd // 0' 2>/dev/null)"
ledger_append "$CYCLE" "analyze:$CASE" "${cost:-0}" "-"

# The analyzer's findings JSON is in .result; strip any stray fences then validate.
echo "$raw" | jq -r '.result // .' 2>/dev/null \
  | sed -e 's/^```json//' -e 's/^```//' -e '/^```$/d' \
  | jq '.' > "$OUT" 2>/dev/null \
  || { write_fallback_findings "analyzer output was not valid JSON"; exit 0; }

jq -e '.case_id and (.findings|type=="array")' "$OUT" >/dev/null 2>&1 \
  || { write_fallback_findings "analyzer output missed required fields"; exit 0; }

n="$(jq '.findings | length' "$OUT")"
echo "✓ analyze $CASE → $n finding(s)"
