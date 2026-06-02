#!/usr/bin/env bash
# scripts/dogfood/_dogfood-lib.sh — Source-only shared helpers for the dogfood loop.
#
# The dogfood loop exercises the SHIPPED vspec product as an ICP agent would,
# finds friction, and feeds the build stack new goals. Design: docs/dogfood-loop.md.
# This file holds the pieces every dogfood-*.sh script needs: env defaults,
# cycle/state bookkeeping, case parsing, session capture, and the budget/cap
# ledger. It performs NO side effects on source — only on .state/dogfood/ and
# dogfood/runs/ (both gitignored).
#
# Usage:  source "$(dirname "$0")/_dogfood-lib.sh"
#
# DRY RUN: when VSPEC_DOGFOOD_DRY_RUN=1, callers must skip every `claude -p`
# call and every mutation of the external dogfood repo. The lib itself never
# calls claude; it just exposes df_dry_run for callers to branch on.

# ── env defaults (mirror delegate-to-claude.sh naming) ───────────────────────
: "${VSPEC_DOGFOOD_REPO:=}"                       # path to the separate dogfood repo (required for real runs)
: "${VSPEC_DOGFOOD_BASELINE:=main}"               # git ref the repo is reset to each cycle
: "${VSPEC_DOGFOOD_LINK:=pack}"                    # pack | link
: "${VSPEC_DOGFOOD_MODEL:=opus}"
: "${VSPEC_DOGFOOD_CASE_BUDGET_USD:=2.00}"
: "${VSPEC_DOGFOOD_BUDGET_USD:=20.00}"
: "${VSPEC_DOGFOOD_MAX_CYCLES:=10}"
: "${VSPEC_DOGFOOD_CASES:=}"                       # comma-separated DF ids to filter (empty = all)
: "${VSPEC_DOGFOOD_DRY_RUN:=}"
: "${VSPEC_DOGFOOD_API_URL:=}"                     # running vspec API the dogfood CLI points at
: "${VSPEC_DOGFOOD_SESSION_COOKIE:=}"              # seeded auth (headless can't do OAuth device flow)
: "${VSPEC_DOGFOOD_PROVISION_HOOK:=}"              # optional script: boot API + seed auth

# ROOT is set by the caller (each script resolves it); fall back to two-up.
DF_ROOT="${ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

df_dry_run() { [ "${VSPEC_DOGFOOD_DRY_RUN:-}" = "1" ]; }
df_log()     { printf '%s\n' "$*" >&2; }
df_die()     { printf '✗ %s\n' "$*" >&2; exit 1; }

df_require_cmd() {
  command -v "$1" >/dev/null 2>&1 || df_die "required command not on PATH: $1"
}

# ── state dirs ───────────────────────────────────────────────────────────────
df_state_dir() { printf '%s/.state/dogfood' "$DF_ROOT"; }
df_runs_dir()  { printf '%s/dogfood/runs' "$DF_ROOT"; }
df_cases_dir() { printf '%s/dogfood/cases' "$DF_ROOT"; }

df_init_state() { mkdir -p "$(df_state_dir)" "$(df_runs_dir)"; }

# new_cycle_id — UTC timestamp; persisted to .state/dogfood/cycle.
new_cycle_id() {
  df_init_state
  local id
  id="$(date -u +%Y%m%dT%H%M%SZ)"
  printf '%s\n' "$id" > "$(df_state_dir)/cycle"
  printf '%s' "$id"
}

current_cycle_id() { cat "$(df_state_dir)/cycle" 2>/dev/null || true; }

# ── case discovery + parsing ─────────────────────────────────────────────────
# select_cases — print DF ids (one per line), honoring VSPEC_DOGFOOD_CASES.
select_cases() {
  local f id
  for f in "$(df_cases_dir)"/DF-*.md; do
    [ -f "$f" ] || continue
    id="$(basename "$f" | grep -oE '^DF-[0-9]+')"
    [ -n "$id" ] || continue
    if [ -n "$VSPEC_DOGFOOD_CASES" ]; then
      case ",$VSPEC_DOGFOOD_CASES," in
        *",$id,"*) ;;
        *) continue ;;
      esac
    fi
    printf '%s\n' "$id"
  done
}

