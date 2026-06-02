#!/usr/bin/env bash
# scripts/dogfood/dogfood-goalify.sh — Steps 4+5 of a dogfood cycle.
#
# Promote this cycle's actionable (P0/P1) findings into the debt queue and the
# build stack:
#   4. write a docs/findings/<ts>-dogfood-<slug>.md per finding (deterministic).
#   5. draft a goal trio (.md/.gates.sh/.next-task.sh) per finding and — in
#      adopt mode — land it in goals/, guarded by check-gate-rigor.sh, routed
#      per the finding (presentation → claude-owned, else codex TDD).
# Design + caveats: docs/dogfood-loop.md § "Goalify".
#
# Usage:  bash scripts/dogfood/dogfood-goalify.sh <cycle-id>
# Env:    VSPEC_DOGFOOD_GOALIFY=adopt|draft   (default adopt)
#           adopt — write goal trios into goals/ for the build loop to pick up.
#           draft — write findings only + goal drafts into dogfood/goal-drafts/.
# Exit:   0 ok · 1 hard error.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
# shellcheck source=./_dogfood-lib.sh
source "$ROOT/scripts/dogfood/_dogfood-lib.sh"

: "${VSPEC_DOGFOOD_GOALIFY:=adopt}"

CYCLE="${1:?usage: dogfood-goalify.sh <cycle-id>}"
CYCLE_DIR="$(df_runs_dir)/$CYCLE"
df_require_cmd jq

echo "=== goalify cycle $CYCLE (mode=$VSPEC_DOGFOOD_GOALIFY) ==="

