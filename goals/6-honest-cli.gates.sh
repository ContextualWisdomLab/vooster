#!/usr/bin/env bash
# goals/6-honest-cli.gates.sh — Gate suite for goal 6 (Honest CLI).
#
# Anti-cheat principle: every "every X" claim in goals/6-honest-cli.md
# enumerates from a source of truth — the commands directory, the config
# schema, the honest-flow test directory, the flag list, the context-command
# list, the spec verb list. Hand-fixing a single example does not pass.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

BASE_GOAL_NAME="6-honest-cli"
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  GOAL_NAME="${BASE_GOAL_NAME}-shallow"
  CACHE_LABEL="goal $BASE_GOAL_NAME shallow"
else
  GOAL_NAME="$BASE_GOAL_NAME"
  CACHE_LABEL="goal $BASE_GOAL_NAME"
fi

# Inputs that determine this goal's gate result.
GATE_INPUTS=(
  apps/cli/src
  apps/cli/tests
  apps/cli/package.json
  apps/api/src/http
  apps/api/src/application/signup.ts
  apps/api/src/ports/signup-store.ts
  scripts/check-gate-rigor.sh
  scripts/check-honest-cli-e2e.sh
  goals/6-honest-cli.gates.sh
  goals/6-honest-cli.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] $CACHE_LABEL inputs unchanged"
  exit 0
fi

PASS=true

# ─── Sources of truth ────────────────────────────────────────────────────
CONFIG_KEYS=(api_url session_token current_workspace_id profile)
CONTEXT_FLAGS=(api-url session-cookie workspace-id)
CONTEXT_COMMANDS=("logout" "status" "workspace switch" "project switch")
HONEST_VERBS=(login project actor usecase)
COMMANDS_DIR=apps/cli/src/commands
HONEST_DIR=apps/cli/tests/e2e-cli-honest
CONFIG_STORE=apps/cli/src/config-store.ts
DEVICE_FLOW=apps/cli/src/device-flow.ts
FLAG_VALUES=apps/cli/src/flag-values.ts
CLI_INDEX=apps/cli/src/index.ts
LOGIN_CMD=apps/cli/src/commands/login.ts
ROUTES_DIR=apps/api/src/http

# ─── Tranche A — Credential store + login persistence ────────────────────

echo "[6.A1] credential-store module exists at $CONFIG_STORE"
if [ -f "$CONFIG_STORE" ] \
    && grep -qE 'readConfig|writeConfig' "$CONFIG_STORE" \
    && grep -qE 'VSPEC_CONFIG_PATH' "$CONFIG_STORE"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $CONFIG_STORE must exist and reference"
  echo "        readConfig / writeConfig + VSPEC_CONFIG_PATH override"
  PASS=false
fi

echo "[6.A2] config schema persists every required key"
A2_MISSING=()
if [ -f "$CONFIG_STORE" ]; then
  for key in "${CONFIG_KEYS[@]}"; do
    if ! grep -qE "\\b${key}\\b" "$CONFIG_STORE"; then
      A2_MISSING+=("$key")
    fi
  done
else
  A2_MISSING=("${CONFIG_KEYS[@]}")
