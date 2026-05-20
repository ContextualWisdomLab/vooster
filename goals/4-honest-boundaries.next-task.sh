#!/usr/bin/env bash
# goals/4-honest-boundaries.next-task.sh — Task hints for goal 4.
#
# Walks the agent through Tranches A → B → C → D and surfaces the first
# failing sub-gate. Each step names exact files and the commit-message
# scope to use.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ─── A1: kill the file-content-grep boundary test ────────────────────────
FAKE_TEST=tests/unit/boundaries-config.test.ts
if [ -f "$FAKE_TEST" ] \
    && grep -q 'readFileSync' "$FAKE_TEST" 2>/dev/null \
    && grep -qE 'toMatch\(|toContain\(' "$FAKE_TEST" 2>/dev/null \
    && ! grep -qE 'ESLint\(|new Linter' "$FAKE_TEST" 2>/dev/null; then
  cat <<'EOF'
TASK: Replace the fake boundary test with a real one (gate 4.A1).

  tests/unit/boundaries-config.test.ts currently just readFileSync's
  eslint.config.js and regex-matches its body. That is not a boundary
  test — it is a config-spelling test. ESLint never runs.

  Replace it with a test that ACTUALLY runs ESLint, e.g.:

      import { ESLint } from "eslint";
      import { describe, expect, test } from "vitest";

      const eslint = new ESLint({ cwd: process.cwd() });

      describe("layer boundaries", () => {
        test("ports cannot import from http", async () => {
          const fixture = "src/ports/_fixture-bad.ts";
          // write a temp file that imports from ../http/, lint it,
          // expect the boundaries/element-types rule to error.
        });

        test("application can import from ports", async () => {
          // analogous positive case.
        });
      });

  This test will fail today because ESLint's current rules still allow
  `ports → http` (default: "allow"). That's the right RED — proceed to
  A3 to tighten the rules.

  RED commit:
      red(boundaries): replace fake boundary test with real lint check
  GREEN commit (after A3):
      green(boundaries): real lint enforcement
EOF
  exit 0
fi

# ─── A3: ESLint still default: allow ─────────────────────────────────────
if ! grep -qE 'default:\s*"disallow"' eslint.config.js 2>/dev/null; then
  cat <<'EOF'
TASK: Switch boundaries/element-types to deny-by-default (gate 4.A3).

  In eslint.config.js, inside the rule definition for
  "boundaries/element-types", change:

      { default: "allow", rules: [...] }

  to:

      { default: "disallow", rules: [...] }

  Then re-author the `rules: [...]` list to spell out EVERY allowed
  arrow (A4):

      rules: [
        { from: "cli",           allow: ["http", "application", "ports", "domain"] },
        { from: "http",          allow: ["application", "ports", "domain"] },
        { from: "application",   allow: ["ports", "domain"] },
        { from: "infrastructure",allow: ["ports", "domain"] },
        { from: "ports",         allow: ["domain"] },
        { from: "domain",        allow: [] }
      ]

  Running `npm run lint` will now scream at the 81 violating files in
  src/ports/, src/application/, src/infrastructure/. That is the
  honest signal that drives Tranche B.

  Commit:
      green(boundaries): deny-by-default plus architecture allow-list
EOF
  exit 0
fi

# ─── A4: allow-list drift from docs/01-architecture.md ──────────────────
# Parallel arrays (bash 3.2 compat).
REQUIRED_LAYERS=(cli http application infrastructure ports domain)
REQUIRED_ALLOWS=(
  "http application ports domain"
  "application ports domain"
  "ports domain"
  "ports domain"
  "domain"
  ""
)
A4_DRIFT=()
i=0
for layer in "${REQUIRED_LAYERS[@]}"; do
  required="${REQUIRED_ALLOWS[$i]}"
  i=$((i + 1))
  block=$(awk -v L="\"$layer\"" '
    $0 ~ "from:[[:space:]]*"L { capture=1 }
    capture { buf = buf $0 " " }
    capture && /\]/ && /allow/ { print buf; exit }
  ' eslint.config.js)
  for r in $required; do
    echo "$block" | grep -qE "\"$r\"" || A4_DRIFT+=("$layer → $r missing in allow")
  done
