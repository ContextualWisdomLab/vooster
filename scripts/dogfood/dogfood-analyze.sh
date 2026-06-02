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

raw="$(df_claude "$ROOT" "$VSPEC_DOGFOOD_CASE_BUDGET_USD" "$ANALYZE_PROMPT" --json-schema "$SCHEMA" 2>/dev/null)"
if [ -z "$raw" ]; then
  # retry once WITHOUT --json-schema in case the flag is unsupported
  raw="$(df_claude "$ROOT" "$VSPEC_DOGFOOD_CASE_BUDGET_USD" "$ANALYZE_PROMPT")"
fi
[ -n "$raw" ] || df_die "analyzer returned nothing for $CASE"

cost="$(echo "$raw" | jq -r '.total_cost_usd // 0' 2>/dev/null)"
ledger_append "$CYCLE" "analyze:$CASE" "${cost:-0}" "-"

# The analyzer's findings JSON is in .result; strip any stray fences then validate.
echo "$raw" | jq -r '.result // .' 2>/dev/null \
  | sed -e 's/^```json//' -e 's/^```//' -e '/^```$/d' \
  | jq '.' > "$OUT" 2>/dev/null \
  || df_die "analyzer output for $CASE was not valid JSON (see $RUN_DIR)"

jq -e '.case_id and (.findings|type=="array")' "$OUT" >/dev/null 2>&1 \
  || df_die "analyzer output for $CASE missing required fields"

n="$(jq '.findings | length' "$OUT")"
echo "✓ analyze $CASE → $n finding(s)"
