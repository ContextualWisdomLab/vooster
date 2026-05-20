#!/usr/bin/env bash
# goals/3-managed-db.next-task.sh — Task hints for goal 3.
#
# Walks the agent through Tranches A → B → C → D and surfaces the first
# failing sub-gate. Each step names exact files and the commit-message
# scope to use.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ─── A1: Postgres test helper ────────────────────────────────────────────
HELPER=tests/helpers/postgres-db.ts
if [ ! -f "$HELPER" ]; then
  cat <<'EOF'
TASK: Author the Postgres schema-per-test helper (gate 3.A1).

  Create tests/helpers/postgres-db.ts. It should export something like:

      export async function createTestSchema(): Promise<{
        databaseUrl: string;
        drop: () => Promise<void>;
      }>

  Implementation outline:
    1. Read BASE_DATABASE_URL from process.env.TEST_DATABASE_URL
       (default: postgresql://vspec:vspec@localhost:5432/vspec).
    2. Generate a unique schema name: `test_${randomUUID().replace(/-/g, "")}`.
    3. Compose the per-test URL: `${BASE_DATABASE_URL}?schema=${schema}`.
    4. Run `prisma db push --skip-generate` with that URL via execFile.
    5. Return { databaseUrl, drop } where drop() executes
       `DROP SCHEMA "${schema}" CASCADE` via a transient PrismaClient.

  Tests can call it inside beforeEach (or beforeAll for whole-file isolation)
  and dispose in afterEach/afterAll.

  RED commit (write a tiny consumer that fails until the helper exists):
      red(testdb): schema-per-test helper
  GREEN commit (helper file + first passing consumer):
      green(testdb): schema-per-test helper

  Reference: Prisma docs on the `?schema=` connection-string parameter.
EOF
  exit 0
fi

REQUIRED=(postgresql:// 'randomUUID|crypto\.|uuid|cuid|Date\.now\(\)' 'prisma db push')
for needle in "${REQUIRED[@]}"; do
  if ! grep -qE "$needle" "$HELPER"; then
    cat <<EOF
TASK: Finish the Postgres test helper (gate 3.A1).

  $HELPER is missing required piece: $needle

  See goals/3-managed-db.md tranche A1 for the contract.
EOF
    exit 0
  fi
done

# ─── A3: e2e-cli helper not yet on Postgres ──────────────────────────────
CLI_HELPER=tests/e2e-cli/helpers.ts
if ! grep -qE 'postgres-db' "$CLI_HELPER" 2>/dev/null; then
  cat <<EOF
TASK: Switch tests/e2e-cli/helpers.ts to the Postgres helper (gates 3.A2 / 3.A3).

  In tests/e2e-cli/helpers.ts:
    1. Replace the line that builds a file: URL (currently around line 22):
           const databaseUrl = \`file:\${join(dir, "test.sqlite")}\`;
       with a call into the new helper:
           const { databaseUrl, drop } = await createTestSchema();
    2. Plumb \`drop\` into the existing tempDirs / cleanup machinery so it
       runs in stop() — DROP SCHEMA cleans up after every UC test.
    3. Run the suite:
           npx vitest run tests/e2e-cli
       All 35 UC-XXX.test.ts files should be green again.

  RED commit:
      red(testdb): e2e-cli helper migrates to postgres schemas
  GREEN commit:
      green(testdb): e2e-cli helper migrates to postgres schemas
EOF
  exit 0
fi

# ─── A4: persistence matrix not yet on Postgres ──────────────────────────
MATRIX=tests/integration/persistence-matrix.test.ts
if ! grep -qE 'postgres-db' "$MATRIX" 2>/dev/null; then
  cat <<EOF
TASK: Switch persistence-matrix to Postgres schemas (gates 3.A2 / 3.A4).

  In $MATRIX:
    - Every line of shape \`const databaseUrl = \`file:\${path.join(tempDir, "<entity>.sqlite")}\`;\`
      becomes \`const { databaseUrl, drop } = await createTestSchema();\` and
      pushes \`drop\` onto an array cleaned up in afterAll.
    - Keep every Prisma model reference (the gate still requires that).
    - Run: npx vitest run tests/integration/persistence-matrix.test.ts

  RED commit:
      red(testdb): persistence matrix migrates to postgres schemas
  GREEN commit:
      green(testdb): persistence matrix migrates to postgres schemas
EOF
  exit 0
fi

# ─── A2 / A5: any other file: URL or unsupervised spawn ──────────────────
LEFTOVER_FILES=()
while IFS= read -r f; do
  LEFTOVER_FILES+=("$f")
done < <(grep -rlE 'file:[^ "]*\.sqlite' tests/ 2>/dev/null || true)
if [ "${#LEFTOVER_FILES[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Remove the last file:*.sqlite URLs from tests/ (gate 3.A2).

  These files still build a file: URL:
EOF
  printf '    %s\n' "${LEFTOVER_FILES[@]}"
  cat <<'EOF'

  Replace each with a createTestSchema() call. Once the grep returns
  zero lines, gate 3.A2 goes green.

  Commit: green(testdb): drop sqlite from <file>
EOF
  exit 0
fi

SPAWN_VIOLATORS=()
while IFS= read -r f; do
  if grep -q 'DATABASE_URL' "$f" && ! grep -q 'postgres-db' "$f"; then
    case "$f" in
      tests/helpers/postgres-db.ts) ;;
      *) SPAWN_VIOLATORS+=("$f") ;;
    esac
  fi
done < <(grep -rlE '\bspawn\s*\(' tests/ 2>/dev/null || true)
if [ "${#SPAWN_VIOLATORS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Route the remaining server-spawning tests through the helper (gate 3.A5).

  These files spawn a server with a DATABASE_URL but don't import
  tests/helpers/postgres-db.ts:
EOF
  printf '    %s\n' "${SPAWN_VIOLATORS[@]}"
  cat <<'EOF'

  Replace whatever DATABASE_URL they build today with the helper's
  output. No file under tests/ may invent its own DATABASE_URL.

  Commit: green(testdb): route <file> through schema helper
EOF
  exit 0
fi

# ─── B1: schema still on sqlite or stray sqlite literal ──────────────────
PROVIDER=$(grep -E 'provider\s*=' prisma/schema.prisma | head -1 | sed -E 's/.*"([a-z]+)".*/\1/')
if [ "$PROVIDER" != "postgresql" ]; then
  cat <<EOF
TASK: Flip prisma/schema.prisma to postgres (gate 3.B1).

  Current provider: '$PROVIDER'
  Change to:
      datasource db {
        provider = "postgresql"
        url      = env("DATABASE_URL")
      }

  Then:
    1. Update .env.example: DATABASE_URL=postgresql://vspec:vspec@localhost:5432/vspec
    2. Update package.json: drop the dev SQLite default from start/prestart.
    3. npx prisma generate (verify it succeeds against the new URL).
    4. Re-run the test suite — all tests should already be on the helper
       by this point, so the flip should be silent.

  Commit: green(pgschema): switch prisma schema to postgresql
EOF
  exit 0
fi

SQLITE_FORBIDDEN_DIRS=(prisma src scripts tests)
SQLITE_FORBIDDEN_FILES=(.env.example package.json docker-compose.yml docker-compose.prod.yml Dockerfile)
SQLITE_HITS=()
for d in "${SQLITE_FORBIDDEN_DIRS[@]}"; do
  while IFS= read -r line; do
    [ -n "$line" ] && SQLITE_HITS+=("$line")
  done < <(grep -rinE '\bsqlite\b' "$d" 2>/dev/null || true)
done
for f in "${SQLITE_FORBIDDEN_FILES[@]}"; do
  [ -f "$f" ] || continue
  while IFS= read -r line; do
    [ -n "$line" ] && SQLITE_HITS+=("${f}: ${line}")
  done < <(grep -inE '\bsqlite\b' "$f" 2>/dev/null || true)
done
if [ "${#SQLITE_HITS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Sweep the last 'sqlite' literals (gate 3.B1).

  The provider is already postgresql, but these files still mention sqlite:
EOF
  printf '    %s\n' "${SQLITE_HITS[@]}" | head -20
  cat <<'EOF'

  Delete or rewrite each (comments included — the regex is bare).
  Commit: green(pgschema): purge sqlite literals
EOF
  exit 0
fi

# ─── B2: DB config still drifted ─────────────────────────────────────────
if ! bash "$ROOT/scripts/check-db-consistency.sh" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Align DB configuration after the postgres flip (gate 3.B2).

  scripts/check-db-consistency.sh is failing. Common causes after the
  flip:
    - package.json still defaults DATABASE_URL to file:.state/dev.sqlite
    - docker-compose.yml hardcodes a sqlite path for the dev service
    - .env.example shape doesn't match the schema provider

  Bring all four to postgres. Re-run:
      bash scripts/check-db-consistency.sh
  Commit: green(pgschema): config files agree on postgres
EOF
  exit 0
fi

# ─── B3: Dockerfile lacks migrations on boot ─────────────────────────────
if ! grep -qE 'prisma db push' Dockerfile 2>/dev/null; then
  cat <<'EOF'
TASK: Run migrations on container boot (gate 3.B3).

  In Dockerfile, replace:
      CMD ["node", "dist/src/index.js"]
  with something like:
      CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/src/index.js"]

  Or extract the two-line startup into a small shell script (e.g.,
  bin/start-prod.sh) and CMD into it.

  Rebuild and re-run:
      bash scripts/check-deployable.sh

  Commit: green(deploy): apply migrations on container boot
EOF
  exit 0
fi

# ─── B4: external-DB deploy gate ─────────────────────────────────────────
if [ ! -x "$ROOT/scripts/check-managed-db.sh" ] && [ ! -f "$ROOT/scripts/check-managed-db.sh" ]; then
  cat <<'EOF'
TASK: Add scripts/check-managed-db.sh (gate 3.B4).

  This script proves the production image works with a Postgres that
  lives OUTSIDE docker-compose.prod.yml's bundled db service.

  Outline:
    1. `docker network create vspec_managed_test_net` (idempotent).
    2. `docker run -d --network vspec_managed_test_net --name managed_pg
        -e POSTGRES_USER=vspec -e POSTGRES_PASSWORD=vspec
        -e POSTGRES_DB=vspec postgres:16-alpine`
       Wait for pg_isready.
    3. `docker build` the app image.
    4. `docker run -d --network vspec_managed_test_net
        -e DATABASE_URL=postgresql://vspec:vspec@managed_pg:5432/vspec
        -e GITHUB_CLIENT_ID=stub -e VSPEC_AUTH_STUB=1
        -p ${PORT}:3000 <image>`
    5. Poll /healthz, then drive the FULL signup roundtrip
       (/v1/auth/github/start → /v1/auth/github/callback). The callback
       writes to the DB; if migrations didn't run, this fails.
    6. Tear down both containers and the network.

  Make the script exit non-zero on any step's failure and clean up via
  trap EXIT.

  Commit: green(deploy): managed-db gate
EOF
  exit 0
fi
if ! bash "$ROOT/scripts/check-managed-db.sh" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make scripts/check-managed-db.sh green (gate 3.B4).

  Run it to see the failure:
      bash scripts/check-managed-db.sh

  Likely causes:
    - docker-compose.prod.yml still hardcodes a DATABASE_URL such that
      env overrides don't take effect — change to ${DATABASE_URL:-…}.
    - The Dockerfile's CMD doesn't run migrations.
    - The signup-callback path still depends on the bundled db service.

  Commit: green(deploy): app boots against external postgres
EOF
  exit 0
fi

# ─── C1–C4: CI workflow ──────────────────────────────────────────────────
CI_FILES=()
while IFS= read -r f; do
  CI_FILES+=("$f")
done < <(find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | sort)

if [ "${#CI_FILES[@]}" -eq 0 ]; then
  cat <<'EOF'
TASK: Add the CI workflow (gates 3.C1 / 3.C2 / 3.C3 / 3.C4).

  Create .github/workflows/ci.yml with:

    name: CI
    on:
      push:
        branches: [main]
      pull_request:
        branches: [main]

    jobs:
      test:
        runs-on: ubuntu-latest
        services:
          postgres:
            image: postgres:16-alpine
            env:
              POSTGRES_USER: vspec
              POSTGRES_PASSWORD: vspec
              POSTGRES_DB: vspec
            ports: ["5432:5432"]
            options: >-
              --health-cmd "pg_isready -U vspec"
              --health-interval 3s
              --health-timeout 3s
              --health-retries 10
        env:
          DATABASE_URL: postgresql://vspec:vspec@localhost:5432/vspec
          TEST_DATABASE_URL: postgresql://vspec:vspec@localhost:5432/vspec
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-node@v4
            with:
              node-version: "20"
              cache: npm
          - run: npm ci
          - run: npm run lint
          - run: npm run typecheck
          - run: npm test
          - run: bash scripts/completion-check.sh

  Commit: green(ci): postgres-backed github actions workflow
EOF
  exit 0
fi

HAS_PG=false
if [ "${#CI_FILES[@]}" -gt 0 ]; then
  for f in "${CI_FILES[@]}"; do
    if grep -qE 'postgres:16|image:\s*postgres' "$f" && grep -qiE 'pg_isready|health' "$f"; then
      HAS_PG=true
      break
    fi
  done
fi
if [ "$HAS_PG" != true ]; then
  cat <<'EOF'
TASK: Wire postgres into the CI workflow (gate 3.C2).

  At least one workflow under .github/workflows/ must declare a
  postgres:16-alpine service with a pg_isready healthcheck. See the
  snippet in goal 3 markdown.

  Commit: green(ci): postgres service container
EOF
  exit 0
fi

MISSING_STEPS=()
HAS_LINT=false
HAS_TYPECHECK=false
HAS_TEST=false
HAS_COMPLETION=false
if [ "${#CI_FILES[@]}" -gt 0 ]; then
  for f in "${CI_FILES[@]}"; do
    grep -qE 'npm (run )?lint|npx eslint' "$f"         && HAS_LINT=true
    grep -qE 'npm (run )?typecheck|tsc --noEmit' "$f"  && HAS_TYPECHECK=true
    grep -qE 'npm test|npm (run )?test|vitest run' "$f" && HAS_TEST=true
    grep -qE 'completion-check\.sh' "$f"               && HAS_COMPLETION=true
  done
fi
[ "$HAS_LINT" = true ]       || MISSING_STEPS+=("lint")
[ "$HAS_TYPECHECK" = true ]  || MISSING_STEPS+=("typecheck")
[ "$HAS_TEST" = true ]       || MISSING_STEPS+=("test")
[ "$HAS_COMPLETION" = true ] || MISSING_STEPS+=("completion-check.sh")
if [ "${#MISSING_STEPS[@]}" -gt 0 ]; then
  cat <<EOF
TASK: Add missing CI steps (gate 3.C3).

  Workflows under .github/workflows/ are missing: ${MISSING_STEPS[*]}

  Each must be runnable as a step in the test job. Order convention:
      npm ci → lint → typecheck → test → completion-check.sh

  Commit: green(ci): add <step> step
EOF
  exit 0
fi

if [ ! -f "$ROOT/scripts/check-ci.sh" ]; then
  cat <<'EOF'
TASK: Add scripts/check-ci.sh (gate 3.C4).

  This script parses every workflow file under .github/workflows/ with
  yq or `python -c "import yaml; yaml.safe_load(...)"` and verifies it
  references both `postgres` and `completion-check.sh`.

  Iterate the directory (find). Exit non-zero on any parse error or
  missing reference.

  Commit: green(ci): yaml validity gate
EOF
  exit 0
fi
if ! bash "$ROOT/scripts/check-ci.sh" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make scripts/check-ci.sh green (gate 3.C4).

  Run it for the failure detail:
      bash scripts/check-ci.sh

  Common causes:
    - Indentation drift in the YAML
    - Workflow missing the postgres or completion-check.sh reference

  Commit: green(ci): repair workflow yaml
EOF
  exit 0
fi

# ─── D: meta ─────────────────────────────────────────────────────────────
if ! bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/3-managed-db.md" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Strengthen gate rigor (gate 3.D4).

  scripts/check-gate-rigor.sh flagged goal 3 as making "every X" claims
  while its gates.sh has no iteration. Either:
    a) Rewrite the affected gate to enumerate from a source of truth
       (find, grep, mapfile, while-read), or
    b) Tighten the goal text so it no longer claims universality.
  Do not silence the check by removing "every" verbiage that the gates
  actually need.
EOF
  exit 0
fi

cat <<'EOF'
TASK: All sub-gates of goal 3 appear to pass locally. Run:

    bash scripts/completion-check.sh

  to confirm globally. If green, either start goals/4-*.md or stop.
EOF