done
if [ "${#A4_DRIFT[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Align the boundaries allow-list with docs/01-architecture.md (gate 4.A4).

  These arrows from the architecture are missing from eslint.config.js:
EOF
  printf '    %s\n' "${A4_DRIFT[@]}"
  cat <<'EOF'

  The full required allow-list is in goal 4 markdown, Tranche A4.

  Commit:
      green(boundaries): align allow-list with architecture
EOF
  exit 0
fi

# ─── B1: Stored<Model> types missing from src/domain/ ───────────────────
MODELS=$(grep -E '^model ' prisma/schema.prisma | awk '{print $2}')
UNDECLARED=()
for m in $MODELS; do
  if [ ! -d src/domain ] || ! grep -rqE "(^|[[:space:]])(export[[:space:]]+)?(type|interface)[[:space:]]+Stored${m}\b" src/domain/ 2>/dev/null; then
    UNDECLARED+=("Stored${m}")
  fi
done
if [ "${#UNDECLARED[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Move Stored<Model> types into src/domain/ (gates 4.B1 / 4.B2).

  These domain types are still absent from src/domain/:
EOF
  printf '    %s\n' "${UNDECLARED[@]}"
  cat <<'EOF'

  Plan:
    1. mkdir -p src/domain/entities
    2. For each model in prisma/schema.prisma, create
       src/domain/entities/<lowercase-name>.ts that exports the
       Stored<Model> type currently living in src/http/signup-types.ts
       (and the few neighbours: src/http/api-key-types.ts,
       comment-types.ts, merge-request-types.ts).
    3. Add a barrel: src/domain/entities/index.ts re-exporting all.
    4. Delete the Stored* declarations from src/http/.

  Note: keep the StoredX SHAPE byte-for-byte identical. This is a
  mechanical relocation, not a redesign.

  RED commit:
      red(domain): assert every Prisma model has a domain entity
  GREEN commit:
      green(domain): relocate Stored* types into src/domain/entities
EOF
  exit 0
fi

# ─── B2: Stored* still leaking from src/http/ ────────────────────────────
HTTP_STORED=$(grep -rE '^export[[:space:]]+(type|interface)[[:space:]]+Stored' src/http/ 2>/dev/null || true)
if [ -n "$HTTP_STORED" ]; then
  cat <<EOF
TASK: Delete leftover Stored* declarations from src/http/ (gate 4.B2).

  These exports remain under src/http/:
EOF
  echo "$HTTP_STORED" | head -20 | sed 's/^/    /'
  cat <<'EOF'

  Delete (do not re-export). The src/domain/entities/index.ts barrel
  is the new import source.

  Commit:
      green(domain): purge Stored* exports from src/http
EOF
  exit 0
fi

# ─── B3: inner layers still importing ../http/ ───────────────────────────
UPWARD_VIOLATORS=()
while IFS= read -r f; do
  if grep -qE 'from "(\.\.\/)+http/' "$f" 2>/dev/null; then
    UPWARD_VIOLATORS+=("$f")
  fi
done < <(find src/ports src/application src/infrastructure -name '*.ts' 2>/dev/null)

if [ "${#UPWARD_VIOLATORS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Rewrite upward http imports (gate 4.B3).

  ${#UPWARD_VIOLATORS[@]} inner-layer file(s) still import from ../http/.
  First few:
EOF
  printf '    %s\n' "${UPWARD_VIOLATORS[@]}" | head -10
  cat <<'EOF'

  Mechanical fix:
      git ls-files 'src/ports/*.ts' 'src/application/*.ts' 'src/infrastructure/*.ts' \
        | xargs sed -i.bak -E 's|from "\.\./http/signup-types\.js"|from "../domain/entities/index.js"|g'
  …and similar lines for api-key-types, comment-types, merge-request-types.
  Verify with: npm run typecheck && npm run lint && npm test.

  Once green, the ESLint A2 gate stops the regression — this gate
  proves the migration completed.

  Commit:
      green(domain): redirect inner-layer imports to domain barrel
EOF
  exit 0
fi

# ─── B4: domain imports outward ──────────────────────────────────────────
DOMAIN_LEAKS=$(grep -rE 'from "(\.\.\/)+(cli|http|application|ports|infrastructure)/' src/domain/ 2>/dev/null || true)
if [ -n "$DOMAIN_LEAKS" ]; then
  cat <<EOF
TASK: Strip outward imports from src/domain/ (gate 4.B4).

  src/domain/ must depend on nothing else in src/:
EOF
  echo "$DOMAIN_LEAKS" | head -10 | sed 's/^/    /'
  cat <<'EOF'

  If a domain file needs a constant from application/, the constant
  belongs in domain.

  Commit:
      green(domain): make domain a leaf in the dependency graph
EOF
  exit 0
fi

# ─── A2: ESLint still red (do this once the moves above are mostly done)
if ! npx --no-install eslint . --max-warnings 0 >/tmp/4-a2-eslint.log 2>&1; then
  cat <<'EOF'
TASK: Drive ESLint to zero (gate 4.A2).

  npm run lint reports violations. See /tmp/4-a2-eslint.log.

  Most likely cluster: boundaries/element-types errors on files that
  still import upward. Tranches B1–B3 above are the primary fix.
  Whatever remains is normal lint cleanup; do not add
  `eslint-disable boundaries/element-types` — Forbidden Actions.

  Commit each batch as you go:
      green(boundaries): drive eslint to zero — <area>
EOF
  exit 0
fi

# ─── C1: god files ───────────────────────────────────────────────────────
GIANT_FILES=()
while IFS= read -r line; do
  size=$(echo "$line" | awk '{print $1}')
  path=$(echo "$line" | awk '{print $2}')
  [ "$path" = "total" ] && continue
  if [ "$size" -gt 1000 ] 2>/dev/null; then
    GIANT_FILES+=("$size $path")
  fi
done < <(find src -name '*.ts' -exec wc -l {} +)
if [ "${#GIANT_FILES[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Decompose god files (gate 4.C1).

  Files over 1000 lines:
EOF
  printf '    %s\n' "${GIANT_FILES[@]}"
  cat <<'EOF'

  Canonical decompositions:

  • src/infrastructure/prisma-signup-store.ts
      → one prisma-<port>-store.ts per file in src/ports/ (see C2).
        The in-memory siblings under src/infrastructure/memory-*-store.ts
        already model the per-port shape — copy that structure.
      → src/http/server.ts wires each store directly; the
        `serverOptions.signupStore ?? createMemoryX()` chain dissolves.

  • src/cli/index.ts
      → src/cli/commands/<subcommand>.ts per first-word subcommand,
        each extending @oclif/core Command. See C3.

  Stage the split in small PRs (one batch per area) so the test suite
  remains green throughout.

  Commit per batch:
      green(prisma-split): extract prisma-<name>-store
      green(cli-split): extract <subcommand> command
EOF
  exit 0
fi

# ─── C2: per-port Prisma adapters ────────────────────────────────────────
MISSING_ADAPTERS=()
while IFS= read -r port_file; do
  base=$(basename "$port_file" .ts)
  [ "$base" = "signup-store" ] && continue
  if [ ! -f "src/infrastructure/prisma-${base}.ts" ]; then
    MISSING_ADAPTERS+=("src/infrastructure/prisma-${base}.ts")
  fi
done < <(find src/ports -name '*-store.ts' 2>/dev/null)
if [ "${#MISSING_ADAPTERS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Create per-port Prisma adapters (gate 4.C2).

  Each port under src/ports/ must have a matching prisma adapter.
  Missing:
EOF
  printf '    %s\n' "${MISSING_ADAPTERS[@]}"
  cat <<'EOF'

  Steps per port:
    1. Copy the structure from the sibling memory-<name>-store.ts.
    2. Replace in-memory ops with PrismaClient calls.
    3. Update src/http/server.ts to wire prisma-<name>-store (in
       Postgres mode) instead of dereferencing the dissolved
       SignupStore intersection.
    4. Run npm test — the persistence-matrix test will catch any
       behaviour drift.

  Commit per port:
      green(prisma-split): prisma-<name>-store
EOF
  exit 0
fi

# ─── C3: CLI not split per command ───────────────────────────────────────
if [ ! -d src/cli/commands ]; then
  cat <<'EOF'
TASK: Split the CLI into one file per command (gate 4.C3).

  Create src/cli/commands/. For each subcommand currently routed by
  the `if (parsed.args.command === "X" && this.argv[1] === "Y")` chain
  in src/cli/index.ts, author a file:

      src/cli/commands/<subcommand>.ts

  extending @oclif/core Command, declaring its flags (drop the
  catch-all flags list from index.ts as you migrate), and implementing
  run().

  src/cli/index.ts should shrink to oclif's standard topic-routing
  bootstrap (typically <100 lines).

  Commit per batch (3–5 commands per commit is sane):
      green(cli-split): extract <subcommands>
EOF
  exit 0
fi

COMMAND_SOURCE=src/cli/index.ts
CMDS=$(grep -oE 'parsed\.args\.command === "[a-z][a-z0-9-]+"' "$COMMAND_SOURCE" 2>/dev/null \
       | sed -E 's/.*"([^"]+)".*/\1/' | sort -u)
if [ -z "$CMDS" ]; then
  CMDS=$(find src/cli/commands -maxdepth 1 -name '*.ts' -exec basename {} .ts \; | sort -u)
fi
MISSING_CMDS=()
for c in $CMDS; do
  if ! find src/cli/commands -maxdepth 2 -name "${c}.ts" -o -name "${c}/index.ts" 2>/dev/null | grep -q .; then
    MISSING_CMDS+=("$c")
  fi
done
if [ "${#MISSING_CMDS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Finish the CLI split (gate 4.C3).

  These subcommands still have no file under src/cli/commands/:
EOF
  printf '    %s\n' "${MISSING_CMDS[@]}"
  cat <<'EOF'

  When all subcommands have a dedicated file, delete the
  `if (parsed.args.command === …)` chain from src/cli/index.ts. C1
  re-verifies the size cap after the chain is gone.

  Commit:
      green(cli-split): extract <subcommand>
EOF
  exit 0
fi

# ─── D1: honest-gates meta script ────────────────────────────────────────
if [ ! -f "$ROOT/scripts/check-honest-gates.sh" ]; then
  cat <<'EOF'
TASK: Add scripts/check-honest-gates.sh (gate 4.D1).

  This meta-gate enumerates every test under tests/. It fails if a
  test file both:
    a) readFileSync's a known config file
       (eslint.config.js / tsconfig.json / package.json /
        prisma/schema.prisma / docker-compose*.yml / vitest.config.ts)
    b) asserts on the raw body via toMatch( or toContain(
  AND does not parse the body structurally (JSON.parse, yaml.safe_load,
  ESLint as a library, etc.).

  Outline:
      #!/usr/bin/env bash
      set -uo pipefail
      CONFIG_FILES=(eslint.config.js tsconfig.json …)
      OFFENDERS=()
      while IFS= read -r f; do
        reads=false
        for cfg in "${CONFIG_FILES[@]}"; do
          grep -q "readFileSync.*${cfg##*/}" "$f" && reads=true && break
        done
        $reads || continue
        grep -qE 'toMatch\(|toContain\(' "$f" || continue
        grep -qE 'JSON\.parse|yaml\.|safe_load|ESLint\(|new Linter' "$f" \
          && continue
        OFFENDERS+=("$f")
      done < <(find tests -name '*.test.ts')
      [ ${#OFFENDERS[@]} -eq 0 ] && exit 0
      printf 'dishonest test: %s\n' "${OFFENDERS[@]}"
      exit 1

  Make the script executable. Commit:
      green(honest-gates): meta script that bans config-grep tests
EOF
  exit 0
fi
if ! bash "$ROOT/scripts/check-honest-gates.sh" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make scripts/check-honest-gates.sh green (gate 4.D1).

  Run the script to see which tests still grep config text:
      bash scripts/check-honest-gates.sh

  Replace each with a test that runs the underlying tool (ESLint,
  TypeScript, etc.) or parses the file structurally (JSON.parse,
  yaml.safe_load).

  Commit:
      green(honest-gates): rewrite <test> against real behaviour
EOF
  exit 0
fi

# ─── D6: gate-rigor on goal 4 itself ─────────────────────────────────────
if ! bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/4-honest-boundaries.md" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Strengthen gate rigor for goal 4 itself (gate 4.D6).

  scripts/check-gate-rigor.sh flagged this goal's markdown as making
  "every X" claims while its gates.sh has no iteration. Either:
    a) Rewrite the affected gate to enumerate from a source of truth
       (find, grep '^model ', ls src/ports/), or
    b) Tighten the goal text so it no longer claims universality.
  Do not silence the check by removing "every" verbiage that the gates
  actually need.
EOF
  exit 0
fi

cat <<'EOF'
TASK: All sub-gates of goal 4 appear to pass locally. Run:

    bash scripts/completion-check.sh

  to confirm globally. If green, either start goals/5-*.md or stop.
EOF
