#!/usr/bin/env bash
# goals/7-cli-spec-parity.next-task.sh — Task hints for goal 7 (CLI Spec Parity).
#
# Walks the agent through the Recommended Order of Attack in
# goals/7-cli-spec-parity.md: A (envelope module + routing) → B (vspec init)
# → C (honest E2E expansion) → D (rigor). Surfaces the first failing sub-gate.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMMANDS_DIR=apps/cli/src/commands
ENVELOPE_MODULE=apps/cli/src/agent-envelope.ts
MUTATION_ENVELOPE_MODULE=apps/cli/src/domain/envelope.ts
INIT_CMD=apps/cli/src/commands/init.ts
CONFIG_STORE=apps/cli/src/config-store.ts
HONEST_DIR=apps/cli/tests/e2e-cli-honest
HONEST_SETUP=apps/cli/tests/e2e-cli-honest/cli-setup.ts
CLI_BIN=apps/cli/bin/run.js

ENVELOPE_KEYS=(data context suggested_next_actions warnings format_version)

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

# ─── A1: envelope module exists ──────────────────────────────────────────
if [ ! -f "$ENVELOPE_MODULE" ] \
    || ! grep -qE 'export function buildAgentEnvelope' "$ENVELOPE_MODULE"; then
  cat <<'EOF'
TASK: Create apps/cli/src/agent-envelope.ts (gate 7.A1).

  Export:
    export const FORMAT_VERSION = 1;

    export type AgentEnvelope<TData> = {
      data: TData;
      context: {
        project_key: string | null;
        branch: string | null;
        session_id: string | null;
        revision: string | null;
      };
      suggested_next_actions: Array<{ command: string; reason?: string }>;
      warnings: Array<{ message: string }>;
      format_version: 1;
    };

    export function buildAgentEnvelope<TData>(input: {
      data: TData;
      context?: Partial<AgentEnvelope<TData>["context"]>;
      suggested_next_actions?: AgentEnvelope<TData>["suggested_next_actions"];
      warnings?: AgentEnvelope<TData>["warnings"];
    }): AgentEnvelope<TData>;

  Default context fields to null. Default arrays to [].
  Add apps/cli/tests/unit/agent-envelope.test.ts covering:
    - format_version === 1
    - all five top-level keys present
    - context defaults
    - warnings + suggested_next_actions default to []

  Commit:
    feat(cli): agent envelope module with format_version=1
EOF
  exit 0
fi

# ─── A2: format_version literal and uniqueness ───────────────────────────
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
A2_LITERAL_OK=true
if ! grep -qE 'format_version[[:space:]]*:[[:space:]]*1\b' "$ENVELOPE_MODULE"; then
  A2_LITERAL_OK=false
fi
V2_LITERAL_OK=true
if ! grep -qE 'ENVELOPE_VERSION_V2[[:space:]]*=[[:space:]]*2[[:space:]]+as[[:space:]]+const' "$MUTATION_ENVELOPE_MODULE" \
    || ! grep -qE '\bformat_version\b' "$MUTATION_ENVELOPE_MODULE"; then
  V2_LITERAL_OK=false
fi
if [ "${#A2_OFFENDERS[@]}" -gt 0 ] || [ "$A2_LITERAL_OK" = false ] || [ "$V2_LITERAL_OK" = false ]; then
  cat <<'EOF'
TASK: Confine format_version to the two envelope modules. See
goals/7-cli-spec-parity.md § "Tranche A — `--format=agent` envelope
standardization".

Legacy agent format_version belongs in apps/cli/src/agent-envelope.ts.
Mutation agent format_version belongs in apps/cli/src/domain/envelope.ts.

EOF
  if [ "${#A2_OFFENDERS[@]}" -gt 0 ]; then
    echo "  Files mentioning format_version outside the module:"
    printf '    %s\n' "${A2_OFFENDERS[@]}"
  fi
  if [ "$A2_LITERAL_OK" = false ]; then
    echo "  Envelope module is missing 'format_version: 1' as a literal."
  fi
  if [ "$V2_LITERAL_OK" = false ]; then
    echo "  Mutation envelope module is missing the format_version: 2 source."
  fi
  exit 0
fi