case_file() {
  local id="$1" f
  for f in "$(df_cases_dir)/$id"-*.md; do
    [ -f "$f" ] && { printf '%s' "$f"; return 0; }
  done
  return 1
}

# case_task_prompt <file> — the verbatim "## Task" section (up to the next "## ").
case_task_prompt() {
  awk '
    /^## Task[[:space:]]*$/ { grab=1; next }
    /^## / { grab=0 }
    grab { print }
  ' "$1" | sed -e '/./,$!d' | awk 'BEGIN{RS="";ORS="\n"} {print}'
}

# case_field <file> <yaml-key> — a top-level frontmatter scalar; trailing
# "# comment" stripped. Only scans the first frontmatter block.
case_field() {
  awk -v key="$2" '
    NR==1 && $0 ~ /^---[[:space:]]*$/ { infm=1; next }
    infm && $0 ~ /^---[[:space:]]*$/ { exit }
    infm && $0 ~ ("^" key ":") {
      sub(("^" key ":[[:space:]]*"), "")
      sub(/[[:space:]]*#.*$/, "")
      gsub(/[[:space:]]+$/, "")
      print
      exit
    }
  ' "$1"
}

# reset_repo_to_baseline <baseline-name> — put the dogfood repo at a pristine
# per-case baseline. Convention: case `baseline: X` maps to git ref `baseline/X`
# (falls back to a bare ref X if `baseline/X` is absent). Preserves the globally
# linked CLI (untracked) and the seeded .vspec auth so cases stay runnable.
reset_repo_to_baseline() {
  local name="$1" repo="$VSPEC_DOGFOOD_REPO" ref
  [ -d "$repo/.git" ] || { df_log "✗ reset: '$repo' is not a git repo"; return 1; }
  if git -C "$repo" rev-parse --verify -q "baseline/$name" >/dev/null; then
    ref="baseline/$name"
  elif git -C "$repo" rev-parse --verify -q "$name" >/dev/null; then
    ref="$name"
  else
    df_log "✗ reset: no baseline ref for '$name' (expected 'baseline/$name')"
    return 1
  fi
  git -C "$repo" reset --hard "$ref" >/dev/null 2>&1 || return 1
  git -C "$repo" clean -fd -e .vspec -e node_modules >/dev/null 2>&1 || return 1
}

# ── session capture ──────────────────────────────────────────────────────────
# locate_session_jsonl <session-id> — find the transcript claude wrote.
locate_session_jsonl() {
  local sid="$1"
  [ -n "$sid" ] || return 1
  find "$HOME/.claude/projects" -type f -name "$sid.jsonl" 2>/dev/null | head -1
}

# snapshot_specs <repo> <dest-dir> — copy the spec surface the agent produced
# plus a full diff against the reset baseline, so analysis has the artifacts.
snapshot_specs() {
  local repo="$1" dest="$2"
  mkdir -p "$dest"
  local d
  for d in specs .vspec docs/usecases; do
    [ -d "$repo/$d" ] && cp -R "$repo/$d" "$dest/" 2>/dev/null || true
  done
  if [ -d "$repo/.git" ]; then
    git -C "$repo" add -A >/dev/null 2>&1 || true
    git -C "$repo" diff --cached > "$dest/baseline.diff" 2>/dev/null || true
  fi
}

# ── ledger (cost + cap accounting) ───────────────────────────────────────────
# Tab-separated: ts  cycle  phase  cost_usd  note
ledger_file() { printf '%s/ledger.tsv' "$(df_state_dir)"; }

ledger_append() {
  df_init_state
  printf '%s\t%s\t%s\t%s\t%s\n' \
    "$(date -u +%FT%TZ)" "${1:--}" "${2:--}" "${3:-0}" "${4:--}" >> "$(ledger_file)"
}

ledger_total_cost() {
  local lf; lf="$(ledger_file)"
  [ -f "$lf" ] || { printf '0'; return; }
  awk -F'\t' '{s+=$4} END{printf "%.4f", s+0}' "$lf"
}

# Count how many distinct cycle ids appear in the ledger (cycles attempted).
ledger_cycle_count() {
  local lf; lf="$(ledger_file)"
  [ -f "$lf" ] || { printf '0'; return; }
  awk -F'\t' '{print $2}' "$lf" | sort -u | grep -c .
}

# cycle_guard_or_exit3 — stop the loop if MAX_CYCLES or BUDGET is exceeded.
cycle_guard_or_exit3() {
  local cycles cost over_budget
  cycles="$(ledger_cycle_count)"
  if [ "$cycles" -ge "$VSPEC_DOGFOOD_MAX_CYCLES" ]; then
    df_write_blocker "max-cycles" "ran $cycles cycles (cap $VSPEC_DOGFOOD_MAX_CYCLES)"
    exit 3
  fi
  cost="$(ledger_total_cost)"
  over_budget="$(awk -v c="$cost" -v b="$VSPEC_DOGFOOD_BUDGET_USD" 'BEGIN{print (c>=b)?1:0}')"
  if [ "$over_budget" = "1" ]; then
    df_write_blocker "budget" "spent \$$cost (cap \$$VSPEC_DOGFOOD_BUDGET_USD)"
    exit 3
  fi
}

df_write_blocker() {
  local reason="$1" detail="$2"
  local bf="$DF_ROOT/docs/state/blockers.md"
  {
    echo
    echo "- **[dogfood:$reason]** loop stopped ($detail) at $(date -u +%FT%TZ)."
    echo "  - See .state/dogfood/ledger.tsv and dogfood/runs/. Design: docs/dogfood-loop.md."
  } >> "$bf" 2>/dev/null || true
  df_log "✗ dogfood loop stopped ($reason): $detail — blocker appended."
}

# ── claude -p wrapper ────────────────────────────────────────────────────────
# df_claude <cwd> <budget-usd> <prompt> [extra args...]
# Runs claude headless, returns the raw JSON envelope on stdout. In dry-run it
# prints the composed command instead and returns a synthetic empty envelope.
df_claude() {
  local cwd="$1" budget="$2" prompt="$3"; shift 3
  if df_dry_run; then
    {
      echo "[dry-run] would run, from $cwd:"
      echo "  claude --dangerously-skip-permissions --model $VSPEC_DOGFOOD_MODEL \\"
      echo "    --output-format json --max-budget-usd $budget $* \\"
      echo "    -p <${#prompt} chars>"
    } >&2
    printf '{"is_error":false,"total_cost_usd":0,"session_id":"dry-run","num_turns":0,"result":""}'
    return 0
  fi
  ( cd "$cwd" && claude --dangerously-skip-permissions \
      --model "$VSPEC_DOGFOOD_MODEL" \
      --output-format json \
      --max-budget-usd "$budget" \
      "$@" \
      -p "$prompt" )
}

# ── self-test (no claude, no external repo) ──────────────────────────────────
_dogfood_lib_self_test() {
  local fail=0 tmp
  tmp="$(mktemp)"
  cat >"$tmp" <<'EOF'
---
id: DF-099
baseline: empty # a comment
case_budget_usd: 1.50
---

## Task

Do the thing.
Then stop.

## Success criteria

- nope
EOF
  [ "$(case_field "$tmp" id)" = "DF-099" ]            || { echo "✗ case_field id"; fail=1; }
  [ "$(case_field "$tmp" baseline)" = "empty" ]       || { echo "✗ case_field strips comment"; fail=1; }
  [ "$(case_field "$tmp" case_budget_usd)" = "1.50" ] || { echo "✗ case_field budget"; fail=1; }
  local task; task="$(case_task_prompt "$tmp")"
  printf '%s' "$task" | grep -q "Do the thing." || { echo "✗ task extract start"; fail=1; }
  printf '%s' "$task" | grep -q "Then stop."    || { echo "✗ task extract body"; fail=1; }
  printf '%s' "$task" | grep -q "Success"       && { echo "✗ task leaked next section"; fail=1; }
  VSPEC_DOGFOOD_DRY_RUN=1
  local env; env="$(df_claude /tmp 1.00 "hello")"
  printf '%s' "$env" | grep -q '"is_error":false' || { echo "✗ df_claude dry-run envelope"; fail=1; }
  rm -f "$tmp"
  if [ "$fail" -eq 0 ]; then echo "✓ _dogfood-lib self-test passed"; return 0; fi
  return 1
}

if [ "${1:-}" = "--self-test" ] && [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  _dogfood_lib_self_test
fi
