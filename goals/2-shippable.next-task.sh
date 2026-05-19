#!/usr/bin/env bash
# goals/2-shippable.next-task.sh — Task hints for goal 2.
#
# Walks the agent through Tranches A → B → C → D and surfaces the first
# failing sub-gate so the agent stays focused. Each step names exact files
# and the expected commit-message scope.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SIGNUP_STATE_WHITELIST='^(pendingOAuth|sessionsByToken|readOnlyMemberships)$'

# ─── A1/A2: in-memory Maps remaining ─────────────────────────────────────
LEFTOVER=$(awk '/^export type SignupState = \{/,/^\};/' src/http/signup-types.ts 2>/dev/null \
  | grep -E '^\s+[a-zA-Z]+\s*:\s*(Map|Set)<' \
  | awk -F: '{gsub(/^[ \t]+/,"",$1); print $1}' \
  | grep -vE "$SIGNUP_STATE_WHITELIST" | head -1 || true)

if [ -n "$LEFTOVER" ]; then
  cat <<EOF
TASK: Migrate the next entity to Prisma (gates 2.A1 / 2.A2 / 2.A3 / 2.A4).

  Candidate SignupState field: ${LEFTOVER}

  One TDD cycle:
  1. Identify the Prisma model that backs ${LEFTOVER}. If absent, add it to
     prisma/schema.prisma and run npx prisma migrate dev.
  2. RED: extend tests/integration/persistence-matrix.test.ts with a stanza
     that creates a ${LEFTOVER} entity via the HTTP API, restarts the
     server, and reads it back. Commit:
         red(persist): ${LEFTOVER} survives restart
  3. GREEN: add src/infrastructure/<entity>-store.ts with Prisma calls,
     expose via a port in src/ports/, consume in src/http/. Delete the
     '${LEFTOVER}' field from SignupState in the SAME commit. Commit:
         green(persist): <entity> backed by prisma
  4. Verify previous goals still green:
         bash goals/0-init.gates.sh && bash goals/1-runnable.gates.sh
EOF
  exit 0
fi

# ─── A3: Prisma model not yet exercised ──────────────────────────────────
MODELS=$(grep -E '^model ' prisma/schema.prisma | awk '{print $2}')
for m in $MODELS; do
  lower=$(echo "$m" | awk '{print tolower(substr($0,1,1)) substr($0,2)}')
  if ! grep -rq "prisma\.${lower}\." src/infrastructure/ 2>/dev/null; then
    cat <<EOF
TASK: Wire Prisma model '$m' through an adapter (gate 2.A3).

  No file under src/infrastructure/ contains prisma.${lower}.* yet.

  Add src/infrastructure/${lower}-store.ts (or merge into an existing
  store) and use it from the relevant route via a port. Then extend
  tests/integration/persistence-matrix.test.ts to reference '$m'.
  Commit: green(persist): ${m} adapter
EOF
    exit 0
  fi
done

# ─── A4: matrix test missing or red ──────────────────────────────────────
MATRIX=tests/integration/persistence-matrix.test.ts
if [ ! -f "$MATRIX" ]; then
  cat <<'EOF'
TASK: Create tests/integration/persistence-matrix.test.ts (gate 2.A4).

  - RED commit: scaffold a test that enumerates models from
    prisma/schema.prisma (read at test time via fs) and for each model:
      a) create one entity via the HTTP API
      b) SIGTERM the server
      c) restart against the same SQLite file
      d) fetch the entity back via HTTP
  - Use child_process.spawn of `node dist/src/index.js` so the test exercises
    the real boot path (no createServer() shortcut).
  - The test must reference every model name as a string literal so the
    gate's grep finds it.
  - Commit: red(persist): scaffold persistence-matrix test
EOF
  exit 0
fi
if ! npx --no-install vitest run "$MATRIX" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make tests/integration/persistence-matrix.test.ts green (gate 2.A4).

  Run it locally to see the first failing model:
      npx vitest run tests/integration/persistence-matrix.test.ts
  Migrate that model's route to Prisma. Delete the matching SignupState
  field in the same commit.
