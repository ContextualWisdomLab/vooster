#!/usr/bin/env bash
# goals/9-cli-trim.next-task.sh — Task hints for goal 9 (CLI Spec Trim &
# Read-Path Completion).
#
# Walks the agent through the Recommended Order of Attack in
# goals/9-cli-trim.md: A (spec/findings trim) → C scaffold (doctor.ts) →
# B (dispatcher routes) → D (honest E2E) → E (envelope rollout) → F
# (rigor). Surfaces the first failing sub-gate.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CLI_SPEC=docs/07-cli-spec.md
FINDINGS=docs/findings-cli-spec-gaps.md
CLI_INDEX=apps/cli/src/index.ts
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

EXCLUDED_AGENT_FILES=(
  apps/cli/src/commands/member.ts
  apps/cli/src/commands/api-key.ts
)

FORBIDDEN_DOCTOR_LITERALS=(
  "active voice"
  "verb voice"
  "stakeholder interest"
  "extension outcome"
  "main success scenario has"
  "Cockburn requires"
)

# ─── A1: dropped verbs absent from spec ──────────────────────────────────
A1_OFFENDERS=()
for verb in "${DROPPED_VERBS[@]}"; do
  if grep -F -- "$verb" "$CLI_SPEC" >/dev/null 2>&1; then
    A1_OFFENDERS+=("$verb")
  fi
done
if [ "${#A1_OFFENDERS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Trim dropped verbs from $CLI_SPEC (gate 9.A1).

  Remove the following verbs entirely from docs/07-cli-spec.md — the
  Top-Level Commands table, the Help System section, the Use Cases
  section, anywhere they appear:

EOF
  printf '    %s\n' "${A1_OFFENDERS[@]}"
  cat <<'EOF'

  Each verb should disappear from synopsis lines AND from any prose
  references. The /loop's A4 will also require the same verbs (plus
  usecase edit/search) be cleared from docs/findings-cli-spec-gaps.md
  — that is a separate commit.

  Commit:
    docs(cli-spec): drop why/examples/explain/watch/help-tree
    docs(cli-spec): drop usecase search verb
EOF
  exit 0
fi

# ─── A2: usecase edit $EDITOR phrase absent ──────────────────────────────
A2_HITS=()
if grep -F -- 'Opens $EDITOR on the markdown form' "$CLI_SPEC" \
     >/dev/null 2>&1; then
  A2_HITS+=("\$EDITOR phrase")
fi
if grep -E -- 'vspec usecase edit[[:space:]]+<KEY-NNN>' "$CLI_SPEC" \
     >/dev/null 2>&1; then
  A2_HITS+=("vspec usecase edit <KEY-NNN> synopsis")
