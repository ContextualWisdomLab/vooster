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

# Record all dogfood findings as debt. Only P0/P1 findings become build goals.
findings="$(jq -s '[.[] as $doc | $doc.findings[]? | select(.severity=="P0" or .severity=="P1" or .severity=="P2") | . + {case_id: ($doc.case_id // "unknown")}]' "${findings_files[@]}")"
count="$(echo "$findings" | jq 'length')"

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

write_fallback_goal() {
  local dest_dir="$1" goal_n="$2" goal_name="$3" finding_md="$4" title="$5" rec="$6" area="$7"
  local rel_finding rel_goal md_file gates_file next_file
  rel_finding="${finding_md#$ROOT/}"
  rel_goal="goals/${goal_name}.md"
  md_file="$dest_dir/${goal_name}.md"
  gates_file="$dest_dir/${goal_name}.gates.sh"
  next_file="$dest_dir/${goal_name}.next-task.sh"

  cat > "$md_file" <<EOF
# Goal $goal_n: Dogfood Finding Follow-Up

Resolve the dogfood finding **$title**.

Source finding: \`$rel_finding\`

Root-cause area: \`$area\`

## Completion

A. The source finding is marked \`resolved: true\` after the implementation
addresses the recommendation below.

B. The implementation has been verified with the smallest relevant test or
dogfood rerun, and the finding document records that evidence.

## Recommendation

$rec
EOF

  cat > "$gates_file" <<EOF
#!/usr/bin/env bash
set -uo pipefail
ROOT="\$(cd "\$(dirname "\$0")/.." && pwd)"; cd "\$ROOT"
source "\$ROOT/scripts/_gate-cache.sh"

GATE_INPUTS=(
  "$rel_goal"
  "$rel_finding"
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$goal_name" "\${GATE_INPUTS[@]}"; then
  echo "[cache hit] $goal_name inputs unchanged"
  exit 0
fi

PASS=true

echo "[$goal_n.A1] source dogfood finding is resolved"
if grep -q '^resolved: true' "$rel_finding"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — resolve the finding and set resolved: true in $rel_finding"
  PASS=false
fi

echo "[$goal_n.B1] gate rigor"
if bash scripts/check-gate-rigor.sh "$rel_goal" >/dev/null; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — gate rigor failed for $rel_goal"
  PASS=false
fi

if [ "\$PASS" = true ]; then
  gate_cache_save "$goal_name" "\${GATE_INPUTS[@]}"
  exit 0
fi
exit 1
EOF

  cat > "$next_file" <<EOF
#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "$title".

1. Read $rel_finding.
2. Add a failing test that captures the finding's user-visible failure.
3. Implement the smallest fix in the stated root-cause area.
4. Run the targeted test and relevant gate.
5. Update $rel_finding with verification evidence and set resolved: true.
TASK
EOF
  chmod +x "$gates_file" "$next_file"
}

TS="$(date -u +%Y-%m-%dT%H%M)"
TSZ="$(date -u +%FT%TZ)"
SPAWNED="$(df_state_dir)/spawned-goals"
: > "$SPAWNED"

[ "$count" -gt 0 ] || { echo "  no findings to record"; exit 0; }

for i in $(seq 0 $((count - 1))); do
  f="$(echo "$findings" | jq ".[$i]")"
  case_id="$(echo "$f" | jq -r '.case_id // "unknown"')"
  title="$(echo "$f" | jq -r '.title')"
  sev="$(echo "$f" | jq -r '.severity')"
  routing="$(echo "$f" | jq -r '.routing // "codex"')"
  area="$(echo "$f" | jq -r '.root_cause_area // "unknown"')"
  rec="$(echo "$f" | jq -r '.recommendation // ""')"
  evidence="$(echo "$f" | jq -r '.evidence // ""')"
  quants="$(echo "$f" | jq -r '(.quants // []) | join("")')"
  slug="$(slugify "$title")"

  # ── step 4: findings doc (deterministic) ──────────────────────────────────
  doc_slug="$(slugify "$case_id-$title")"
  finding_md=""
  for candidate in "$ROOT"/docs/findings/*-dogfood-"$CYCLE"-"$doc_slug".md; do
    [ -f "$candidate" ] && { finding_md="$candidate"; break; }
  done
  [ -n "$finding_md" ] || finding_md="$ROOT/docs/findings/${TS}-dogfood-${CYCLE}-${doc_slug}.md"
  prio="$sev"
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

  if [ "$sev" != "P0" ] && [ "$sev" != "P1" ]; then
    continue
  fi

  # ── step 5: goal trio ──────────────────────────────────────────────────────
  if df_dry_run; then
    echo "  [dry-run] would draft a goal trio for: $title (routing=$routing)"
    continue
  fi

  GOAL_N="$(next_goal_number)"
  GOAL_NAME="${GOAL_N}-dogfood-${slug}"

  dest_dir="$ROOT/goals"
  [ "$VSPEC_DOGFOOD_GOALIFY" = "draft" ] && dest_dir="$ROOT/dogfood/goal-drafts/$CYCLE"
  mkdir -p "$dest_dir"
  md_path="$dest_dir/${GOAL_NAME}.md"
  gates_path="$dest_dir/${GOAL_NAME}.gates.sh"
  next_path="$dest_dir/${GOAL_NAME}.next-task.sh"
  rm -f "$md_path" "$gates_path" "$next_path"

  # Have claude WRITE the three files directly (file tools), not emit JSON on
  # stdout — same reliability reason as the analyzer.
  GOALIFY_PROMPT="Author ONE build goal trio for the vspec autonomous build harness,
addressing the finding below. First read docs/goal-design.md in this repo, then follow it strictly:
- the .md states completion conditions in natural language; a universal claim
  ('every X ...') requires the .gates.sh to enumerate X from a source of truth
  and loop (no single-case cheat);
- the .gates.sh must NOT grep for things a test/typecheck/coverage already
  proves (§1.5); it must source scripts/_gate-cache.sh and declare GATE_INPUTS;
  keep it minimal (see the ~63-line reference pattern);
- Routing is '$routing'. If 'claude', the .md MUST include a '## Delegation'
  section (owner: claude, cwd: <the presentation app dir e.g. apps/app>, model: opus)
  and next-task.sh may be trivial; if 'codex', write a normal TDD goal.

Using the Write tool, create EXACTLY these three files with complete, valid contents:
  $md_path
  $gates_path
  $next_path
The .gates.sh and .next-task.sh must be runnable bash. Write the files only; do
not print their contents to stdout.

=== FINDING ===
$f"

  ( df_claude "$ROOT" "$VSPEC_DOGFOOD_CASE_BUDGET_USD" "$GOALIFY_PROMPT" >/dev/null 2>&1 ) &
  gpid=$!; gelapsed=0
  while kill -0 "$gpid" 2>/dev/null; do
    if [ "$gelapsed" -ge "${VSPEC_DOGFOOD_GOALIFY_TIMEOUT_SECONDS:-420}" ]; then
      pkill -TERM -P "$gpid" 2>/dev/null || true; kill -TERM "$gpid" 2>/dev/null || true; sleep 1
      pkill -KILL -P "$gpid" 2>/dev/null || true; kill -KILL "$gpid" 2>/dev/null || true; break
    fi
    sleep 1; gelapsed=$((gelapsed + 1))
  done
  wait "$gpid" 2>/dev/null || true
  ledger_append "$CYCLE" "goalify:$GOAL_NAME" "0" "$routing"

  if [ -s "$md_path" ] && [ -s "$gates_path" ] && [ -s "$next_path" ]; then
    chmod +x "$gates_path" "$next_path"
  else
    echo "  ⚠ goal trio for '$title' not fully written — adopting deterministic fallback goal"
    write_fallback_goal "$dest_dir" "$GOAL_N" "$GOAL_NAME" "$finding_md" "$title" "$rec" "$area"
  fi

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