fi
if [ "${#A2_MISSING[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $CONFIG_STORE is missing these keys: ${A2_MISSING[*]}"
  PASS=false
fi

echo "[6.A3] vspec login writes the credential file"
if [ -f "$LOGIN_CMD" ] && grep -qE 'writeConfig' "$LOGIN_CMD"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $LOGIN_CMD must call writeConfig after a successful login"
  PASS=false
fi

echo "[6.A4] honest-flow tests honor VSPEC_CONFIG_PATH per case"
if [ ! -d "$HONEST_DIR" ]; then
  echo "    ✗ fail — $HONEST_DIR does not exist yet (see Tranche E)"
  PASS=false
else
  A4_OFFENDERS=()
  while IFS= read -r f; do
    if ! grep -qE 'VSPEC_CONFIG_PATH' "$f"; then
      A4_OFFENDERS+=("$f")
    fi
  done < <(find "$HONEST_DIR" -name '*.test.ts' -type f 2>/dev/null)
  if [ "${#A4_OFFENDERS[@]}" -eq 0 ] \
      && [ -n "$(find "$HONEST_DIR" -name '*.test.ts' -type f 2>/dev/null)" ]; then
    echo "    ✓ pass"
  elif [ -z "$(find "$HONEST_DIR" -name '*.test.ts' -type f 2>/dev/null)" ]; then
    echo "    ✗ fail — $HONEST_DIR has no *.test.ts yet"
    PASS=false
  else
    echo "    ✗ fail — these honest-flow tests do not set VSPEC_CONFIG_PATH:"
    printf '        %s\n' "${A4_OFFENDERS[@]}"
    PASS=false
  fi
fi

# ─── Tranche B — OAuth device flow ───────────────────────────────────────

echo "[6.B1] POST /v1/auth/github/token endpoint exists"
if grep -rqE '/v1/auth/github/token' "$ROUTES_DIR" 2>/dev/null; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — no route registers POST /v1/auth/github/token under $ROUTES_DIR"
  PASS=false
fi

echo "[6.B2] stub mode accepts stub-access-token-* tokens (DEEP)"
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "    (skipped — VSPEC_GATES_SKIP_DEEP=1)"
else
  B2_LOG=$(mktemp)
  if node --import tsx -e "
    process.env.VSPEC_AUTH_STUB = '1';
    (async () => {
      const { createServer } = await import('./apps/api/src/http/server.js');
      const app = await createServer({ authStub: true });
      await app.listen({ host: '127.0.0.1', port: 0 });
      const addr = app.server.address();
      try {
        const res = await fetch(\`http://127.0.0.1:\${addr.port}/v1/auth/github/token\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: 'stub-access-token-b2' })
        });
        const cookie = res.headers.get('set-cookie') || '';
        if (res.status !== 200 || !/vspec_session=/.test(cookie)) {
          console.error('status=' + res.status + ' cookie=' + cookie);
          process.exit(2);
        }
      } finally {
        await app.close();
      }
    })().catch((e) => { console.error(e); process.exit(1); });
  " >"$B2_LOG" 2>&1; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — stub device-flow endpoint did not 200 with vspec_session cookie"
    sed 's/^/        /' "$B2_LOG"
    PASS=false
  fi
  rm -f "$B2_LOG"
fi

echo "[6.B3] CLI device-flow module exists at $DEVICE_FLOW"
if [ -f "$DEVICE_FLOW" ] \
    && grep -qE 'runDeviceFlow|device.code|verification_uri' "$DEVICE_FLOW"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $DEVICE_FLOW must exist and expose the device-flow loop"
  PASS=false
fi

echo "[6.B4] --github-code flag is gone from index.ts and login.ts"
B4_OFFENDERS=()
for f in "$CLI_INDEX" "$LOGIN_CMD"; do
  if [ -f "$f" ] && grep -qE '"github-code"|--github-code' "$f"; then
    B4_OFFENDERS+=("$f")
  fi
done
if [ "${#B4_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — --github-code still referenced in:"
  printf '        %s\n' "${B4_OFFENDERS[@]}"
  PASS=false
fi

# ─── Tranche C — Optional flags with config fallback ─────────────────────

echo "[6.C1] no command requires --api-url / --session-cookie / --workspace-id"
C1_OFFENDERS=()
if [ -d "$COMMANDS_DIR" ]; then
  while IFS= read -r f; do
    if grep -qE 'requiredFlag\([^,]+,[[:space:]]*"(api-url|session-cookie|workspace-id)"' "$f"; then
      C1_OFFENDERS+=("$f")
    fi
  done < <(find "$COMMANDS_DIR" -name '*.ts' -type f 2>/dev/null)
fi
if [ "${#C1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — these commands still requiredFlag the context flags:"
  printf '        %s\n' "${C1_OFFENDERS[@]}"
  PASS=false
fi

echo "[6.C2] resolver in $FLAG_VALUES handles every context flag"
C2_MISSING=()
if [ -f "$FLAG_VALUES" ]; then
  for flag in "${CONTEXT_FLAGS[@]}"; do
    if ! grep -qE "\"${flag}\"" "$FLAG_VALUES"; then
      C2_MISSING+=("$flag")
    fi
  done
  if ! grep -qE 'resolveContextFlag|readConfig' "$FLAG_VALUES"; then
    C2_MISSING+=("(no resolveContextFlag / readConfig wiring)")
  fi
else
  C2_MISSING=("(file missing) ${CONTEXT_FLAGS[*]}")
fi
if [ "${#C2_MISSING[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $FLAG_VALUES missing: ${C2_MISSING[*]}"
  PASS=false
fi

echo "[6.C3] honest-flow scenarios pass no context flags"
C3_OFFENDERS=()
if [ -d "$HONEST_DIR" ]; then
  while IFS= read -r f; do
    if grep -qE '"--(api-url|session-cookie|workspace-id)"' "$f"; then
      C3_OFFENDERS+=("$f")
    fi
  done < <(find "$HONEST_DIR" -name '*.test.ts' -type f 2>/dev/null)
fi
if [ ! -d "$HONEST_DIR" ]; then
  echo "    ✗ fail — $HONEST_DIR does not exist yet (Tranche E)"
  PASS=false
elif [ "${#C3_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest-flow scenarios must not pass context flags; offenders:"
  printf '        %s\n' "${C3_OFFENDERS[@]}"
  PASS=false
fi

# ─── Tranche D — Context commands ────────────────────────────────────────

echo "[6.D1] CLI dispatches every context command in index.ts"
# Static check: every entry in CONTEXT_COMMANDS must appear in the dispatcher
# route table. Using --help would false-pass because oclif's global help
# intercepts unknown subcommands and exits 0.
D1_MISSING=()
if [ -f "$CLI_INDEX" ]; then
  for entry in "${CONTEXT_COMMANDS[@]}"; do
    if ! awk -v key="$entry" '
      index($0, "\"" key "\":") { found=1 }
      $0 ~ "^[[:space:]]*" key ":" { found=1 }
      END { exit found ? 0 : 1 }
    ' "$CLI_INDEX" >/dev/null 2>&1; then
      D1_MISSING+=("vspec $entry")
    fi
  done
else
  D1_MISSING=("($CLI_INDEX missing)")
fi
if [ "${#D1_MISSING[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — $CLI_INDEX has no dispatch branch for:"
  printf '        %s\n' "${D1_MISSING[@]}"
  PASS=false
fi

echo "[6.D2] POST /v1/auth/logout endpoint exists"
if grep -rqE '/v1/auth/logout' "$ROUTES_DIR" 2>/dev/null; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — no route registers POST /v1/auth/logout under $ROUTES_DIR"
  PASS=false
fi

echo "[6.D3] status command works offline (DEEP)"
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "    (skipped — VSPEC_GATES_SKIP_DEEP=1)"
else
  D3_CFG=$(mktemp)
  cat >"$D3_CFG" <<JSON
{ "api_url": "http://127.0.0.1:1", "current_workspace_id": "ws_test", "profile": "default", "session_token": "tok" }
JSON
  if VSPEC_CONFIG_PATH="$D3_CFG" node apps/cli/bin/run.js status >/dev/null 2>&1; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — vspec status did not exit 0 with a populated config + unreachable api"
    PASS=false
  fi
  rm -f "$D3_CFG"
fi

echo "[6.D4] workspace switch / project switch mutate only the config (DEEP)"
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "    (skipped — VSPEC_GATES_SKIP_DEEP=1)"
else
  D4_CFG=$(mktemp)
  cat >"$D4_CFG" <<JSON
{ "api_url": "http://127.0.0.1:1", "current_workspace_id": "ws_before", "profile": "default", "session_token": "tok" }
JSON
  D4_OK=true
  if ! VSPEC_CONFIG_PATH="$D4_CFG" node apps/cli/bin/run.js workspace switch other-slug >/dev/null 2>&1; then
    D4_OK=false
  elif ! grep -q 'other-slug' "$D4_CFG"; then
    D4_OK=false
  fi
  if ! VSPEC_CONFIG_PATH="$D4_CFG" node apps/cli/bin/run.js project switch SOME-KEY >/dev/null 2>&1; then
    D4_OK=false
  elif ! grep -q 'SOME-KEY' "$D4_CFG"; then
    D4_OK=false
  fi
  if [ "$D4_OK" = true ]; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — workspace switch / project switch did not update the config file"
    PASS=false
  fi
  rm -f "$D4_CFG"
fi

# ─── Tranche E — Honest E2E ──────────────────────────────────────────────

echo "[6.E1] $HONEST_DIR contains at least one *.test.ts"
HONEST_COUNT=0
if [ -d "$HONEST_DIR" ]; then
  HONEST_COUNT=$(find "$HONEST_DIR" -name '*.test.ts' -type f 2>/dev/null | wc -l | tr -d ' ')
fi
if [ "$HONEST_COUNT" -gt 0 ]; then
  echo "    ✓ pass ($HONEST_COUNT test file(s))"
else
  echo "    ✗ fail — $HONEST_DIR has no *.test.ts files"
  PASS=false
fi

echo "[6.E2] no file under $HONEST_DIR calls fetch("
E2_OFFENDERS=()
if [ -d "$HONEST_DIR" ]; then
  while IFS= read -r f; do
    if grep -qE '\bfetch\(' "$f"; then
      E2_OFFENDERS+=("$f")
    fi
  done < <(find "$HONEST_DIR" -name '*.ts' -type f 2>/dev/null)
fi
if [ "${#E2_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — these honest-flow files call fetch(:"
  printf '        %s\n' "${E2_OFFENDERS[@]}"
  PASS=false
fi

echo "[6.E3] scripts/check-honest-cli-e2e.sh exists and exits 0"
if [ "${VSPEC_GATES_SKIP_DEEP:-}" = "1" ]; then
  echo "    ⊘ skipped (VSPEC_GATES_SKIP_DEEP=1) — enforced by _meta M.3 on full run"
elif [ -x scripts/check-honest-cli-e2e.sh ] || [ -f scripts/check-honest-cli-e2e.sh ]; then
  if bash scripts/check-honest-cli-e2e.sh >/dev/null 2>&1; then
    echo "    ✓ pass"
  else
    echo "    ✗ fail — scripts/check-honest-cli-e2e.sh failed; run it directly"
    PASS=false
  fi
else
  echo "    ✗ fail — scripts/check-honest-cli-e2e.sh missing"
  PASS=false
fi

echo "[6.E4] honest-flow covers every required CLI verb"
E4_MISSING=()
if [ -d "$HONEST_DIR" ]; then
  for verb in "${HONEST_VERBS[@]}"; do
    if ! grep -rqE "\"${verb}\"" "$HONEST_DIR" 2>/dev/null; then
      E4_MISSING+=("$verb")
    fi
  done
else
  E4_MISSING=("${HONEST_VERBS[@]}")
fi
if [ "${#E4_MISSING[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — honest-flow scenarios never invoke: ${E4_MISSING[*]}"
  PASS=false
fi

# ─── Tranche F — Meta: rigor ─────────────────────────────────────────────

echo "[6.F1 Gate rigor on goal 6 markdown]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/6-honest-cli.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/6-honest-cli.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  if [ "$GOAL_NAME" = "$BASE_GOAL_NAME" ]; then
    gate_cache_save "${BASE_GOAL_NAME}-shallow" "${GATE_INPUTS[@]}"
  fi
  exit 0
else
  exit 1
fi