fi
if [ "${#A2_HITS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Drop the usecase edit $EDITOR flow from $CLI_SPEC (gate 9.A2).

  Remove the line:
      vspec usecase edit <KEY-NNN>            Opens $EDITOR on the markdown form.
  from docs/07-cli-spec.md. The replacement (`vspec usecase set
  <KEY-NNN> --field --value`) stays.

  Rationale: file-first workflow (specs/*.md ↔ server sync) already
  covers the use case; a $EDITOR dispatch duplicates the path with
  TTY-handling cost.

  Commit:
    docs(cli-spec): drop usecase edit editor flow
EOF
  exit 0
fi

# ─── A3 & A4: findings doc cleanup ───────────────────────────────────────
MISSING_SECTION_TMP="$(mktemp)"
awk '
  /^## Missing verbs/ { capture=1; next }
  capture && /^## / { capture=0 }
  capture { print }
' "$FINDINGS" >"$MISSING_SECTION_TMP" 2>/dev/null

A3_OFFENDERS=()
for verb in "${DROPPED_VERBS[@]}" "vspec usecase edit" "vspec usecase search"; do
  if grep -E "^- " "$MISSING_SECTION_TMP" 2>/dev/null \
       | grep -F -- "$verb" >/dev/null 2>&1; then
    A3_OFFENDERS+=("$verb")
  fi
done

A4_OFFENDERS=()
for verb in "${IN_SCOPE_VERBS[@]}"; do
  if grep -E "^- " "$MISSING_SECTION_TMP" 2>/dev/null \
       | grep -F -- "vspec $verb" >/dev/null 2>&1; then
    A4_OFFENDERS+=("vspec $verb")
  fi
done
rm -f "$MISSING_SECTION_TMP"

if [ "${#A3_OFFENDERS[@]}" -gt 0 ] || [ "${#A4_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Trim docs/findings-cli-spec-gaps.md (gates 9.A3 + 9.A4).

  The "Missing verbs" bullet list must no longer mention:
    - dropped verbs (resolved by removal from spec)
    - in-scope verbs (resolved by Goal 9 implementation)

EOF
  if [ "${#A3_OFFENDERS[@]}" -gt 0 ]; then
    echo "  Dropped verbs still bulleted as missing:"
    printf '    %s\n' "${A3_OFFENDERS[@]}"
  fi
  if [ "${#A4_OFFENDERS[@]}" -gt 0 ]; then
    echo "  In-scope verbs still bulleted as missing:"
    printf '    %s\n' "${A4_OFFENDERS[@]}"
  fi
  cat <<'EOF'

  Rewrite the section so the bullet list only contains verbs that
  remain genuinely unimplemented after Goal 9. You MAY append a
  paragraph footnote enumerating what Goal 9 dropped vs resolved —
  the gate only inspects `^- ` bullet lines inside the
  "Missing verbs" section.

  Commit:
    docs(findings): trim verbs resolved or dropped by Goal 9
EOF
  exit 0
fi

# ─── C1 (scaffold): doctor.ts must exist before B routes can be exercised ─
if [ ! -f "$DOCTOR_CMD" ]; then
  cat <<'EOF'
TASK: Scaffold apps/cli/src/commands/doctor.ts (gate 9.C1).

  Doctor is a thin renderer. It must NOT host validation logic.

  Surface (oclif-style):
    flags:
      --usecase  (optional, string)   target a single UC; otherwise
                                      doctor runs project-wide
      --project-id (optional, string)
      --format   (optional, human|json|agent)
      --api-url, --session-cookie     (standard CLI plumbing)

  Implementation outline:
    import { buildAgentEnvelope } from "../agent-envelope.js";
    import { fetchJson } from "../http-client.js";

    export async function runDoctor(flags, log) {
      const target = flags.usecase
        ? `/v1/usecases/${flags.usecase}/doctor`
        : `/v1/projects/${flags["project-id"]}/doctor`;
      const body = await fetchJson(target, { ... });
      if (flags.format === "agent") {
        log(JSON.stringify(buildAgentEnvelope({ data: body })));
        return;
      }
      // human/json branches render body.findings[]
    }

  Forbidden literals (gate 9.C3 enforces):
EOF
  printf '    %s\n' "${FORBIDDEN_DOCTOR_LITERALS[@]}"
  cat <<'EOF'

  If the API does not yet expose a doctor/quality endpoint, log the
  gap in docs/findings-cli-spec-gaps.md (NOT remove this verb from
  IN_SCOPE_VERBS — coordinate with the user to add an API task).

  Commit:
    feat(cli): doctor thin renderer scaffold
EOF
  exit 0
fi

# ─── B1: every in-scope verb routed ──────────────────────────────────────
B1_OFFENDERS=()
for verb in "${IN_SCOPE_VERBS[@]}"; do
  topic="${verb%% *}"
  action=""
  if [ "$topic" != "$verb" ]; then
    action="${verb#* }"
  fi
  if [ -z "$action" ]; then
    if ! grep -E "parsed\\.args\\.command === \"${topic}\"" "$CLI_INDEX" \
         >/dev/null 2>&1; then
      B1_OFFENDERS+=("$verb")
    fi
  else
    if ! awk -v topic="$topic" -v action="$action" '
      index($0, "parsed.args.command === \"" topic "\"") &&
      index($0, "this.argv[1] === \"" action "\"") { found=1 }
      END { exit found ? 0 : 1 }
    ' "$CLI_INDEX" >/dev/null 2>&1; then
      B1_OFFENDERS+=("$verb")
    fi
  fi
done
if [ "${#B1_OFFENDERS[@]}" -gt 0 ]; then
  NEXT_VERB="${B1_OFFENDERS[0]}"
  TOPIC="${NEXT_VERB%% *}"
  ACTION=""
  if [ "$TOPIC" != "$NEXT_VERB" ]; then
    ACTION="${NEXT_VERB#* }"
  fi
  cat <<EOF
TASK: Route '$NEXT_VERB' in $CLI_INDEX (gate 9.B1).

  Add the dispatch block. Pattern:

    if (parsed.args.command === "$TOPIC"
EOF
  if [ -n "$ACTION" ]; then
    cat <<EOF
        && this.argv[1] === "$ACTION") {
      await run$(tr '[:lower:]' '[:upper:]' <<<${TOPIC:0:1})${TOPIC:1}(
        parsed.flags, this.argv[1], this.argv[2], this.log.bind(this)
      );
      return;
    }
EOF
  else
    cat <<EOF
) {
      await run$(tr '[:lower:]' '[:upper:]' <<<${TOPIC:0:1})${TOPIC:1}(
        parsed.flags, this.log.bind(this)
      );
      return;
    }
EOF
  fi
  cat <<EOF

  Update apps/cli/src/commands/${TOPIC}.ts to handle the new action.
  Topic-level run functions usually switch on the action argument.

  Remaining verbs to route after this one:
EOF
  printf '    %s\n' "${B1_OFFENDERS[@]:1}"
  cat <<EOF

  Honest E2E for this verb (gate 9.D1) follows in the next iteration.
  Don't skip the test — that is what catches drift.

  Commit:
    feat(cli): route '$NEXT_VERB'
EOF
  exit 0
fi

# ─── B2: --help exit 0 ───────────────────────────────────────────────────
B2_OFFENDERS=()
for verb in "${IN_SCOPE_VERBS[@]}"; do
  # shellcheck disable=SC2086
  if ! node "$CLI_BIN" $verb --help >/dev/null 2>&1; then
    B2_OFFENDERS+=("$verb")
  fi
done
if [ "${#B2_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Make `vspec <verb> --help` exit 0 for every in-scope verb (gate 9.B2).

  Verbs whose --help currently fails:
EOF
  printf '    %s\n' "${B2_OFFENDERS[@]}"
  cat <<'EOF'

  Likely cause: missing flag declaration on the topic command class,
  or the runner trips on an unrouted action. Mirror the pattern in
  apps/cli/src/index.ts:runCli for any verb that needs custom --help
  output.

  Commit:
    fix(cli): --help exit code for <verb>
EOF
  exit 0
fi

# ─── C2: doctor calls an API endpoint ────────────────────────────────────
if ! ( grep -E '/v1/[a-zA-Z0-9_-]*(doctor|quality)' "$DOCTOR_CMD" \
         >/dev/null 2>&1 \
     && grep -E '\bfetchJson\b|\bfetch\(' "$DOCTOR_CMD" >/dev/null 2>&1 ); then
  cat <<'EOF'
TASK: doctor.ts must fetch its verdict from the API (gate 9.C2).

  The thin-renderer contract requires doctor.ts to:
    - call fetchJson (or fetch) on a path matching /v1/.../doctor or
      /v1/.../quality
    - render the response

  If the endpoint does not exist yet, do NOT inline rule logic here.
  Surface the API gap in docs/findings-cli-spec-gaps.md and coordinate
  an API-side task. doctor.ts stays empty-shelled until the endpoint
  ships.

  Commit:
    feat(cli): doctor calls /v1/.../doctor
EOF
  exit 0
fi

# ─── C3: forbidden rule literals ─────────────────────────────────────────
C3_OFFENDERS=()
for literal in "${FORBIDDEN_DOCTOR_LITERALS[@]}"; do
  if grep -F -i -- "$literal" "$DOCTOR_CMD" >/dev/null 2>&1; then
    C3_OFFENDERS+=("$literal")
  fi
done
if [ "${#C3_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Remove rule literals from doctor.ts (gate 9.C3).

  These tokens were the heuristic strings doctor would have
  hardcoded; they belong on the API, not the CLI:
EOF
  printf '    %s\n' "${C3_OFFENDERS[@]}"
  cat <<'EOF'

  doctor.ts renders body.findings[].message (or similar) verbatim
  from the API response. The CLI knows nothing about the rules
  themselves.

  Commit:
    refactor(cli): doctor renders API findings, no local rules
EOF
  exit 0
fi

# ─── C4: doctor.ts ≤ 120 LOC ─────────────────────────────────────────────
DOCTOR_LOC=$(wc -l <"$DOCTOR_CMD" 2>/dev/null | tr -d ' ')
if [ "${DOCTOR_LOC:-0}" -gt 120 ]; then
  cat <<EOF
TASK: Slim doctor.ts to ≤ 120 LOC (gate 9.C4).

  Current size: $DOCTOR_LOC lines.
  Push any local logic to the API. The CLI command's job is to:
    1. Parse flags.
    2. Resolve target URL.
    3. fetchJson.
    4. Branch on format and render.

  Anything beyond those four steps is API-side work.

  Commit:
    refactor(cli): doctor stays a thin renderer
EOF
  exit 0
fi

# ─── D1: honest E2E per verb ─────────────────────────────────────────────
honest_file_for_verb_next() {
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
    case "$action" in
      list|show) candidates+=("${topic}-read.test.ts") ;;
      edit|archive|reject) candidates+=("${topic}-edit.test.ts") ;;
      set|restore) candidates+=("${topic}-write.test.ts") ;;
    esac
  fi
  for cand in "${candidates[@]}"; do
    if [ -f "$HONEST_DIR/$cand" ]; then
      if [ -n "$action" ] && [[ "$cand" != "${topic}-${action}.test.ts" ]]; then
        if ! awk -v action="$action" '
          /runCli\(\[/ { inCall=1 }
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

D1_OFFENDERS=()
D1_FILES=()
for verb in "${IN_SCOPE_VERBS[@]}"; do
  if matched="$(honest_file_for_verb_next "$verb")"; then
    D1_FILES+=("$matched")
  else
    D1_OFFENDERS+=("$verb")
  fi
done
if [ "${#D1_OFFENDERS[@]}" -gt 0 ]; then
  NEXT_VERB="${D1_OFFENDERS[0]}"
  TOPIC="${NEXT_VERB%% *}"
  ACTION=""
  if [ "$TOPIC" != "$NEXT_VERB" ]; then
    ACTION="${NEXT_VERB#* }"
  fi
  PRIMARY="${TOPIC}-${ACTION:-cmd}.test.ts"
  GROUP=""
  case "${ACTION:-}" in
    list|show) GROUP="${TOPIC}-read.test.ts" ;;
    edit|archive|reject) GROUP="${TOPIC}-edit.test.ts" ;;
    set|restore) GROUP="${TOPIC}-write.test.ts" ;;
  esac
  cat <<EOF
TASK: Author honest E2E for '$NEXT_VERB' (gate 9.D1).

  Create $HONEST_DIR/$PRIMARY OR add to the grouped file:
EOF
  if [ -n "$GROUP" ]; then
    echo "    $HONEST_DIR/$GROUP"
  else
    echo "    (no grouped file allowed for this action)"
  fi
  cat <<EOF

  Pattern (single-verb file):
    import { describe, expect, test } from "vitest";
    import { runCli, startNetworkServer } from "../e2e-cli/helpers.js";
    import { expectOk, seedViaCli } from "./cli-setup.js";

    describe("honest CLI - $NEXT_VERB", () => {
      test("…", async () => {
        const server = await startNetworkServer("vspec-honest-${TOPIC}-${ACTION:-cmd}-");
        try {
          const seed = await seedViaCli({
            apiUrl: server.apiUrl, projectKey: "${TOPIC^^}", runCli
          });
          const result = await expectOk(runCli(
            ["$TOPIC"${ACTION:+, "$ACTION"}, /* extra args */],
            seed.env
          ));
          expect(result.stdout).toContain(/* expected token */);
        } finally {
          await server.stop();
        }
      });
    });

  Honest invariants (Goal 7 C3/C4 + Goal 9 D2/D3):
    - NO fetch( anywhere
    - the test must reference VSPEC_CONFIG_PATH (seedViaCli already does)
    - the test must import seedViaCli

  Remaining verbs to cover:
EOF
  printf '    %s\n' "${D1_OFFENDERS[@]:1}"
  cat <<EOF

  Commit:
    test(cli-honest): honest E2E for $NEXT_VERB
EOF
  exit 0
fi

# ─── D2 & D3: honest invariant + seedViaCli ──────────────────────────────
UNIQ_FILES=()
if [ "${#D1_FILES[@]}" -gt 0 ]; then
  for f in "${D1_FILES[@]}"; do
    skip=false
    if [ "${#UNIQ_FILES[@]}" -gt 0 ]; then
      for u in "${UNIQ_FILES[@]}"; do
        [ "$f" = "$u" ] && skip=true && break
      done
    fi
    [ "$skip" = false ] && UNIQ_FILES+=("$f")
  done
fi

D2_OFFENDERS=()
if [ "${#UNIQ_FILES[@]}" -gt 0 ]; then
  for f in "${UNIQ_FILES[@]}"; do
    if grep -E '\bfetch\(' "$f" >/dev/null 2>&1; then
      D2_OFFENDERS+=("$f (fetch() found)")
    elif ! grep -E 'VSPEC_CONFIG_PATH' "$f" >/dev/null 2>&1; then
      D2_OFFENDERS+=("$f (missing VSPEC_CONFIG_PATH)")
    fi
  done
fi
if [ "${#D2_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Honest invariant violations in new tests (gate 9.D2).

EOF
  printf '    %s\n' "${D2_OFFENDERS[@]}"
  cat <<'EOF'

  Replace fetch( with runCli([...]). VSPEC_CONFIG_PATH is provided by
  seedViaCli — make sure the test imports and uses it.

  Commit:
    test(cli-honest): restore honest invariant in <file>
EOF
  exit 0
fi

D3_OFFENDERS=()
if [ "${#UNIQ_FILES[@]}" -gt 0 ]; then
  for f in "${UNIQ_FILES[@]}"; do
    if ! grep -E "seedViaCli" "$f" >/dev/null 2>&1; then
      D3_OFFENDERS+=("$f")
    fi
  done
fi
if [ "${#D3_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: New honest tests must import seedViaCli (gate 9.D3).

EOF
  printf '    %s\n' "${D3_OFFENDERS[@]}"
  cat <<'EOF'

  Even if the test does not need the full seed path, calling
  seedViaCli({ apiUrl, runCli }) gives a uniform starting state and
  ensures VSPEC_CONFIG_PATH is set in seed.env. Take the actions you
  need from there.

  Commit:
    test(cli-honest): route <file> through seedViaCli
EOF
  exit 0
fi

# ─── E1: user-facing files have agent branch + envelope import ───────────
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
  if ! grep -E "from ['\"][./a-zA-Z0-9_-]*agent-envelope" "$f" \
        >/dev/null 2>&1; then
    E1_OFFENDERS+=("$f (no agent-envelope import)")
  fi
done
if [ "${#E1_OFFENDERS[@]}" -gt 0 ]; then
  NEXT_FILE="${E1_OFFENDERS[0]%% *}"
  cat <<EOF
TASK: Add the agent envelope branch to $NEXT_FILE (gate 9.E1).

  Pattern (mirror apps/cli/src/commands/usecase.ts):

    import { buildAgentEnvelope } from "../agent-envelope.js";

    if (flags.format === "agent") {
      log(JSON.stringify(buildAgentEnvelope({
        data: response,
        context: { project_key, branch, session_id, revision },
        suggested_next_actions: response.suggested_next_actions ?? [],
        warnings: response.warnings ?? []
      })));
      return;
    }

  Once the branch exists, Goal 7 A3/A4/A5 will start enforcing
  envelope routing for this file. Do not add JSON.stringify of
  ad-hoc shapes — only the envelope object.

  Remaining files after this one:
EOF
  printf '    %s\n' "${E1_OFFENDERS[@]:1}"
  cat <<EOF

  Commit:
    refactor(cli): route $(basename "$NEXT_FILE" .ts) agent output through buildAgentEnvelope
EOF
  exit 0
fi

# ─── E2: admin files do NOT carry an envelope branch ─────────────────────
E2_OFFENDERS=()
for f in "${EXCLUDED_AGENT_FILES[@]}"; do
  if [ -f "$f" ] && grep -E 'format === "agent"' "$f" >/dev/null 2>&1; then
    E2_OFFENDERS+=("$f")
  fi
done
if [ "${#E2_OFFENDERS[@]}" -gt 0 ]; then
  cat <<'EOF'
TASK: Remove envelope branch from excluded admin files (gate 9.E2).

EOF
  printf '    %s\n' "${E2_OFFENDERS[@]}"
  cat <<'EOF'

  Goal 9 scope-down: agents do not invoke admin verbs (member,
  api-key). Their human + json branches are sufficient. Drop the
  format === "agent" branch and the buildAgentEnvelope import.

  Commit:
    refactor(cli): drop agent envelope from admin verbs
EOF
  exit 0
fi

# ─── F1: gate rigor ──────────────────────────────────────────────────────
if ! bash "$ROOT/scripts/check-gate-rigor.sh" \
       "$ROOT/goals/9-cli-trim.md" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make scripts/check-gate-rigor.sh green for goal 9 (gate 9.F1).

  The meta-gate flagged goals/9-cli-trim.md as having universal
  claims while goals/9-cli-trim.gates.sh lacks a matching for / while
  / find / xargs iteration. Add the missing enumeration; do not
  silence the check.

  Commit:
    chore(goal-9): enumerate <claim> in gate suite
EOF
  exit 0
fi

# ─── All gates green ─────────────────────────────────────────────────────
cat <<'EOF'
TASK: All sub-gates of goal 9 appear to pass locally. Run:

    bash scripts/completion-check.sh

  to confirm globally. If green, either start the next goal or stop.
EOF