EOF
  exit 0
fi

# ─── B1: real OAuth ──────────────────────────────────────────────────────
if ! grep -rq 'GITHUB_CLIENT_ID' src/ 2>/dev/null; then
  cat <<'EOF'
TASK: Implement real GitHub OAuth (gate 2.B1).

  1. RED: write tests/e2e/UC-001-real-oauth.test.ts. The test must:
       - boot createServer({ authStub: false }) with GITHUB_CLIENT_ID +
         GITHUB_CLIENT_SECRET set to fixture values
       - install an undici MockAgent that intercepts
           POST https://github.com/login/oauth/access_token
           GET  https://api.github.com/user
       - drive the full /v1/auth/github/start → /callback flow
       - assert the workspace is created and a session cookie is set
     Commit: red(auth): real GitHub OAuth flow

  2. GREEN: in src/http/signup-routes.ts (or extracted application module),
     branch on options.authStub. When false, perform the token exchange and
     user-profile fetch using fetch() / undici. Read GITHUB_CLIENT_ID and
     GITHUB_CLIENT_SECRET from process.env at server-boot time and pass
     them as ServerOptions.
     Commit: green(auth): exchange code for token without stub
EOF
  exit 0
fi
if [ ! -f tests/e2e/UC-001-real-oauth.test.ts ] \
    || ! npx --no-install vitest run tests/e2e/UC-001-real-oauth.test.ts >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Fix the real-OAuth test (gate 2.B1).

  GITHUB_CLIENT_ID is now read in src/, but the test is missing or red.
  See tests/e2e/UC-001-real-oauth.test.ts (or create it) — failure is
  usually one of:
    - undici MockAgent not intercepting the token endpoint
    - signup-routes.ts still keying on VSPEC_AUTH_STUB instead of options
    - session cookie not set on callback
EOF
  exit 0
fi

# ─── B2: DB config consistency ───────────────────────────────────────────
if ! bash "$ROOT/scripts/check-db-consistency.sh" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Align DB configuration (gate 2.B2).

  Bring these four files to agreement on DATABASE_URL shape:
    - prisma/schema.prisma         (datasource provider)
    - .env.example                  (DATABASE_URL example)
    - package.json                  (start / prestart scripts)
    - docker-compose.yml + docker-compose.prod.yml

  Rule of thumb:
    - Production / dogfood:  Postgres   (postgresql://…)
    - Tests / local dev:     SQLite     (file:.state/…sqlite)

  Either:
    a) Switch the schema to env("DATABASE_PROVIDER") and document the
       split in docs/02-tech-stack.md, OR
    b) Make .env.example point at SQLite and document Postgres as a
       prod-only override.

  Then run: bash scripts/check-db-consistency.sh
EOF
  exit 0
fi

# ─── B3: Docker deploy ───────────────────────────────────────────────────
if ! bash "$ROOT/scripts/check-deployable.sh" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make vspec deployable via Docker (gate 2.B3).

  - Add Dockerfile (multi-stage: deps → build → runtime, node:20-alpine).
    Final stage runs `node dist/src/index.js` and exposes 3000.
  - Add docker-compose.prod.yml with:
      app:    builds the Dockerfile, depends_on db, exposes ${VSPEC_DEPLOY_HOST_PORT:-4400}:3000
      db:     postgres:16-alpine with a healthcheck
    Pass DATABASE_URL via environment in the app service.
  - Verify:
        bash scripts/check-deployable.sh
EOF
  exit 0
fi

# ─── B4: README user-facing sections ─────────────────────────────────────
if ! grep -qE '^## Install\b' README.md \
    || ! grep -qE '^## Run\b' README.md \
    || ! grep -qE '^## Deploy\b' README.md; then
  cat <<'EOF'
