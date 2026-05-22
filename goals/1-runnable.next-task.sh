#!/usr/bin/env bash
# goals/1-runnable.next-task.sh — Task hints for goal 1 (make vspec runnable).
#
# Walks the agent through the recommended attack order:
#   1. Bootable
#   2. Persistence (route by route, lowest UC first)
#   3. CLI scaffold + per-UC subcommands
#   4. CLI E2E coverage
#   5. Layer extraction
# At each step, only the first failing concern is reported so the agent
# stays focused.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ---------- 1. Bootable ----------
if ! bash "$ROOT/scripts/check-bootable.sh" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Make vspec bootable (gate 1.1).
  - Read: goals/1-runnable.md §1.
  - Write a real apps/api/src/index.ts that imports createServer from
    apps/api/src/http/server.ts and calls app.listen({ port, host: '0.0.0.0' }).
  - Add a "start" script to apps/api/package.json: "start": "node dist/index.js".
  - Add a /healthz route returning { status: "ok" } (in apps/api/src/http/server.ts).
  - Verify: bash scripts/check-bootable.sh
  - Commit: "green(boot): boot fastify on $PORT with /healthz"
EOF
  exit 0
fi

# ---------- 2. Persistence ----------
if ! bash "$ROOT/scripts/check-persistence.sh" >/dev/null 2>&1; then
  # Find the first apps/api/src/http/*.ts that still uses in-memory state.
  CANDIDATE=$(grep -lE '(new (Map|Set)\(|Record<[A-Za-z]+,)' apps/api/src/http/*.ts 2>/dev/null \
    | grep -v -- '-routes.ts$\|server.ts\|signup-types.ts' \
    | head -1)
  if [ -z "$CANDIDATE" ]; then
    CANDIDATE=$(grep -lE 'new (Map|Set)\(' apps/api/src/http/*.ts 2>/dev/null | head -1)
  fi
  cat <<EOF
TASK: Migrate one route to Prisma persistence (gate 1.2).
  - Read: goals/1-runnable.md §2, docs/05-data-model.md.
  - Pick the lowest-UC entity that still uses in-memory state. Candidate:
      ${CANDIDATE:-(none detected — search apps/api/src/http/ for 'new Map(')}
  - Write a failing integration test in
      apps/api/tests/integration/<entity>-persists.test.ts
    that boots createServer twice against the same SQLite file and asserts
    state survives between boots.
  - Ensure apps/api/prisma/schema.prisma has the entity; if not, add it.
    Run: cd apps/api && npx prisma migrate dev --name add-<entity>.
  - Replace the in-memory store with a Prisma-backed port in
    apps/api/src/infrastructure/<entity>-repo.ts, exposed via a port interface in
    apps/api/src/ports/<entity>-repo.ts, consumed by
    apps/api/src/application/<entity>-service.ts.
  - Delete the in-memory Map in the same commit. Do not keep both.
  - Verify: pnpm exec vitest run apps/api/tests/integration/<entity>-persists.test.ts
  - Verify goal-0 still green: bash goals/0-init.gates.sh
  - Commit: "green(persist): <entity> backed by prisma"
EOF
  exit 0
fi

# ---------- 3. CLI binary ----------
if ! bash "$ROOT/scripts/check-cli.sh" >/dev/null 2>&1; then
  if [ ! -f apps/cli/bin/run.js ]; then
    cat <<'EOF'
TASK: Scaffold the vspec CLI binary (gate 1.3).
  - Read: goals/1-runnable.md §3, docs/07-cli-spec.md.
  - Create apps/cli/bin/run.js (oclif entrypoint, calls @oclif/core run()).
  - Add to apps/cli/package.json: "bin": { "vspec": "./bin/run.js" }.
  - Create apps/cli/src/index.ts root command (just shows --help and version).
  - Verify: node apps/cli/bin/run.js --help
  - Commit: "setup(cli): oclif scaffold"
EOF
    exit 0
  fi
  # Bin exists but some advertised command is missing.
  MISSING=$(bash "$ROOT/scripts/check-cli.sh" 2>&1 | grep -E '^\s+- vspec' | head -1 | sed 's/^[[:space:]]*-\s*//')
  cat <<EOF
TASK: Add the next missing CLI subcommand (gate 1.3).
  - Missing: ${MISSING:-(see check-cli output)}
  - Read: docs/07-cli-spec.md for the contract.
  - Add an oclif Command class under apps/cli/src/commands/<topic>.ts
    (oclif loads subcommands from the topic file).
  - It must call the API (use undici / built-in fetch) and render the result.
  - Add a CLI E2E test in apps/cli/tests/e2e-cli/<UC-ID>.test.ts that spawns the binary.
  - Verify: bash scripts/check-cli.sh
  - Commit: "green(cli): $MISSING"
EOF
  exit 0
fi

# ---------- 4. CLI E2E ----------
UC_COUNT=$(ls docs/usecases/UC-*.md 2>/dev/null | wc -l | tr -d ' ')
CLI_COUNT=$(find apps/cli/tests/e2e-cli -name 'UC-*.test.ts' 2>/dev/null | wc -l | tr -d ' ')
if [ "$CLI_COUNT" -lt "$UC_COUNT" ]; then
  # First UC without a CLI E2E.
  for f in $(ls docs/usecases/UC-*.md 2>/dev/null | sort); do
    UC_ID=$(basename "$f" | grep -oE 'UC-[0-9]+' | head -1)
    if [ ! -f "apps/cli/tests/e2e-cli/${UC_ID}.test.ts" ]; then
      cat <<EOF
TASK: Add CLI E2E for $UC_ID (gate 1.4).
  - Read: $f
  - Create apps/cli/tests/e2e-cli/${UC_ID}.test.ts that:
      • Starts a fresh Fastify server on a random port (real DB, temp dir).
      • Spawns the CLI as a child process (execa or node:child_process).
      • Asserts the CLI command finishes with exit 0 and prints expected output.
  - Commit: "green(cli): $UC_ID CLI E2E"
EOF
      exit 0
    fi
  done
fi

# ---------- 5. Layer extraction ----------
if ! bash "$ROOT/scripts/check-layers.sh" >/dev/null 2>&1; then
  cat <<'EOF'
TASK: Extract layers (gate 1.5).
  - Read: goals/1-runnable.md §5, AGENTS.md "Repository Layout".
  - Move pure business logic from apps/api/src/http/*-routes.ts into
    apps/api/src/application/.
  - Move shared types into apps/api/src/domain/. Move Prisma adapters into
    apps/api/src/infrastructure/. Define port interfaces in apps/api/src/ports/.
  - Configure eslint-plugin-boundaries in eslint.config.js so:
      http → application (allowed)
      http → infrastructure (forbidden)
      application → infrastructure (forbidden; only via ports)
      domain → anything (forbidden)
  - Run: pnpm exec eslint ., pnpm exec vitest run
  - Verify: bash scripts/check-layers.sh
  - Commit: "refactor(layers): extract <slice>"
EOF
  exit 0
fi

# ---------- All gates pass ----------
cat <<'EOF'
TASK: All goal-1 gates pass. Verify with completion-check.
  - bash scripts/completion-check.sh
  - On exit 0, vspec is runnable end-to-end. Goal 1 complete.
EOF
