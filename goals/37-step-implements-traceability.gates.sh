#!/usr/bin/env bash
# goals/37-step-implements-traceability.gates.sh -- step implementation links.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="37-step-implements-traceability"
GATE_INPUTS=(
  packages/contracts/src/scenario.ts
  packages/contracts/src/usecase.ts
  packages/contracts/tests/scenario.test.ts
  apps/api/prisma/schema.prisma
  apps/api/src/domain/entities/step.ts
  apps/api/src/infrastructure/prisma-signup-mappers.ts
  apps/api/src/application/markdown-invocations.ts
  apps/api/src/application/markdown-renderer.ts
  apps/api/src/application/doctor.ts
  apps/api/src/application/scenario-authoring.ts
  apps/api/src/application/step-editing.ts
  apps/api/src/application/usecase-agent-data.ts
  apps/api/src/application/usecase-agent-types.ts
  apps/api/src/http/step-routes.ts
  apps/api/tests/unit/http/sync-markdown.test.ts
  apps/api/tests/unit/application/markdown-export.test.ts
  apps/api/tests/unit/application/doctor.test.ts
  apps/api/tests/unit/prisma-signup-mappers.test.ts
  apps/cli/src/commands/step.ts
  apps/cli/tests/unit/step-agent-format.test.ts
  goals/37-step-implements-traceability.md
  goals/37-step-implements-traceability.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[37.A1] contracts package builds for step schemas"
if pnpm --filter @vooster/contracts build; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[37.A2] API typecheck covers stored step contract"
if pnpm --filter @vooster/api typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[37.A3] traceability behavior tests pass"
if pnpm exec vitest run \
  packages/contracts/tests/scenario.test.ts \
  apps/api/tests/unit/http/sync-markdown.test.ts \
  apps/api/tests/unit/application/markdown-export.test.ts \
  apps/api/tests/unit/application/doctor.test.ts \
  apps/api/tests/unit/prisma-signup-mappers.test.ts \
  apps/cli/tests/unit/step-agent-format.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[37.B1] step persistence has implementation link field"
if rg -q 'implements\s+String\[\]\s+@default\(\[\]\)' apps/api/prisma/schema.prisma; then
  echo "    pass"
else
  echo "    fail -- Prisma Step.implements field missing"
  PASS=false
fi

echo "[37.C1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/37-step-implements-traceability.md" >/dev/null 2>&1; then
  echo "    pass"
else
  echo "    fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/37-step-implements-traceability.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
