#!/usr/bin/env bash
# goals/7-cli-spec-parity.gates.sh — Gate suite for goal 7 (CLI Spec Parity).
#
# Anti-cheat principle: every "every X" claim in goals/7-cli-spec-parity.md
# enumerates from a source of truth — every command file that branches on
# format=agent (A3-A5), every command file under commands/ (B5), every UC
# in HONEST_UC_SET (C2), every *.ts under e2e-cli-honest/ (C3, C4). A single
# hand-fix does not pass.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="7-cli-spec-parity"

# Inputs that determine this goal's gate result.
GATE_INPUTS=(
  apps/cli/src
  apps/cli/tests/e2e-cli-honest
  apps/cli/tests/e2e-cli
  apps/cli/tests/unit
  apps/cli/bin
  apps/cli/package.json
  scripts/check-gate-rigor.sh
  scripts/check-honest-cli-e2e.sh
  goals/7-cli-spec-parity.gates.sh
  goals/7-cli-spec-parity.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

# ─── Sources of truth ────────────────────────────────────────────────────
COMMANDS_DIR=apps/cli/src/commands
ENVELOPE_MODULE=apps/cli/src/agent-envelope.ts
MUTATION_ENVELOPE_MODULE=apps/cli/src/domain/envelope.ts
INIT_CMD=apps/cli/src/commands/init.ts
CONFIG_STORE=apps/cli/src/config-store.ts
HONEST_DIR=apps/cli/tests/e2e-cli-honest
HONEST_SETUP=apps/cli/tests/e2e-cli-honest/cli-setup.ts
CLI_BIN=apps/cli/bin/run.js

ENVELOPE_KEYS=(data context suggested_next_actions warnings format_version)

# Honest-flow UC set (Tranche C scope). Adding to this list expands the
# gate; removing requires a finding doc explaining why.
HONEST_UC_SET=(
  UC-004
  UC-005
  UC-006
  UC-007
  UC-009
  UC-011
  UC-013
  UC-016
  UC-019
  UC-022
)

# ─── Tranche A — Envelope module + standardization ───────────────────────

echo "[7.A1 agent-envelope module exists with buildAgentEnvelope]"
if [ -f "$ENVELOPE_MODULE" ] \
    && grep -qE 'export function buildAgentEnvelope' "$ENVELOPE_MODULE"; then
  A1_MISSING_KEYS=()
  for key in "${ENVELOPE_KEYS[@]}"; do
    if ! grep -qE "\\b${key}\\b" "$ENVELOPE_MODULE"; then
      A1_MISSING_KEYS+=("$key")
    fi
  done
  if [ "${#A1_MISSING_KEYS[@]}" -eq 0 ]; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — envelope module missing keys: ${A1_MISSING_KEYS[*]}"
    PASS=false
  fi
else
  echo "    ✗ fail — $ENVELOPE_MODULE missing or no buildAgentEnvelope export"
  PASS=false
fi

echo "[7.A2 format_version = 1 and sourced only from agent-envelope.ts]"
A2_OFFENDERS=()
while IFS= read -r f; do
  case "$f" in
    "$ENVELOPE_MODULE") continue ;;
    "$MUTATION_ENVELOPE_MODULE") continue ;;
    apps/cli/tests/*) continue ;;
  esac
  if grep -qE '\bformat_version\b' "$f"; then
    A2_OFFENDERS+=("$f")
  fi
done < <(find apps/cli/src -name '*.ts' -type f 2>/dev/null)
A2_LITERAL_OK=false
if [ -f "$ENVELOPE_MODULE" ] \
    && grep -qE 'format_version[[:space:]]*:[[:space:]]*1\b' "$ENVELOPE_MODULE"; then
  A2_LITERAL_OK=true
fi
V2_LITERAL_OK=false
if [ -f "$MUTATION_ENVELOPE_MODULE" ] \
    && grep -qE 'ENVELOPE_VERSION_V2[[:space:]]*=[[:space:]]*2[[:space:]]+as[[:space:]]+const' "$MUTATION_ENVELOPE_MODULE" \
    && grep -qE '\bformat_version\b' "$MUTATION_ENVELOPE_MODULE"; then
  V2_LITERAL_OK=true
fi
if [ "${#A2_OFFENDERS[@]}" -eq 0 ] && [ "$A2_LITERAL_OK" = true ] && [ "$V2_LITERAL_OK" = true ]; then
  echo "    ✓ pass"
else
  if [ "${#A2_OFFENDERS[@]}" -gt 0 ]; then
    echo "    ✗ fail — files outside envelope module mention format_version:"
    printf '        %s\n' "${A2_OFFENDERS[@]}"
  fi
  if [ "$A2_LITERAL_OK" = false ]; then
    echo "    ✗ fail — envelope module does not emit format_version: 1"
  fi
  if [ "$V2_LITERAL_OK" = false ]; then
    echo "    ✗ fail — mutation envelope module does not emit format_version: 2"
  fi
  PASS=false
fi

echo "[7.A3 every agent-format branch imports agent-envelope]"
A3_OFFENDERS=()
while IFS= read -r f; do
  if ! grep -qE "from ['\"][./a-zA-Z0-9_-]*agent-envelope" "$f"; then
    A3_OFFENDERS+=("$f")
  fi
done < <(grep -rlE 'format === "agent"' "$COMMANDS_DIR" 2>/dev/null)
if [ "${#A3_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — these files branch on format=agent but do not import buildAgentEnvelope:"
  printf '        %s\n' "${A3_OFFENDERS[@]}"
  PASS=false
fi

echo "[7.A4 every agent-format branch emits the five envelope keys]"
A4_OFFENDERS=()
while IFS= read -r f; do
  MISSING_KEYS=()
  for key in "${ENVELOPE_KEYS[@]}"; do
    # The file may emit the envelope by spreading buildAgentEnvelope; in
    # either case the literal string must appear (either in the emission
    # or in the type imports).
    if ! grep -qE "\\b${key}\\b" "$f" \
        && ! grep -qE 'buildAgentEnvelope' "$f"; then
      MISSING_KEYS+=("$key")
    fi
  done
  if [ "${#MISSING_KEYS[@]}" -gt 0 ]; then
    A4_OFFENDERS+=("$f (missing: ${MISSING_KEYS[*]})")
  fi
done < <(grep -rlE 'format === "agent"' "$COMMANDS_DIR" 2>/dev/null)
if [ "${#A4_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — agent branches missing envelope keys:"
  printf '        %s\n' "${A4_OFFENDERS[@]}"
  PASS=false
fi

echo "[7.A5 no raw JSON.stringify inside agent-format branches]"
A5_OFFENDERS=()
while IFS= read -r f; do
  # Heuristic: if the file has format === "agent" AND a JSON.stringify call
  # AND no buildAgentEnvelope import, flag it. Once routed through the
  # envelope, the stringify happens inside the shared module / on the
  # envelope object — never on an ad-hoc object literal in the command.
  if grep -qE 'JSON\.stringify' "$f" \
      && ! grep -qE 'buildAgentEnvelope' "$f"; then
    A5_OFFENDERS+=("$f")
  fi
done < <(grep -rlE 'format === "agent"' "$COMMANDS_DIR" 2>/dev/null)
if [ "${#A5_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — agent branch uses JSON.stringify without buildAgentEnvelope:"
  printf '        %s\n' "${A5_OFFENDERS[@]}"
  PASS=false
fi

# ─── Tranche B — vspec init ──────────────────────────────────────────────

echo "[7.B1 vspec init --help exits 0]"
if [ -f "$INIT_CMD" ] && [ -f "$CLI_BIN" ]; then
  if node "$CLI_BIN" init --help >/dev/null 2>&1; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — node $CLI_BIN init --help exits non-zero"
    PASS=false
  fi
else
  echo "    ✗ fail — $INIT_CMD or $CLI_BIN missing"
  PASS=false
fi

echo "[7.B2 vspec init --project writes ./.vspec/config.json]"
if [ -f "$INIT_CMD" ] && [ -f "$CLI_BIN" ]; then
  B2_TMP="$(mktemp -d)"
  trap 'rm -rf "$B2_TMP"' EXIT
  (
    cd "$B2_TMP"
    node "$ROOT/$CLI_BIN" init --project ACME >/dev/null 2>&1
  )
  if [ -f "$B2_TMP/.vspec/config.json" ] \
      && grep -qE '"current_project_key"[[:space:]]*:[[:space:]]*"ACME"' \
           "$B2_TMP/.vspec/config.json"; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — $B2_TMP/.vspec/config.json missing or no current_project_key"
    PASS=false
  fi
else
  echo "    ✗ fail — preconditions for B2 unmet"
  PASS=false
fi

echo "[7.B3 vspec init without --project exits non-zero with stderr]"
if [ -f "$INIT_CMD" ] && [ -f "$CLI_BIN" ]; then
  B3_TMP="$(mktemp -d)"
  B3_STDERR="$(mktemp)"
  (
    cd "$B3_TMP"
    node "$ROOT/$CLI_BIN" init >/dev/null 2>"$B3_STDERR"
  )
  B3_STATUS=$?
  if [ "$B3_STATUS" -ne 0 ] && grep -qE 'project' "$B3_STDERR"; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — expected non-zero exit + stderr mentioning 'project'"
    PASS=false
  fi
  rm -rf "$B3_TMP" "$B3_STDERR"
else
  echo "    ✗ fail — preconditions for B3 unmet"
  PASS=false
fi

echo "[7.B4 vspec init refuses to overwrite without --force]"
if [ -f "$INIT_CMD" ] && [ -f "$CLI_BIN" ]; then
  B4_TMP="$(mktemp -d)"
  mkdir -p "$B4_TMP/.vspec"
  echo '{"current_project_key":"OLD"}' >"$B4_TMP/.vspec/config.json"
  (
    cd "$B4_TMP"
    node "$ROOT/$CLI_BIN" init --project NEW >/dev/null 2>&1
  )
  B4_NOFORCE_STATUS=$?
  B4_NOFORCE_OK=false
  if [ "$B4_NOFORCE_STATUS" -ne 0 ] \
      && grep -qE '"current_project_key"[[:space:]]*:[[:space:]]*"OLD"' \
           "$B4_TMP/.vspec/config.json"; then
    B4_NOFORCE_OK=true
  fi
  (
    cd "$B4_TMP"
    node "$ROOT/$CLI_BIN" init --project NEW --force >/dev/null 2>&1
  )
  B4_FORCE_STATUS=$?
  B4_FORCE_OK=false
  if [ "$B4_FORCE_STATUS" -eq 0 ] \
      && grep -qE '"current_project_key"[[:space:]]*:[[:space:]]*"NEW"' \
           "$B4_TMP/.vspec/config.json"; then
    B4_FORCE_OK=true
  fi
  if [ "$B4_NOFORCE_OK" = true ] && [ "$B4_FORCE_OK" = true ]; then
    echo "    ✓ pass"
  else
    if [ "$B4_NOFORCE_OK" = false ]; then
      echo "    ✗ fail — init without --force did not refuse / preserve existing config"
    fi
    if [ "$B4_FORCE_OK" = false ]; then
      echo "    ✗ fail — init --force did not overwrite to current_project_key=NEW"
    fi
    PASS=false
  fi
  rm -rf "$B4_TMP"
else
  echo "    ✗ fail — preconditions for B4 unmet"
  PASS=false
fi

echo "[7.B5 only init.ts writes .vspec/ via config-store]"
B5_OFFENDERS=()
while IFS= read -r f; do
  case "$f" in
    "$INIT_CMD") continue ;;
  esac
  if grep -qE '\.vspec/config\.json|writeFile\(.*\.vspec' "$f"; then
    B5_OFFENDERS+=("$f")
  fi
done < <(find "$COMMANDS_DIR" -name '*.ts' -type f 2>/dev/null)
if [ "${#B5_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — these command files touch .vspec/config.json directly:"
  printf '        %s\n' "${B5_OFFENDERS[@]}"
  PASS=false
fi

echo "[7.B6 per-repo binding is read by subsequent commands]"
if [ -f "$INIT_CMD" ] && [ -f "$CLI_BIN" ]; then
  B6_TMP="$(mktemp -d)"
  B6_STDOUT="$(mktemp)"
  B6_STATUS_OK=false
  B6_KEY_OK=false
  (
    cd "$B6_TMP"
    node "$ROOT/$CLI_BIN" init --project BOUND >/dev/null 2>&1 \
      && node "$ROOT/$CLI_BIN" status >"$B6_STDOUT" 2>&1
  )
  if [ -f "$B6_TMP/.vspec/config.json" ]; then
    B6_STATUS_OK=true
  fi
  if grep -qE 'current_project_key[[:space:]]+BOUND' "$B6_STDOUT"; then
    B6_KEY_OK=true
  fi
  if [ "$B6_STATUS_OK" = true ] && [ "$B6_KEY_OK" = true ]; then
    echo "    ✓ pass"
  else
    if [ "$B6_STATUS_OK" = false ]; then
      echo "    ✗ fail — init did not create $B6_TMP/.vspec/config.json"
    fi
    if [ "$B6_KEY_OK" = false ]; then
      echo "    ✗ fail — vspec status from same cwd did not surface current_project_key BOUND"
      echo "       stdout was:"
      while IFS= read -r line; do
        echo "         $line"
      done <"$B6_STDOUT"
    fi
    PASS=false
  fi
  rm -rf "$B6_TMP" "$B6_STDOUT"
else
  echo "    ✗ fail — preconditions for B6 unmet"
  PASS=false
fi

echo "[7.B7 init --help prints init-specific synopsis]"
B7_STDOUT="$(mktemp)"
node "$ROOT/$CLI_BIN" init --help >"$B7_STDOUT" 2>&1
B7_STATUS=$?
B7_OK=false
if [ "$B7_STATUS" -eq 0 ] \
    && grep -qE 'vspec init --project' "$B7_STDOUT" \
    && grep -qE 'force' "$B7_STDOUT"; then
  B7_OK=true
fi
if [ "$B7_OK" = true ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — init --help should exit 0 and mention 'vspec init --project' + 'force'"
  while IFS= read -r line; do
    echo "         $line"
  done <"$B7_STDOUT"
  PASS=false
fi
rm -f "$B7_STDOUT"

# ─── Tranche C — Honest E2E expansion ────────────────────────────────────

echo "[7.C1 e2e-cli-honest/cli-setup.ts exists and is fetch-free]"
if [ -f "$HONEST_SETUP" ] \
    && grep -qE 'seedViaCli' "$HONEST_SETUP" \
    && ! grep -qE '\bfetch\(' "$HONEST_SETUP"; then
  echo "    ✓ pass"
else
  if [ ! -f "$HONEST_SETUP" ]; then
    echo "    ✗ fail — $HONEST_SETUP missing"
  elif ! grep -qE 'seedViaCli' "$HONEST_SETUP"; then
    echo "    ✗ fail — $HONEST_SETUP missing seedViaCli export"
  else
    echo "    ✗ fail — $HONEST_SETUP contains fetch( calls"
  fi
  PASS=false
fi

echo "[7.C2 every UC in HONEST_UC_SET has a matching honest test]"
C2_MISSING=()
for uc in "${HONEST_UC_SET[@]}"; do
  if ! find "$HONEST_DIR" -maxdepth 1 -name "${uc}-*.test.ts" -type f \
       2>/dev/null | grep -q .; then
    C2_MISSING+=("$uc")
  fi
done
if [ "${#C2_MISSING[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest tests missing for: ${C2_MISSING[*]}"
  PASS=false
fi

echo "[7.C3 zero fetch( calls under e2e-cli-honest/]"
C3_OFFENDERS=()
if [ -d "$HONEST_DIR" ]; then
  while IFS= read -r f; do
    if grep -qE '\bfetch\(' "$f"; then
      C3_OFFENDERS+=("$f")
    fi
  done < <(find "$HONEST_DIR" -name '*.ts' -type f 2>/dev/null)
fi
if [ "${#C3_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest dir files calling fetch(:"
  printf '        %s\n' "${C3_OFFENDERS[@]}"
  PASS=false
fi

echo "[7.C4 every honest test references VSPEC_CONFIG_PATH]"
C4_OFFENDERS=()
if [ -d "$HONEST_DIR" ]; then
  while IFS= read -r f; do
    if ! grep -qE 'VSPEC_CONFIG_PATH' "$f"; then
      C4_OFFENDERS+=("$f")
    fi
  done < <(find "$HONEST_DIR" -name '*.test.ts' -type f 2>/dev/null)
fi
if [ "${#C4_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest tests not isolating VSPEC_CONFIG_PATH:"
  printf '        %s\n' "${C4_OFFENDERS[@]}"
  PASS=false
fi

echo "[7.C5 scripts/check-honest-cli-e2e.sh exits 0 on expanded set]"
if [ -f scripts/check-honest-cli-e2e.sh ]; then
  if bash scripts/check-honest-cli-e2e.sh >/dev/null 2>&1; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — bash scripts/check-honest-cli-e2e.sh exits non-zero"
    PASS=false
  fi
else
  echo "    ✗ fail — scripts/check-honest-cli-e2e.sh missing (Goal 6 invariant)"
  PASS=false
fi

# ─── Tranche D — Meta: rigor ─────────────────────────────────────────────

echo "[7.D1 Gate rigor on goal 7 markdown]"
if bash "$ROOT/scripts/check-gate-rigor.sh" \
       "$ROOT/goals/7-cli-spec-parity.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/7-cli-spec-parity.md"
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
