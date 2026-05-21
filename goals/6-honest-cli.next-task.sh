#!/usr/bin/env bash
# goals/6-honest-cli.next-task.sh — Task hints for goal 6 (Honest CLI).
#
# Walks the agent through the Recommended Order of Attack in
# goals/6-honest-cli.md: B (device flow) → A (credential store)
# → C (optional flags) → D (context commands) → E (honest E2E) → F (rigor).
# Surfaces the first failing sub-gate.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

# ─── B1: device-flow server endpoint ─────────────────────────────────────
if ! grep -rqE '/v1/auth/github/token' "$ROUTES_DIR" 2>/dev/null; then
  cat <<'EOF'
TASK: Add POST /v1/auth/github/token (gate 6.B1).

  Where:
    apps/api/src/http/signup-routes.ts (or a new device-flow routes file)

  Body schema:
    { access_token: string }

  Behavior:
    - In stub mode (VSPEC_AUTH_STUB=1): if access_token starts with
      "stub-access-token-", synthesize a GithubProfile using the trailing
      identifier as githubId, then run the existing completeOAuth path.
    - In real mode: call https://api.github.com/user with the bearer
      token (reuse apps/api/src/http/signup-support.ts::fetchRealGithubProfile
      shape), then completeOAuth.

  Reuse sendCompleteOAuthResult so the SIGNED_UP / LOGGED_IN / error
  branches behave identically to the redirect-based flow.

  Commit:
    feat(api): device-flow token endpoint (stub + real)
EOF
  exit 0
fi

# ─── B3: CLI device-flow module ──────────────────────────────────────────
if [ ! -f "$DEVICE_FLOW" ] \
    || ! grep -qE 'runDeviceFlow|device.code|verification_uri' "$DEVICE_FLOW"; then
  cat <<'EOF'
TASK: Create apps/cli/src/device-flow.ts (gate 6.B3).

  Export:
    runDeviceFlow({ apiUrl, githubClientId?, authStub }):
      Promise<{ accessToken: string }>

  Behavior:
    - authStub === true → return { accessToken: "stub-access-token-cli" }
      synchronously (interval=0). Used by every test.
    - authStub === false:
        1. POST https://github.com/login/device/code with client_id +
           scope=read:user → { device_code, user_code,
                              verification_uri, expires_in, interval }
        2. writeLine("Visit <verification_uri> and enter code: <user_code>")
        3. Poll POST https://github.com/login/oauth/access_token with
           grant_type=urn:ietf:params:oauth:grant-type:device_code +
           device_code, sleeping `interval` seconds. Stop on
           access_token, slow_down (back off +5s), expired_token (fail),
           or expires_in elapsed.

  Commit:
    feat(cli): device-flow module with stub mode
EOF
  exit 0
fi

# ─── B4: login rewrite + --github-code removal ───────────────────────────
B4_OFFENDERS=()
for f in "$CLI_INDEX" "$LOGIN_CMD"; do
  if [ -f "$f" ] && grep -qE '"github-code"|--github-code' "$f"; then
    B4_OFFENDERS+=("$f")
  fi
