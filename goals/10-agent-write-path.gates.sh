#!/usr/bin/env bash
# goals/10-agent-write-path.gates.sh — Gate suite for goal 10 (agent
# envelope write-path proof).

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="10-agent-write-path"

GATE_INPUTS=(
  apps/cli/src/agent-envelope.ts
  apps/cli/src/commands/actor.ts
  apps/cli/src/commands/goal.ts
  apps/cli/src/commands/stakeholder.ts
  apps/cli/src/commands/usecase.ts
  apps/cli/src/application/mutation-command.ts
  apps/cli/tests/unit/agent-format-write-path.test.ts
  apps/cli/tests/e2e-cli-honest/agent-format-write-path.test.ts
  docs/findings/2026-05-21T1856-cli-spec-gaps.md
  scripts/check-gate-rigor.sh
  goals/10-agent-write-path.gates.sh
  goals/10-agent-write-path.next-task.sh
  goals/10-agent-write-path.md
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

FINDINGS=docs/findings/2026-05-21T1856-cli-spec-gaps.md
UNIT_TEST=apps/cli/tests/unit/agent-format-write-path.test.ts
HONEST_TEST=apps/cli/tests/e2e-cli-honest/agent-format-write-path.test.ts

BACKLOG_VERBS=(
  "goal create"
  "goal list"
  "goal promote"
  "actor create"
  "stakeholder create"
)

echo "[10.A1 stale write-path agent debt removed from findings]"
A1_OFFENDERS=()
MISSING_SECTION=$(awk '
  /^## `--format=agent` coverage debt/ { capture=1; next }
  capture && /^## / { capture=0 }
  capture && /^-/ { print }
' "$FINDINGS")
for verb in "${BACKLOG_VERBS[@]}"; do
  if printf '%s\n' "$MISSING_SECTION" | grep -F -- "$verb" >/dev/null 2>&1; then
    A1_OFFENDERS+=("$verb")
  fi
done
if [ "${#A1_OFFENDERS[@]}" -eq 0 ]; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — stale agent debt remains in $FINDINGS:"
  printf '        %s\n' "${A1_OFFENDERS[@]}"
  PASS=false
fi

echo "[10.C1 unit tests prove each core agent verb envelope]"
if pnpm exec vitest run "$UNIT_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: pnpm exec vitest run $UNIT_TEST"
  PASS=false
fi

echo "[10.D1 honest E2E proves each core agent verb envelope]"
if pnpm exec vitest run "$HONEST_TEST"; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: pnpm exec vitest run $HONEST_TEST"
  PASS=false
fi

echo "[10.E1 Gate rigor]"
if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/10-agent-write-path.md" >/dev/null 2>&1; then
  echo "    ✓ pass"
else
  echo "    ✗ fail — re-run: bash scripts/check-gate-rigor.sh goals/10-agent-write-path.md"
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
fi

exit 1