# ─── A3: every agent-format command imports the envelope ─────────────────
A3_OFFENDERS=()
while IFS= read -r f; do
  if ! grep -qE "from ['\"][./a-zA-Z0-9_-]*agent-envelope" "$f"; then
    A3_OFFENDERS+=("$f")
  fi
done < <(grep -rlE 'format === "agent"' "$COMMANDS_DIR" 2>/dev/null)
if [ "${#A3_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Route every agent-format branch through buildAgentEnvelope (gate 7.A3).

  For each file below, replace the current agent branch with:

    import { buildAgentEnvelope } from "../agent-envelope.js";

    if (flags.format === "agent") {
      writeLine(JSON.stringify(buildAgentEnvelope({
        data: body,                                   // command-specific
        context: { project_key, branch, session_id, revision },
        suggested_next_actions: body.suggested_next_actions ?? [],
        warnings: body.warnings ?? []
      })));
      return;
    }

  Files still without the import:
EOF
  printf '    %s\n' "${A3_OFFENDERS[@]}"
  cat <<'EOF'

  context fields come from either:
    - the command's own response body (when the API supplies them)
    - readConfig() for project_key
    - null otherwise (default behavior in buildAgentEnvelope)

  Commit (split per command family if the diff balloons):
    refactor(cli): route <command> agent output through buildAgentEnvelope
EOF
  exit 0
fi

# ─── A4: agent branch emits all five envelope keys ───────────────────────
A4_OFFENDERS=()
while IFS= read -r f; do
  MISSING_KEYS=()
  for key in "${ENVELOPE_KEYS[@]}"; do
    if ! grep -qE "\\b${key}\\b" "$f" \
        && ! grep -qE 'buildAgentEnvelope' "$f"; then
      MISSING_KEYS+=("$key")
    fi
  done
  if [ "${#MISSING_KEYS[@]}" -gt 0 ]; then
    A4_OFFENDERS+=("$f (missing: ${MISSING_KEYS[*]})")
  fi
done < <(grep -rlE 'format === "agent"' "$COMMANDS_DIR" 2>/dev/null)
if [ "${#A4_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Ensure every agent branch passes through buildAgentEnvelope (gate 7.A4).

  These command files have format === "agent" branches whose emission
  does not flow through buildAgentEnvelope (the envelope contract
  guarantees all five keys; the gate's heuristic is "imports
  buildAgentEnvelope" + "name mentions every key"):

EOF
  printf '    %s\n' "${A4_OFFENDERS[@]}"
  cat <<'EOF'

  Commit:
    refactor(cli): route remaining agent branches through envelope
EOF
  exit 0
fi

# ─── A5: no raw JSON.stringify in agent branches ─────────────────────────
A5_OFFENDERS=()
while IFS= read -r f; do
  if grep -qE 'JSON\.stringify' "$f" \
      && ! grep -qE 'buildAgentEnvelope' "$f"; then
    A5_OFFENDERS+=("$f")
  fi
done < <(grep -rlE 'format === "agent"' "$COMMANDS_DIR" 2>/dev/null)
if [ "${#A5_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Drop direct JSON.stringify from agent branches (gate 7.A5).

  Agent-format output is always the envelope. The only acceptable
  stringify is:
    writeLine(JSON.stringify(buildAgentEnvelope({ ... })));

  Files with raw JSON.stringify that lack the envelope import:
EOF
  printf '    %s\n' "${A5_OFFENDERS[@]}"
  cat <<'EOF'

  Commit:
    refactor(cli): drop ad-hoc JSON.stringify in agent branches
EOF
  exit 0
fi

# ─── B1: init command file ───────────────────────────────────────────────
if [ ! -f "$INIT_CMD" ]; then
  cat <<'EOF'
TASK: Add the init command file (gate 7.B1).

  Create apps/cli/src/commands/init.ts. Required surface (oclif-style):

    flags:
      --project (required, string)   binds the per-repo config to <key>
      --force   (optional, boolean)  allow overwriting an existing
                                     .vspec/config.json
      --format  (optional, human|json|agent)

  Wire it into apps/cli/src/index.ts alongside the other topic
  commands. Confirm:
    node apps/cli/bin/run.js init --help
  exits 0.

  Commit:
    feat(cli): init command scaffold
EOF
  exit 0
fi

if [ -f "$CLI_BIN" ] && ! node "$CLI_BIN" init --help >/dev/null 2>&1; then
  cat <<'EOF'
TASK: vspec init --help must exit 0 (gate 7.B1).

  Run:
    node apps/cli/bin/run.js init --help

  Likely cause: the command is not registered in apps/cli/src/index.ts
  or its export shape is incompatible with the runner.

  Commit:
    fix(cli): register init command in CLI entrypoint
EOF
  exit 0
fi

if VSPEC_GATES_SKIP_DEEP=1 bash "$ROOT/goals/7-cli-spec-parity.gates.sh" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: All sub-gates of goal 7 appear to pass locally. Run:

    bash scripts/completion-check.sh

  to confirm globally. If green, either start goals/8-*.md or stop.
EOF
  exit 0
fi

# ─── B2: init --project writes ./.vspec/config.json ──────────────────────
B2_TMP="$(mktemp -d)"
trap 'rm -rf "$B2_TMP"' EXIT
(
  cd "$B2_TMP"
  node "$ROOT/$CLI_BIN" init --project ACME >/dev/null 2>&1
)
if [ ! -f "$B2_TMP/.vspec/config.json" ] \
    || ! grep -qE '"current_project_key"[[:space:]]*:[[:space:]]*"ACME"' \
         "$B2_TMP/.vspec/config.json"; then
  cat <<'EOF'
TASK: vspec init --project writes ./.vspec/config.json (gate 7.B2).

  In apps/cli/src/commands/init.ts:

    import { writeConfig } from "../config-store.js";
    import { join } from "node:path";

    const repoConfigPath = join(process.cwd(), ".vspec", "config.json");
    writeConfig(
      { current_project_key: flags.project },
      { path: repoConfigPath }
    );

  Extend config-store.ts with a path-aware overload so we do not write
  to ~/.vspec/config.json here:

    export function writeConfig(
      patch: Partial<VspecConfig>,
      opts?: { path?: string }
    ): void;

  Default behavior stays unchanged; opts.path overrides the global path.

  Add VspecConfig.current_project_key if it does not already exist.

  Commit:
    feat(cli): init writes per-repo .vspec/config.json
EOF
  exit 0
fi

# ─── B3: init without --project fails ────────────────────────────────────
B3_TMP="$(mktemp -d)"
B3_STDERR="$(mktemp)"
(
  cd "$B3_TMP"
  node "$ROOT/$CLI_BIN" init >/dev/null 2>"$B3_STDERR"
)
B3_STATUS=$?
rm -rf "$B3_TMP"
if [ "$B3_STATUS" -eq 0 ] || ! grep -qE 'project' "$B3_STDERR"; then
  rm -f "$B3_STDERR"
  cat <<'EOF'
TASK: vspec init without --project must fail (gate 7.B3).

  Validation behavior:
    - exit code != 0 (use 2 to follow docs/07-cli-spec.md exit code table)
    - stderr mentions the missing --project flag

  oclif handles required flags natively if you declare --project as
  required: true.

  Commit:
    feat(cli): init --project required validation
EOF
  exit 0
fi
rm -f "$B3_STDERR"

# ─── B4: init refuses to overwrite without --force ───────────────────────
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
rm -rf "$B4_TMP"
if [ "$B4_NOFORCE_OK" = false ] || [ "$B4_FORCE_OK" = false ]; then
  cat <<'EOF'
TASK: vspec init refuses to overwrite without --force (gate 7.B4).

  In init.ts:

    if (existsSync(repoConfigPath) && !flags.force) {
      writeLine(`Error: ${repoConfigPath} already exists. ` +
                `Re-run with --force to overwrite.`);
      this.exit(6);  // local config / state error per CLI spec
    }

  --force triggers a full overwrite (use writeConfig with the path
  override; the existing content is replaced, not merged, when --force
  is set — distinguish via opts.replace=true in writeConfig if needed).

  Commit:
    feat(cli): init refuses overwrite without --force
EOF
  exit 0
fi

# ─── B5: only init.ts touches .vspec/config.json ─────────────────────────
B5_OFFENDERS=()
while IFS= read -r f; do
  case "$f" in
    "$INIT_CMD") continue ;;
  esac
  if grep -qE '\.vspec/config\.json|writeFile\(.*\.vspec' "$f"; then
    B5_OFFENDERS+=("$f")
  fi
done < <(find "$COMMANDS_DIR" -name '*.ts' -type f 2>/dev/null)
if [ "${#B5_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Confine per-repo .vspec writes to init.ts (gate 7.B5).

  These command files also touch .vspec/config.json directly. Route
  them through config-store.ts (extending the path-aware API) or move
  the logic into init.ts:

EOF
  printf '    %s\n' "${B5_OFFENDERS[@]}"
  cat <<'EOF'

  Commit:
    refactor(cli): per-repo config writes go through config-store
EOF
  exit 0
fi

# ─── C1: cli-setup.ts helper ─────────────────────────────────────────────
if [ ! -f "$HONEST_SETUP" ] \
    || ! grep -qE 'seedViaCli' "$HONEST_SETUP" \
    || grep -qE '\bfetch\(' "$HONEST_SETUP"; then
  cat <<'EOF'
TASK: Extract the honest-flow setup helper (gate 7.C1).

  Create apps/cli/tests/e2e-cli-honest/cli-setup.ts.

  Export:
    export async function seedViaCli(args: {
      apiUrl: string;
      configPath: string;
      runCli: typeof import("../e2e-cli/helpers.ts").runCli;
      workspaceName?: string;
      workspaceSlug?: string;
      projectKey?: string;
      projectName?: string;
      actorName?: string;
      useCaseTitle?: string;
    }): Promise<{
      workspaceId: string;
      projectKey: string;
      actorName: string;
      useCaseKey: string;
    }>;

  Implementation rules:
    - Every step is a runCli([...]) call. No fetch( anywhere.
    - Set VSPEC_AUTH_STUB=1 and VSPEC_CONFIG_PATH=args.configPath in
      the child env.
    - Login first; then runCli(["project", "create", ...]); then
      ["actor", "create", ...]; then ["usecase", "create", ...].
    - Parse identifiers (project key, usecase key) from stdout —
      every CLI command already prints them. If a parse target is
      brittle, log it to docs/findings/2026-05-21T1856-cli-spec-gaps.md and pick a
      different parse anchor.

  Migrate the existing login-to-usecase.test.ts to call seedViaCli so
  the helper is exercised by Goal 6's existing gate.

  Commit:
    test(cli-honest): extract seedViaCli helper
EOF
  exit 0
fi

# ─── C2: every UC in HONEST_UC_SET has a matching test ───────────────────
C2_MISSING=()
for uc in "${HONEST_UC_SET[@]}"; do
  if ! find "$HONEST_DIR" -maxdepth 1 -name "${uc}-*.test.ts" -type f \
       2>/dev/null | grep -q .; then
    C2_MISSING+=("$uc")
  fi
done
if [ "${#C2_MISSING[@]}" -gt 0 ]; then
  NEXT_UC="${C2_MISSING[0]}"
  cat <<EOF
TASK: Author honest E2E for ${NEXT_UC} (gate 7.C2).

  Create apps/cli/tests/e2e-cli-honest/${NEXT_UC}-<slug>.test.ts.

  Pattern:
    import { startNetworkServer, runCli } from "../e2e-cli/helpers.js";
    import { seedViaCli } from "./cli-setup.js";

    let server: Awaited<ReturnType<typeof startNetworkServer>>;
    let configPath: string;

    beforeEach(async () => {
      server = await startNetworkServer("${NEXT_UC}");
      configPath = join(
        mkdtempSync(join(tmpdir(), "vspec-cfg-")), "config.json"
      );
    });
    afterEach(async () => { await server.stop(); });

    test("${NEXT_UC}: <verb phrase>", async () => {
      const seed = await seedViaCli({
        apiUrl: server.apiUrl, configPath, runCli
      });
      // UC-specific runCli([...]) calls assert the scenario.
      // NEVER call fetch( in this file.
    });

  Reference the existing apps/cli/tests/e2e-cli/${NEXT_UC}.test.ts to
  understand what to seed and what to assert.

  Remaining UCs after this one:
EOF
  printf '    %s\n' "${C2_MISSING[@]:1}"
  cat <<EOF

  IF you discover the CLI cannot drive this UC end-to-end:
    1. Append a row to docs/findings/2026-05-21T1856-cli-spec-gaps.md describing the
       missing/broken verb (create the file if absent).
    2. Remove ${NEXT_UC} from HONEST_UC_SET in BOTH
       goals/7-cli-spec-parity.gates.sh and .next-task.sh.
    3. Commit with chore(goal-7): defer ${NEXT_UC} per CLI gap.
    DO NOT add new CLI verbs in this goal.

  Commit:
    test(cli-honest): honest E2E for ${NEXT_UC}
EOF
  exit 0
fi

# ─── C3: zero fetch( in honest dir ───────────────────────────────────────
C3_OFFENDERS=()
if [ -d "$HONEST_DIR" ]; then
  while IFS= read -r f; do
    if grep -qE '\bfetch\(' "$f"; then
      C3_OFFENDERS+=("$f")
    fi
  done < <(find "$HONEST_DIR" -name '*.ts' -type f 2>/dev/null)
fi
if [ "${#C3_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Drop every fetch( call under e2e-cli-honest/ (gate 7.C3).

  Honest invariant: setup and assertions only via runCli. If a
  scenario genuinely needs HTTP, it does not belong here.

  Offenders:
EOF
  printf '    %s\n' "${C3_OFFENDERS[@]}"
  cat <<'EOF'

  Commit:
    test(cli-honest): remove fetch from honest setup
EOF
  exit 0
fi

# ─── C4: every honest test sets VSPEC_CONFIG_PATH ────────────────────────
C4_OFFENDERS=()
if [ -d "$HONEST_DIR" ]; then
  while IFS= read -r f; do
    if ! grep -qE 'VSPEC_CONFIG_PATH' "$f"; then
      C4_OFFENDERS+=("$f")
    fi
  done < <(find "$HONEST_DIR" -name '*.test.ts' -type f 2>/dev/null)
fi
if [ "${#C4_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Every honest test isolates VSPEC_CONFIG_PATH (gate 7.C4).

  These files do not reference VSPEC_CONFIG_PATH:
EOF
  printf '    %s\n' "${C4_OFFENDERS[@]}"
  cat <<'EOF'

  Pattern:
    beforeEach(() => {
      configPath = join(mkdtempSync(join(tmpdir(), "vspec-cfg-")),
                        "config.json");
    });

  Pass via child env when invoking runCli (seedViaCli does this for
  shared setup; UC-specific runCli calls must also pass it).

  Commit:
    test(cli-honest): isolate VSPEC_CONFIG_PATH in <UC>
EOF
  exit 0
fi

# ─── C5: check-honest-cli-e2e.sh ─────────────────────────────────────────
if [ -f scripts/check-honest-cli-e2e.sh ] \
    && ! bash scripts/check-honest-cli-e2e.sh >/dev/null 2>&1; then
  cat <<'EOF'
TASK: scripts/check-honest-cli-e2e.sh must pass on the expanded set
      (gate 7.C5).

  Run:
    bash scripts/check-honest-cli-e2e.sh

  Investigate the output. Likely causes:
    - A new honest test fails functionally (the CLI does not do what
      the test asserts → finding doc + remove UC from HONEST_UC_SET).
    - A test sets up state the API does not accept (use seedViaCli
      consistently).

  Commit:
    fix(cli-honest): <specific fix>
EOF
  exit 0
fi

# ─── D1: gate rigor ──────────────────────────────────────────────────────
if ! bash "$ROOT/scripts/check-gate-rigor.sh" \
       "$ROOT/goals/7-cli-spec-parity.md" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make scripts/check-gate-rigor.sh green for goal 7 (gate 7.D1).

  The meta-gate flagged this goal's markdown as making "every X" claims
  while goals/7-cli-spec-parity.gates.sh has no iteration covering them.
  Add a for/while/find loop that enumerates the claim's source of truth.

  Do not silence the check.

  Commit:
    chore(goal-7): enumerate <claim> in gate suite
EOF
  exit 0
fi

# ─── All gates green ─────────────────────────────────────────────────────
cat <<'EOF'
TASK: All sub-gates of goal 7 appear to pass locally. Run:

    bash scripts/completion-check.sh

  to confirm globally. If green, either start goals/8-*.md or stop.
EOF