done
if [ "${#B4_OFFENDERS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Rewire vspec login to use the device flow (gate 6.B4).

  Drop --github-code from:
EOF
  printf '    %s\n' "${B4_OFFENDERS[@]}"
  cat <<'EOF'

  In apps/cli/src/commands/login.ts:
    1. Call runDeviceFlow({ apiUrl, authStub: process.env.VSPEC_AUTH_STUB === "1" })
    2. POST { access_token } to <apiUrl>/v1/auth/github/token
    3. Print the same Signed up / Logged in / Workspace lines as before
       (workspace.id is already surfaced)

  Migrate every test that previously passed --github-code:
    apps/cli/tests/e2e-cli/UC-001.test.ts
    apps/cli/tests/e2e-cli/UC-002.test.ts
    apps/cli/tests/e2e-cli/helpers.ts::signup()

  These tests must still hit the real CLI binary. They set
  VSPEC_AUTH_STUB=1 in the child env so runDeviceFlow short-circuits.

  Commit (one or split):
    feat(cli): login via device flow, drop --github-code
    test(cli): migrate signup helpers to device-flow stub
EOF
  exit 0
fi

# ─── A1 / A2: credential-store module + schema ───────────────────────────
A1_OK=false
if [ -f "$CONFIG_STORE" ] \
    && grep -qE 'readConfig|writeConfig' "$CONFIG_STORE" \
    && grep -qE 'VSPEC_CONFIG_PATH' "$CONFIG_STORE"; then
  A1_OK=true
fi
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
if ! $A1_OK || [ "${#A2_MISSING[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Build the credential store (gates 6.A1 / 6.A2).

  Create apps/cli/src/config-store.ts exporting:
    type VspecConfig = {
      api_url?: string;
      session_token?: string;
      current_workspace_id?: string;
      profile?: string;
    }
    readConfig(): VspecConfig
    writeConfig(patch: Partial<VspecConfig>): void
    configPath(): string  // honors VSPEC_CONFIG_PATH

  Path resolution:
    process.env.VSPEC_CONFIG_PATH
      ?? path.join(os.homedir(), ".vspec", "config.json")

  writeConfig merges into the existing file (so workspace switch does
  not clobber api_url). Create the parent directory if missing.

  Tests live alongside in apps/cli/tests/unit/config-store.test.ts.

EOF
  if [ "${#A2_MISSING[@]}" -gt 0 ]; then
    echo "  Missing keys in $CONFIG_STORE: ${A2_MISSING[*]}"
  fi
  cat <<'EOF'

  Commit:
    feat(cli): credential store at ~/.vspec/config.json
EOF
  exit 0
fi

# ─── A3: login writes the file ───────────────────────────────────────────
if [ -f "$LOGIN_CMD" ] && ! grep -qE 'writeConfig' "$LOGIN_CMD"; then
  cat <<'EOF'
TASK: Persist credentials on successful login (gate 6.A3).

  In apps/cli/src/commands/login.ts, after the API response:

    import { writeConfig } from "../config-store.js";

    const sessionToken = readSessionToken(callback.cookie);
    writeConfig({
      api_url: oauthFlags.apiUrl,
      session_token: sessionToken,
      current_workspace_id: firstWorkspaceId(callbackBody)
    });

  Helper:
    readSessionToken parses "vspec_session=<token>" from the Set-Cookie
    string already captured in fetchJson(... cookie).

  Commit:
    feat(cli): login persists session + workspace to config-store
EOF
  exit 0
fi

# ─── C1: drop required context flags ─────────────────────────────────────
C1_OFFENDERS=()
if [ -d "$COMMANDS_DIR" ]; then
  while IFS= read -r f; do
    if grep -qE 'requiredFlag\([^,]+,[[:space:]]*"(api-url|session-cookie|workspace-id)"' "$f"; then
      C1_OFFENDERS+=("$f")
    fi
  done < <(find "$COMMANDS_DIR" -name '*.ts' -type f 2>/dev/null)
fi
if [ "${#C1_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Make context flags optional with a config fallback (gate 6.C1).

  Add resolveContextFlag to apps/cli/src/flag-values.ts:

    export function resolveContextFlag(
      flags: Record<string, unknown>,
      key: "api-url" | "session-cookie" | "workspace-id"
    ): string {
      const fromFlag = stringOrUndef(flags[key]);
      if (fromFlag !== undefined) return fromFlag;
      const config = readConfig();
      const fromConfig = configValueFor(config, key);
      if (fromConfig !== undefined) return fromConfig;
      if (key === "api-url") {
        const env = process.env.VSPEC_API_URL;
        if (env !== undefined && env !== "") return env;
      }
      throw new Error(
        `Missing ${key}. Run 'vspec login' or pass --${key}.`
      );
    }

  Then in every offender below, replace
    requiredFlag(flags, "api-url"|"session-cookie"|"workspace-id")
  with
    resolveContextFlag(flags, "...")

EOF
  printf '  %s\n' "${C1_OFFENDERS[@]}"
  cat <<'EOF'

  The legacy CLI E2E tests pass these flags explicitly, so they keep
  working (flag wins). Honest-flow tests (Tranche E) omit the flags.

  Commit (split as needed):
    feat(cli): resolveContextFlag with config + env fallback
    refactor(cli): commands consume context flags via resolver
EOF
  exit 0
fi

# ─── D1: context commands ────────────────────────────────────────────────
D1_MISSING=()
if [ -f apps/cli/bin/run.js ]; then
  for entry in "${CONTEXT_COMMANDS[@]}"; do
    # shellcheck disable=SC2206
    parts=($entry)
    if ! node apps/cli/bin/run.js "${parts[@]}" --help >/dev/null 2>&1; then
      D1_MISSING+=("vspec $entry")
    fi
  done
else
  D1_MISSING=("(apps/cli/bin/run.js missing)")
fi
if [ "${#D1_MISSING[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Add the context commands (gate 6.D1).

  Missing:
EOF
  printf '    %s\n' "${D1_MISSING[@]}"
  cat <<'EOF'

  Per command:
    vspec logout
      - POST <api_url>/v1/auth/logout with the session cookie
      - writeConfig({ session_token: undefined, current_workspace_id: undefined })
      - Print "Logged out"

    vspec status
      - readConfig()
      - Print api_url / current_workspace_id / profile
      - No network call (must work with --api-url unreachable)

    vspec workspace switch <slug>
      - writeConfig({ current_workspace_id: <resolved id from --workspace-id
                                              or slug lookup against config> })
      - For the minimal D4 gate, accepting the slug as the new value is
        sufficient — full slug→id resolution is a follow-up

    vspec project switch <key>
      - writeConfig({ current_project_key: <key> })
      - (Extend VspecConfig with current_project_key — add it in A2 if
        you have not already)

  Server side (D2):
    Add POST /v1/auth/logout that deletes the cookie token from
    state.sessionsByToken and clears the cookie.

  Commit:
    feat(api): POST /v1/auth/logout
    feat(cli): logout / status / workspace switch / project switch
EOF
  exit 0
fi

# ─── D2: server logout endpoint ──────────────────────────────────────────
if ! grep -rqE '/v1/auth/logout' "$ROUTES_DIR" 2>/dev/null; then
  cat <<'EOF'
TASK: Add POST /v1/auth/logout (gate 6.D2).

  apps/api/src/http/signup-routes.ts (or its sibling) registers:

    app.post("/v1/auth/logout", (request, reply) => {
      const token = readCookie(request.headers.cookie, "vspec_session");
      if (token !== undefined) {
        state.sessionsByToken.delete(token);
      }
      reply.header("set-cookie", expiredCookie("vspec_session"));
      return reply.code(204).send();
    });

  Commit:
    feat(api): logout endpoint invalidates session token
EOF
  exit 0
fi

# ─── E1 / E2 / E4: honest-flow scenarios ─────────────────────────────────
HONEST_TEST_COUNT=0
if [ -d "$HONEST_DIR" ]; then
  HONEST_TEST_COUNT=$(find "$HONEST_DIR" -name '*.test.ts' -type f 2>/dev/null | wc -l | tr -d ' ')
fi
E2_OFFENDERS=()
if [ -d "$HONEST_DIR" ]; then
  while IFS= read -r f; do
    if grep -qE '\bfetch\(' "$f"; then
      E2_OFFENDERS+=("$f")
    fi
  done < <(find "$HONEST_DIR" -name '*.ts' -type f 2>/dev/null)
fi
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
if [ "$HONEST_TEST_COUNT" -eq 0 ] \
    || [ "${#E2_OFFENDERS[@]}" -gt 0 ] \
    || [ "${#E4_MISSING[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Author the honest-flow E2E (gates 6.E1 / 6.E2 / 6.E4).

  Create apps/cli/tests/e2e-cli-honest/login-to-usecase.test.ts.

  Constraints (every one is gated):
    - File MUST live under apps/cli/tests/e2e-cli-honest/
    - File MUST NOT call fetch( (gate 6.E2 greps every *.ts there)
    - File MUST set VSPEC_CONFIG_PATH to a per-test tmp path before
      spawning the CLI (gate 6.A4)
    - File MUST invoke each verb: ${HONEST_VERBS[*]} (gate 6.E4)

  Shape:
    1. startNetworkServer (existing helper is fine, just no in-test fetch)
    2. set VSPEC_CONFIG_PATH=tmp + VSPEC_AUTH_STUB=1
    3. runCli(["login", "--workspace-name", ..., "--workspace-slug", ...,
               "--api-url", server.apiUrl])
    4. runCli(["project", "create", "--name", ..., "--key", ...])
         — NO --api-url / --session-cookie / --workspace-id
    5. runCli(["actor", "create", "--name", ..., "--project-id", <parsed from stdout>])
         (project-id resolution from prior stdout is allowed; it is CLI
          output, not an inline fetch())
    6. runCli(["usecase", "create", "--title", ..., "--primary-actor", ...])

EOF
  if [ "$HONEST_TEST_COUNT" -eq 0 ]; then
    echo "  Status: $HONEST_DIR is empty"
  fi
  if [ "${#E2_OFFENDERS[@]}" -gt 0 ]; then
    echo "  Status: these files still call fetch( and must be cleaned:"
    printf '    %s\n' "${E2_OFFENDERS[@]}"
  fi
  if [ "${#E4_MISSING[@]}" -gt 0 ]; then
    echo "  Status: missing verb coverage: ${E4_MISSING[*]}"
  fi
  cat <<'EOF'

  Commit:
    test(cli-honest): full login → project → actor → usecase via CLI only
EOF
  exit 0
fi

# ─── E3: check-honest-cli-e2e.sh ─────────────────────────────────────────
if [ ! -f scripts/check-honest-cli-e2e.sh ]; then
  cat <<'EOF'
TASK: Add scripts/check-honest-cli-e2e.sh (gate 6.E3).

  Responsibilities:
    1. find apps/cli/tests/e2e-cli-honest -name '*.ts' -type f
       → no match may grep `fetch(`
    2. find apps/cli/tests/e2e-cli-honest -name '*.test.ts' -type f
       → must have at least one
    3. vitest run apps/cli/tests/e2e-cli-honest exits 0

  Make it executable; the goal-6 gate runs it directly.

  Commit:
    chore(scripts): honest-cli-e2e gate runner
EOF
  exit 0
fi

# ─── A4: VSPEC_CONFIG_PATH on every honest test ──────────────────────────
A4_OFFENDERS=()
if [ -d "$HONEST_DIR" ]; then
  while IFS= read -r f; do
    if ! grep -qE 'VSPEC_CONFIG_PATH' "$f"; then
      A4_OFFENDERS+=("$f")
    fi
  done < <(find "$HONEST_DIR" -name '*.test.ts' -type f 2>/dev/null)
fi
if [ "${#A4_OFFENDERS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Every honest-flow test must isolate its config (gate 6.A4).

  These tests do not set VSPEC_CONFIG_PATH:
EOF
  printf '    %s\n' "${A4_OFFENDERS[@]}"
  cat <<'EOF'

  Pattern (use a beforeEach or test-scoped tmp path):

    import { mkdtempSync } from "node:fs";
    import { tmpdir } from "node:os";
    import { join } from "node:path";

    let configPath: string;
    beforeEach(() => {
      configPath = join(mkdtempSync(join(tmpdir(), "vspec-cfg-")), "config.json");
    });
    // pass configPath via env to runCli child:
    //   env: { ...process.env, VSPEC_CONFIG_PATH: configPath }

  Commit:
    test(cli-honest): isolate VSPEC_CONFIG_PATH per case
EOF
  exit 0
fi

# ─── F1: gate rigor ──────────────────────────────────────────────────────
if ! bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/6-honest-cli.md" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make scripts/check-gate-rigor.sh green for goal 6 (gate 6.F1).

  The meta-gate flagged this goal's markdown as making "every X" claims
  while goals/6-honest-cli.gates.sh has no iteration covering them. Add
  a for/while/find loop that enumerates the claim's source of truth.

  Do not silence the check.
EOF
  exit 0
fi

# ─── All gates green ─────────────────────────────────────────────────────
cat <<'EOF'
TASK: All sub-gates of goal 6 appear to pass locally. Run:

    bash scripts/completion-check.sh

  to confirm globally. If green, either start goals/7-*.md or stop.
EOF