TASK: Rewrite README.md for end users (gate 2.B4).

  1. Move the current "autonomous-build harness" content from README.md
     into docs/build-harness.md (keep the loop instructions intact).
  2. Replace README.md with a user-facing layout:
        # vspec
        <one-paragraph description>
        ## Install            # npm install -g vspec  (or  npx vspec --help)
        ## Run                # local dev: docker compose up -d db && npm run dev
        ## Deploy             # docker compose -f docker-compose.prod.yml up -d
        ## Documentation      # links to docs/ and to docs/build-harness.md
  3. Each section's commands must work on a clean clone — no implicit env
     setup.
EOF
  exit 0
fi

# ─── C1: routes too fat ──────────────────────────────────────────────────
OVER=$(find src/http -name '*-routes.ts' -type f -exec wc -l {} \; 2>/dev/null \
  | awk '$1>150 {print $2" ("$1" lines)"}' | head -1)
if [ -n "$OVER" ]; then
  cat <<EOF
TASK: Slim down a fat route file (gate 2.C1).

  Candidate: ${OVER}

  1. Identify the route's business logic vs. parsing/validation.
  2. Extract logic into src/application/<area>.ts as pure functions taking
     port interfaces (no Fastify import).
  3. Add tests/unit/application/<area>.test.ts that exercises those
     functions directly.
  4. The remaining route file should only:
        - parse + validate the request (zod)
        - call the application function
        - serialize + send the response
     (Validation problems and HTTP-shaped errors stay in src/http.)
  Commit:
     refactor(layers): extract <area> from <route>
EOF
  exit 0
fi

# ─── C2: application module count ────────────────────────────────────────
APP_COUNT=$(find src/application -name '*.ts' -type f | wc -l | tr -d ' ')
if [ "$APP_COUNT" -lt 18 ]; then
  cat <<EOF
TASK: Extract more business logic into src/application/ (gate 2.C2).

  Current modules: $APP_COUNT / 18 minimum.
  Pick the next route still owning logic (even if under 150 lines) and
  move its application-layer functions out. Aim for one module per
  Prisma model area.
EOF
  exit 0
fi

# ─── C3: application unit tests ──────────────────────────────────────────
UNIT_COUNT=$(find tests/unit/application -name '*.test.ts' 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNIT_COUNT" -lt 18 ]; then
  cat <<EOF
TASK: Add application unit tests (gate 2.C3).

  Current: $UNIT_COUNT / 18 minimum.

  For each src/application/*.ts, add tests/unit/application/<name>.test.ts.
  Each unit test exercises the function with in-memory port fakes — no
  createServer(), no Fastify, no HTTP.
EOF
  exit 0
fi

# ─── C4: stricter boundaries ─────────────────────────────────────────────
if ! grep -qE 'from:\s*"http"[^}]*disallow[^}]*"domain"' eslint.config.js \
    || ! grep -qE 'from:\s*"cli"[^}]*disallow[^}]*"infrastructure"' eslint.config.js; then
  cat <<'EOF'
TASK: Tighten boundaries rules (gate 2.C4).

  In eslint.config.js, extend the boundaries/element-types rules array
  with:
      { from: "http", disallow: ["domain"] }
      { from: "cli",  disallow: ["infrastructure"] }

  Then:
      npx eslint .
  resolve violations by routing through src/application/ (for http) and
  through HTTP/CLI ports (for cli).
EOF
  exit 0
fi

# ─── D: meta ─────────────────────────────────────────────────────────────
if ! bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/2-shippable.md" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Strengthen gate rigor (gate 2.D3).

  scripts/check-gate-rigor.sh flagged goal 2 as making "every X" claims
  while its gates.sh has no iteration. Either:
    a) Rewrite the affected gate to enumerate from a source of truth
       (prisma/schema.prisma, docs/usecases/, the filesystem), or
    b) Tighten the goal text so it no longer claims universality.
  Do not silence the check by removing "every" verbiage that the gates
  actually need.
EOF
  exit 0
fi

cat <<'EOF'
TASK: All sub-gates of goal 2 appear to pass locally. Run:

    bash scripts/completion-check.sh

  to confirm globally. If green, either start goals/3-*.md or stop.
EOF
