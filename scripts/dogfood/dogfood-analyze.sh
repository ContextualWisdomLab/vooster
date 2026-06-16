#!/usr/bin/env bash
# scripts/dogfood/dogfood-analyze.sh — Step 2 of a dogfood cycle: analyze ONE run.
#
# Turn the captured session transcript into machine-readable findings by running
# the analyze-session skill's logic headlessly. Rather than parsing claude's
# stdout (a JSON envelope whose .result is unstable to coax into strict JSON),
# we hand claude the input file paths and an EXACT output path and have it WRITE
# the findings JSON there with its file tools. We then read + validate that file.
# Output: dogfood/runs/<cycle>/<case>/findings.json. Design: docs/dogfood-loop.md.
#
# A failed analysis is a HARNESS error, not a product finding: we never fabricate
# findings (that path produced false clean passes and junk goals). If the file is
# missing/invalid after a retry, we exit non-zero so the cycle surfaces it.
#
# Usage:  bash scripts/dogfood/dogfood-analyze.sh <cycle-id> <DF-id>
# Exit:   0 ok · 1 hard error (analyzer produced no valid findings file).

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
# shellcheck source=./_dogfood-lib.sh
source "$ROOT/scripts/dogfood/_dogfood-lib.sh"

CYCLE="${1:?usage: dogfood-analyze.sh <cycle-id> <DF-id>}"
CASE="${2:?usage: dogfood-analyze.sh <cycle-id> <DF-id>}"

RUN_DIR="$(df_runs_dir)/$CYCLE/$CASE"
SESSION="$RUN_DIR/session.jsonl"
OUT="$RUN_DIR/findings.json"
DIGEST="$RUN_DIR/digest.txt"
EXTRACT="$ROOT/.claude/skills/analyze-session/scripts/extract.sh"
SKILL="$ROOT/.claude/skills/analyze-session/SKILL.md"
RUBRIC="$ROOT/dogfood/rubric.md"
SCHEMA="$ROOT/dogfood/schema/findings.schema.json"
TIMEOUT="${VSPEC_DOGFOOD_ANALYZE_TIMEOUT_SECONDS:-420}"

echo "=== analyze $CASE (cycle $CYCLE) ==="

if df_dry_run; then
  echo "  [dry-run] would: extract.sh → claude writes $OUT (file tool) → validate"
  printf '{"case_id":"%s","summary":"dry-run","task_succeeded":true,"findings":[]}\n' "$CASE" > "$OUT"
  echo "✓ analyze $CASE (dry-run, empty findings)"
  exit 0
fi

[ -s "$SESSION" ] || df_die "no session transcript at $SESSION (run step did not capture one)"
df_require_cmd jq

# 2.1 distill (never read raw jsonl directly)
if [ -x "$EXTRACT" ]; then
  bash "$EXTRACT" "$SESSION" > "$DIGEST" 2>/dev/null || df_die "extract.sh failed on $SESSION"
else
  df_die "analyze-session extractor missing: $EXTRACT"
fi

# 2.2 Have claude READ the inputs and WRITE the findings file. The deliverable is
#     the file at $OUT, not stdout — far more reliable than parsing .result.
ANALYZE_PROMPT="You are analyzing ONE vspec dogfood session for case $CASE.

Steps:
1. Read the session digest:       $DIGEST
2. Read the analysis methodology: $SKILL   (use friction catalog §3, QUANTS §4, finding format §5)
3. Read the scoring rubric:       $RUBRIC
4. Read the output JSON schema:   $SCHEMA
5. Derive findings GROUNDED in the digest — no evidence means no finding. Severity:
   P0 = corruption/contract break, P1 = agent-recovery or core-workflow bug,
   P2 = polish. Set routing='claude' ONLY for presentation root-cause
   (apps/app, apps/www); otherwise routing='codex'.
6. Using the Write tool, write a SINGLE JSON object that validates against the
   schema to EXACTLY this path:

       $OUT

   If the session shows no real issues, still write the object with
   \"findings\": []. The findings concern the vspec PRODUCT (CLI/API/contracts/
   web/sync/ai-guide), never this dogfood harness.

The file at $OUT is the only deliverable. Do not print the findings to stdout."

run_analyzer() {
  rm -f "$OUT"
  ( df_claude "$ROOT" "$VSPEC_DOGFOOD_CASE_BUDGET_USD" "$ANALYZE_PROMPT" >/dev/null 2>&1 ) &
  local pid=$! elapsed=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$elapsed" -ge "$TIMEOUT" ]; then
      pkill -TERM -P "$pid" 2>/dev/null || true; kill -TERM "$pid" 2>/dev/null || true
      sleep 1
      pkill -KILL -P "$pid" 2>/dev/null || true; kill -KILL "$pid" 2>/dev/null || true
      return 124
    fi
    sleep 1; elapsed=$((elapsed + 1))
  done
  wait "$pid"
}

# Valid iff the file exists, parses, and carries the required shape.
findings_valid() {
  jq -e '.case_id and (.findings|type=="array")' "$OUT" >/dev/null 2>&1
}

ledger_append "$CYCLE" "analyze:$CASE" "0" "file-write"

run_analyzer || true
if ! findings_valid; then
  echo "  ⚠ analyzer did not produce a valid $OUT — retrying once"
  run_analyzer || true
fi

if ! findings_valid; then
  df_die "analyzer produced no valid findings file for $CASE after retry (see $RUN_DIR; digest at $DIGEST). This is a harness failure — not treating it as a clean pass."
fi

# Pin case_id (claude may omit/mistype it) and report.
tmp="$(mktemp)"; jq --arg c "$CASE" '.case_id=$c' "$OUT" > "$tmp" && mv "$tmp" "$OUT"
n="$(jq '.findings | length' "$OUT")"
echo "✓ analyze $CASE → $n finding(s)"