shopt -s nullglob
findings_files=("$CYCLE_DIR"/*/findings.json)
[ "${#findings_files[@]}" -gt 0 ] || df_die "no findings.json under $CYCLE_DIR"

# Actionable findings only (P0/P1), as a compact JSON array.
actionable="$(jq -s '[.[].findings[]? | select(.severity=="P0" or .severity=="P1")]' "${findings_files[@]}")"
count="$(echo "$actionable" | jq 'length')"
[ "$count" -gt 0 ] || { echo "  no P0/P1 findings to goalify"; exit 0; }

slugify() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed -e 's/^-//' -e 's/-$//' | cut -c1-50; }
next_goal_number() {
  local max=-1 n
  for f in "$ROOT"/goals/[0-9]*-*.md; do
    [ -f "$f" ] || continue
    n="$(basename "$f" | grep -oE '^[0-9]+')"
    [ "$n" -gt "$max" ] && max="$n"
  done
  echo "$((max + 1))"
}

TS="$(date -u +%Y-%m-%dT%H%M)"
TSZ="$(date -u +%FT%TZ)"
SPAWNED="$(df_state_dir)/spawned-goals"
: > "$SPAWNED"

for i in $(seq 0 $((count - 1))); do
  f="$(echo "$actionable" | jq ".[$i]")"
  title="$(echo "$f" | jq -r '.title')"
  sev="$(echo "$f" | jq -r '.severity')"
  routing="$(echo "$f" | jq -r '.routing // "codex"')"
  area="$(echo "$f" | jq -r '.root_cause_area // "unknown"')"
  rec="$(echo "$f" | jq -r '.recommendation // ""')"
  evidence="$(echo "$f" | jq -r '.evidence // ""')"
  quants="$(echo "$f" | jq -r '(.quants // []) | join("")')"
  slug="$(slugify "$title")"

  # ── step 4: findings doc (deterministic) ──────────────────────────────────
  finding_md="$ROOT/docs/findings/${TS}-dogfood-${slug}.md"
  prio="P1"; [ "$sev" = "P0" ] && prio="P0"
  {
    echo "---"
    echo "title: $title"
    echo "created_at: $TSZ"
    echo "resolved: false"
    echo "priority: $prio"
    echo "source: dogfood-loop cycle $CYCLE"
    echo "related:"
    echo "  - docs/dogfood-loop.md"
    echo "---"
    echo
    echo "# $title"
    echo
    echo "**TL;DR.** $rec"
    echo
    echo "Surfaced by the dogfood loop (cycle \`$CYCLE\`). QUANTS: ${quants:-?}. "
    echo "Root-cause area: \`$area\`. Routing: $routing."
    echo
    echo "## Evidence"
    echo
    echo "$evidence"
    echo
    echo "## Recommendation"
    echo
    echo "$rec"
    echo
    echo "## Acceptance signal"
    echo
    echo "Re-running the dogfood case that produced this finding no longer"
    echo "reports it at P0/P1 severity."
  } > "$finding_md"
  echo "  ✓ finding: docs/findings/$(basename "$finding_md")"

  # ── step 5: goal trio ──────────────────────────────────────────────────────
  if df_dry_run; then
    echo "  [dry-run] would draft a goal trio for: $title (routing=$routing)"
    continue
  fi

  GOAL_N="$(next_goal_number)"
  GOAL_NAME="${GOAL_N}-dogfood-${slug}"

  GOALIFY_PROMPT="Author ONE build goal trio for the vspec autonomous build harness,
addressing the finding below. Follow docs/goal-design.md strictly:
- the .md states completion conditions in natural language; if it makes a
  universal claim ('every X ...') the .gates.sh MUST enumerate X from a
  source of truth and loop (no single-case cheat);
- the .gates.sh must NOT grep for things a test/typecheck/coverage already
  proves (§1.5); source scripts/_gate-cache.sh and declare GATE_INPUTS;
- keep it minimal (see the 63-line reference pattern).
Routing: this finding is routed to '$routing'. If 'claude', the .md MUST include
a '## Delegation' section (owner: claude, cwd: <the presentation app dir>, model: opus)
and you may omit a meaningful next-task.sh; if 'codex', write a normal TDD goal.

Respond with ONLY this JSON (no fences):
{\"md\": \"<full goals/${GOAL_NAME}.md contents>\",
 \"gates_sh\": \"<full goals/${GOAL_NAME}.gates.sh contents>\",
 \"next_task_sh\": \"<full goals/${GOAL_NAME}.next-task.sh contents>\"}

=== FINDING ===
$f

=== docs/goal-design.md ===
$(cat "$ROOT/docs/goal-design.md")"

  raw="$(df_claude "$ROOT" "$VSPEC_DOGFOOD_CASE_BUDGET_USD" "$GOALIFY_PROMPT")"
  cost="$(echo "$raw" | jq -r '.total_cost_usd // 0' 2>/dev/null)"
  ledger_append "$CYCLE" "goalify:$GOAL_NAME" "${cost:-0}" "$routing"
  body="$(echo "$raw" | jq -r '.result // .' 2>/dev/null | sed -e 's/^```json//' -e 's/^```//' -e '/^```$/d')"
  echo "$body" | jq -e '.md and .gates_sh and .next_task_sh' >/dev/null 2>&1 \
    || { echo "  ⚠ goal draft for '$title' was not well-formed JSON — skipping (finding still queued)"; continue; }

  dest_dir="$ROOT/goals"
  [ "$VSPEC_DOGFOOD_GOALIFY" = "draft" ] && dest_dir="$ROOT/dogfood/goal-drafts/$CYCLE"
  mkdir -p "$dest_dir"
  echo "$body" | jq -r '.md'           > "$dest_dir/${GOAL_NAME}.md"
  echo "$body" | jq -r '.gates_sh'     > "$dest_dir/${GOAL_NAME}.gates.sh"
  echo "$body" | jq -r '.next_task_sh' > "$dest_dir/${GOAL_NAME}.next-task.sh"
  chmod +x "$dest_dir/${GOAL_NAME}.gates.sh" "$dest_dir/${GOAL_NAME}.next-task.sh"

  if [ "$VSPEC_DOGFOOD_GOALIFY" = "adopt" ]; then
    if bash "$ROOT/scripts/check-gate-rigor.sh" --all >/dev/null 2>&1; then
      echo "  ✓ adopted goal: goals/${GOAL_NAME}.{md,gates.sh,next-task.sh}"
      printf '%s\n' "goals/${GOAL_NAME}.md" >> "$SPAWNED"
    else
      echo "  ⚠ goal '${GOAL_NAME}' failed check-gate-rigor — backing out, finding stays queued"
      rm -f "$dest_dir/${GOAL_NAME}".{md,gates.sh,next-task.sh}
    fi
  else
    echo "  ✓ drafted goal (review): dogfood/goal-drafts/$CYCLE/${GOAL_NAME}.*"
  fi
done

spawned_n="$(grep -c . "$SPAWNED" 2>/dev/null)"; spawned_n="${spawned_n:-0}"
echo "✓ goalify complete (${spawned_n} goal(s) spawned)"
