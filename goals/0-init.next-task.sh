#!/usr/bin/env bash
# goals/0-init.next-task.sh — Task hints for goal 0 (MVP via TDD).
# Priority:
#   1. Bootstrap scaffolding (package.json → tsconfig → vitest → prisma schema)
#   2. Continue an in-progress UC (test file exists but failing)
#   3. Start the next not-yet-started UC in priority order
#   4. All UCs covered → run the goal-0 gates

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# --- 1. Bootstrap checks ---

if [ ! -f package.json ]; then
  cat <<'EOF'
TASK: Initialize project scaffolding.
  - npm init -y
  - Install dev deps: typescript tsx vitest @types/node prisma @prisma/client
  - Install runtime deps: fastify zod pino @oclif/core gray-matter
  - Read: docs/02-tech-stack.md (do not deviate)
  - Commit: "setup: initial scaffolding"
EOF
  exit 0
fi

if [ ! -f tsconfig.json ]; then
  cat <<'EOF'
TASK: Configure TypeScript.
  - Create tsconfig.json (strict, ES2022, NodeNext modules)
  - Create src/index.ts placeholder
  - Commit: "setup: typescript config"
EOF
  exit 0
fi

if [ ! -f vitest.config.ts ]; then
  cat <<'EOF'
TASK: Configure Vitest.
  - Create vitest.config.ts (coverage via c8, threshold from docs/04-tdd-protocol.md)
  - Create tests/setup.ts
  - Write a smoke test: tests/unit/smoke.test.ts that asserts 1+1 === 2
  - Verify: npx vitest run
  - Commit: "setup: vitest"
EOF
  exit 0
fi

if [ ! -f prisma/schema.prisma ]; then
  cat <<'EOF'
TASK: Initialize Prisma schema.
  - npx prisma init
  - Translate docs/05-data-model.md to prisma/schema.prisma (all 16 entities)
  - docker compose up -d db (or local Postgres)
  - npx prisma migrate dev --name initial
  - Commit: "setup: prisma initial schema"
EOF
  exit 0
fi

# --- 2. Continue in-progress UC ---

for f in $(ls docs/usecases/UC-*.md 2>/dev/null | sort); do
  UC_ID=$(basename "$f" | grep -oE "UC-[0-9]+" | head -1)
  TEST_FILE="tests/e2e/${UC_ID}.test.ts"
  if [ -f "$TEST_FILE" ]; then
    if ! npx --no-install vitest run "$TEST_FILE" --reporter=dot >/dev/null 2>&1; then
      cat <<EOF
TASK: Continue $UC_ID.
  - Read: $f
  - Test file: $TEST_FILE (currently failing)
  - Follow TDD: identify the first failing assertion, write minimum code to pass.
  - Verify: npx vitest run $TEST_FILE
  - Commit: "green: $UC_ID <description>"
EOF
      exit 0
    fi
  fi
done

# --- 3. Start the next not-yet-started UC, in priority order ---

PRIORITY_ORDER=(
  # Foundation
  UC-001 UC-002 UC-004
  # Domain setup
  UC-005 UC-006 UC-007
  # Use case authoring core
  UC-008 UC-009 UC-010 UC-011 UC-012 UC-013
  # Sessions
  UC-016 UC-017 UC-018
  # Branches & merges
  UC-019 UC-020 UC-021
  # Locks
  UC-022 UC-023
  # Versioning, impact
  UC-024 UC-025 UC-026 UC-027
  # Sync, export
  UC-029 UC-030
  # AI agent
  UC-033 UC-034 UC-035
  # Admin and the rest
  UC-014 UC-015 UC-028 UC-003 UC-031 UC-032
)

for UC_ID in "${PRIORITY_ORDER[@]}"; do
  TEST_FILE="tests/e2e/${UC_ID}.test.ts"
  if [ ! -f "$TEST_FILE" ]; then
    SPEC_FILE=$(ls docs/usecases/${UC_ID}-*.md 2>/dev/null | head -1)
    if [ -z "$SPEC_FILE" ]; then
      continue
    fi
    cat <<EOF
TASK: Start $UC_ID.
  - Read: $SPEC_FILE
  - Plan tests in docs/state/test-plan.md (one per main + one per extension)
  - Create $TEST_FILE with the first failing test (RED phase)
  - Commit: "red: $UC_ID <first scenario name>"
EOF
    exit 0
  fi
done

# --- 4. All UCs covered ---

cat <<'EOF'
TASK: All UCs have test files. Verify goal-0 gates.
  - bash goals/0-init.gates.sh
  - If it fails, address the listed gates one by one.
  - If it passes, goal 0 is done — proceed to goal 1.
EOF
