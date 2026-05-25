#!/usr/bin/env bash
# goals/9-cli-trim.gates.sh — Gate suite for goal 9 (CLI Spec Trim & Read-Path
# Completion).
#
# Anti-cheat principle: every "every X" claim in goals/9-cli-trim.md
# enumerates from a declared source-of-truth array. DROPPED_VERBS is the spec
# trim; IN_SCOPE_VERBS is the dispatch + honest-test + findings cleanup;
# USER_FACING_AGENT_FILES / EXCLUDED_AGENT_FILES is the envelope rollout
# scope. A single hand-fix does not pass any tranche.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="9-cli-trim"

GATE_INPUTS=(
  apps/cli/src
  apps/cli/tests/e2e-cli-honest
  apps/cli/bin
  apps/cli/package.json
  docs/07-cli-spec.md
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  scripts/check-gate-rigor.sh
  goals/9-cli-trim.gates.sh
  goals/9-cli-trim.next-task.sh
  goals/9-cli-trim.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

# ─── Sources of truth ────────────────────────────────────────────────────
CLI_SPEC=docs/07-cli-spec.md
FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
CLI_INDEX=apps/cli/src/index.ts
COMMANDS_DIR=apps/cli/src/commands
DOCTOR_CMD=apps/cli/src/commands/doctor.ts
HONEST_DIR=apps/cli/tests/e2e-cli-honest
CLI_BIN=apps/cli/bin/run.js

DROPPED_VERBS=(
  "vspec why"
  "vspec examples"
  "vspec explain"
  "vspec watch"
  "vspec help workflows"
  "vspec help concepts"
  "vspec usecase search"
)

IN_SCOPE_VERBS=(
  "project list"
  "actor list"
  "actor show"
  "actor edit"
  "actor archive"
  "stakeholder list"
  "stakeholder show"
  "stakeholder edit"
  "stakeholder archive"
  "goal show"
  "goal reject"
  "usecase set"
  "usecase restore"
  "doctor"
)

USER_FACING_AGENT_FILES=(
  apps/cli/src/commands/project.ts
  apps/cli/src/commands/actor.ts
  apps/cli/src/commands/stakeholder.ts
  apps/cli/src/commands/goal.ts
  apps/cli/src/commands/doctor.ts
)

EXCLUDED_AGENT_FILES=()

FORBIDDEN_DOCTOR_LITERALS=(
  "active voice"
  "verb voice"
  "stakeholder interest"
  "extension outcome"
  "main success scenario has"
  "Cockburn requires"
)

# ─── Tranche A — Spec & findings trim ────────────────────────────────────

echo "[9.A1 dropped verbs absent from docs/07-cli-spec.md]"
A1_OFFENDERS=()
for verb in "${DROPPED_VERBS[@]}"; do
  if grep -F -- "$verb" "$CLI_SPEC" >/dev/null 2>&1; then
    A1_OFFENDERS+=("$verb")
  fi
done
if [ "${#A1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — dropped verbs still in $CLI_SPEC:"
  printf '        %s\n' "${A1_OFFENDERS[@]}"
  PASS=false
fi

echo "[9.A2 usecase edit \$EDITOR flow absent from spec]"
A2_OFFENDERS=()
if grep -F -- 'Opens $EDITOR on the markdown form' "$CLI_SPEC" >/dev/null 2>&1; then
  A2_OFFENDERS+=("\$EDITOR phrase")
fi
if grep -E -- 'vspec usecase edit[[:space:]]+<KEY-NNN>' "$CLI_SPEC" \
    >/dev/null 2>&1; then
  A2_OFFENDERS+=("vspec usecase edit <KEY-NNN> synopsis")
fi
if [ "${#A2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — usecase edit editor flow not trimmed:"
  printf '        %s\n' "${A2_OFFENDERS[@]}"
  PASS=false
fi

# Extract the "Missing verbs" section (between its heading and the next ##).
MISSING_SECTION_TMP="$(mktemp)"
awk '
  /^## Missing verbs/ { capture=1; next }
  capture && /^## / { capture=0 }
  capture { print }
' "$FINDINGS" >"$MISSING_SECTION_TMP" 2>/dev/null

echo "[9.A3 dropped verbs absent from findings Missing-verbs bullets]"
A3_OFFENDERS=()
A3_CHECK_SET=(
  "${DROPPED_VERBS[@]}"
  "vspec usecase edit"
  "vspec usecase search"
)
for verb in "${A3_CHECK_SET[@]}"; do
  # Only look at lines that start with a `-` bullet.
  if grep -E "^- " "$MISSING_SECTION_TMP" 2>/dev/null \
       | grep -F -- "$verb" >/dev/null 2>&1; then
    A3_OFFENDERS+=("$verb")
  fi
done
if [ "${#A3_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — dropped verbs still bulleted in $FINDINGS Missing-verbs:"
  printf '        %s\n' "${A3_OFFENDERS[@]}"
  PASS=false
fi

echo "[9.A4 in-scope verbs absent from findings Missing-verbs bullets]"
A4_OFFENDERS=()
for verb in "${IN_SCOPE_VERBS[@]}"; do
  if grep -E "^- " "$MISSING_SECTION_TMP" 2>/dev/null \
       | grep -F -- "vspec $verb" >/dev/null 2>&1; then
    A4_OFFENDERS+=("vspec $verb")
  fi
done
if [ "${#A4_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — in-scope verbs still bulleted as missing in $FINDINGS:"
  printf '        %s\n' "${A4_OFFENDERS[@]}"
  PASS=false
fi

rm -f "$MISSING_SECTION_TMP"

# ─── Tranche B — Dispatcher routes for in-scope verbs ────────────────────

echo "[9.B1 every in-scope verb is routed in $CLI_INDEX]"
B1_OFFENDERS=()
if [ -f "$CLI_INDEX" ]; then
  for verb in "${IN_SCOPE_VERBS[@]}"; do
    if ! awk -v key="$verb" '
        index($0, "\"" key "\":") { found=1 }
        $0 ~ "^[[:space:]]*" key ":" { found=1 }
        END { exit found ? 0 : 1 }
      ' "$CLI_INDEX" >/dev/null 2>&1; then
      B1_OFFENDERS+=("$verb")
    fi
  done
else
  B1_OFFENDERS+=("$CLI_INDEX missing")
fi
if [ "${#B1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — verbs not routed in $CLI_INDEX:"
  printf '        %s\n' "${B1_OFFENDERS[@]}"
  PASS=false
fi

echo "[9.B2 every in-scope verb exits 0 on --help]"
B2_OFFENDERS=()
if [ -f "$CLI_BIN" ]; then
  B2_PIDS=()
  B2_VERBS=()
  B2_TMPDIR="$(mktemp -d)"
  for verb in "${IN_SCOPE_VERBS[@]}"; do
    out="$B2_TMPDIR/$(echo "$verb" | tr ' ' '_')"
    # shellcheck disable=SC2086
    node "$CLI_BIN" $verb --help >"$out" 2>&1 &
    B2_PIDS+=("$!")
    B2_VERBS+=("$verb")
  done
  for i in "${!B2_PIDS[@]}"; do
    if ! wait "${B2_PIDS[$i]}"; then
      B2_OFFENDERS+=("${B2_VERBS[$i]}")
    fi
  done
  rm -rf "$B2_TMPDIR"
else
  B2_OFFENDERS+=("$CLI_BIN missing")
fi
if [ "${#B2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — verbs whose --help exits non-zero:"
  printf '        %s\n' "${B2_OFFENDERS[@]}"
  PASS=false
fi

# ─── Tranche C — doctor.ts thin renderer ─────────────────────────────────

echo "[9.C1 doctor command exists and is dispatched]"
C1_OK=true
if [ ! -f "$DOCTOR_CMD" ]; then
  echo "    ✗ fail — $DOCTOR_CMD missing"
  C1_OK=false
elif ! grep -E 'export[[:space:]]+async[[:space:]]+function[[:space:]]+runDoctor' \
        "$DOCTOR_CMD" >/dev/null 2>&1; then
  echo "    ✗ fail — $DOCTOR_CMD lacks export async function runDoctor"
  C1_OK=false
elif ! grep -F 'runDoctor' "$CLI_INDEX" >/dev/null 2>&1; then
  echo "    ✗ fail — $CLI_INDEX does not reference runDoctor"
  C1_OK=false
fi
if [ "$C1_OK" = true ]; then
  echo "    ✓ pass"
else
  PASS=false
fi

echo "[9.C2 doctor.ts fetches its verdict from the API]"
if [ -f "$DOCTOR_CMD" ]; then
  if grep -E '/v1/[a-zA-Z0-9_-]*(doctor|quality)' "$DOCTOR_CMD" \
        >/dev/null 2>&1 \
      && grep -E '\bfetchJson\b|\bfetch\(' "$DOCTOR_CMD" >/dev/null 2>&1; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — $DOCTOR_CMD does not call an /v1/.../doctor or /v1/.../quality endpoint"
    PASS=false
  fi
else
  echo "    ✗ fail — $DOCTOR_CMD missing"
  PASS=false
fi

echo "[9.C3 doctor.ts defines no rule literals]"
if [ -f "$DOCTOR_CMD" ]; then
  C3_OFFENDERS=()
  for literal in "${FORBIDDEN_DOCTOR_LITERALS[@]}"; do
    if grep -F -i -- "$literal" "$DOCTOR_CMD" >/dev/null 2>&1; then
      C3_OFFENDERS+=("$literal")
    fi
  done
  if [ "${#C3_OFFENDERS[@]}" -eq 0 ]; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — $DOCTOR_CMD contains forbidden rule literals:"
    printf '        %s\n' "${C3_OFFENDERS[@]}"
    PASS=false
  fi
else
  echo "    ✗ fail — $DOCTOR_CMD missing"
  PASS=false
fi

echo "[9.C4 doctor.ts is thin (≤ 120 LOC)]"
if [ -f "$DOCTOR_CMD" ]; then
  DOCTOR_LOC=$(wc -l <"$DOCTOR_CMD" | tr -d ' ')
  if [ "${DOCTOR_LOC:-0}" -le 120 ]; then
    echo "    ✓ pass ($DOCTOR_LOC LOC)"
  else
    echo "    ✗ fail — $DOCTOR_CMD is $DOCTOR_LOC LOC (> 120). Push logic to API."
    PASS=false
  fi
else
  echo "    ✗ fail — $DOCTOR_CMD missing"
  PASS=false
fi

# ─── Tranche D — Honest E2E coverage for new verbs ───────────────────────

# Maps a "topic action" verb to candidate test-file basenames the gate will
# accept. Returns 0 if a candidate exists in $HONEST_DIR; 1 otherwise. The
# matched file path is echoed on stdout for downstream checks.
honest_file_for_verb() {
  local verb="$1"
  local topic="${verb%% *}"
  local action=""
  if [ "$topic" != "$verb" ]; then
    action="${verb#* }"
  fi

  local candidates=()
  if [ -z "$action" ]; then
    candidates+=("${topic}.test.ts")
  else
    candidates+=("${topic}-${action}.test.ts")
    # Allow grouped read tests (list+show) and grouped edit tests
    # (edit+archive) to live in a single file.
    case "$action" in
      list|show)
        candidates+=("${topic}-read.test.ts")
        ;;
      edit|archive)
        candidates+=("${topic}-edit.test.ts")
        ;;
      set|restore)
        candidates+=("${topic}-write.test.ts")
        ;;
      reject)
        candidates+=("${topic}-edit.test.ts")
        ;;
    esac
  fi

  for cand in "${candidates[@]}"; do
    if [ -f "$HONEST_DIR/$cand" ]; then
      # For grouped files the gate additionally requires the action keyword
      # to actually appear inside a runCli( ... ]) call to prevent stub
      # files from passing.
      if [ -n "$action" ] && [[ "$cand" != "${topic}-${action}.test.ts" ]]; then
        if ! awk -v action="$action" '
          /runCli\(/ { inCall=1 }
          inCall && index($0, "\"" action "\"") { hit=1 }
          /\]/ { inCall=0 }
          END { exit hit ? 0 : 1 }
        ' "$HONEST_DIR/$cand" >/dev/null 2>&1; then
          continue
        fi
      fi
      echo "$HONEST_DIR/$cand"
      return 0
    fi
  done
  return 1
}

echo "[9.D1 every in-scope verb has a matching honest test]"
D1_OFFENDERS=()
for verb in "${IN_SCOPE_VERBS[@]}"; do
  if matched="$(honest_file_for_verb "$verb")"; then
    :
  else
    D1_OFFENDERS+=("$verb")
  fi
done
if [ "${#D1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest test missing for verb(s):"
  printf '        %s\n' "${D1_OFFENDERS[@]}"
  PASS=false
fi

# ─── Tranche E — Agent envelope rollout / scope-down ─────────────────────

echo "[9.E1 every user-facing file has format=agent + envelope import]"
E1_OFFENDERS=()
for f in "${USER_FACING_AGENT_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    E1_OFFENDERS+=("$f (missing)")
    continue
  fi
  if ! grep -E 'format === "agent"' "$f" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$f (no format===agent branch)")
    continue
  fi
  if ! grep -E "from ['\"][./a-zA-Z0-9_-]*agent-envelope" "$f" >/dev/null 2>&1; then
    E1_OFFENDERS+=("$f (no agent-envelope import)")
  fi
done
if [ "${#E1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — user-facing files missing envelope wiring:"
  printf '        %s\n' "${E1_OFFENDERS[@]}"
  PASS=false
fi

echo "[9.E2 declared excluded files do NOT carry a format=agent branch]"
E2_OFFENDERS=()
if [ "${#EXCLUDED_AGENT_FILES[@]}" -gt 0 ]; then
  for f in "${EXCLUDED_AGENT_FILES[@]}"; do
    if [ -f "$f" ] && grep -E 'format === "agent"' "$f" >/dev/null 2>&1; then
      E2_OFFENDERS+=("$f")
    fi
  done
fi
if [ "${#E2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — excluded files leaked an envelope branch:"
  printf '        %s\n' "${E2_OFFENDERS[@]}"
  PASS=false
fi

# ─── Tranche F — Meta: rigor ─────────────────────────────────────────────

echo "[9.F1 Gate rigor on goal 9 markdown]"
if bash "$ROOT/scripts/check-gate-rigor.sh" \
       "$ROOT/goals/9-cli-trim.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/9-cli-trim.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  if [ "${VSPEC_GATES_SKIP_DEEP:-}" != "1" ]; then
    gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  fi
  exit 0
else
  exit 1
fi
