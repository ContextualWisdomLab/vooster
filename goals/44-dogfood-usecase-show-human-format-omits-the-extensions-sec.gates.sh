#!/usr/bin/env bash
# goals/44-dogfood-usecase-show-human-format-omits-the-extensions-sec.gates.sh
# `vspec usecase show <id>` (human format) must render the Extensions section at
# parity with --format=agent / json: every EXTENSION scenario's extension point,
# condition, and outcome -- including condition-only extensions with no steps.

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=../scripts/_gate-cache.sh
source "$ROOT/scripts/_gate-cache.sh"

GOAL_NAME="44-dogfood-usecase-show-human-format-omits-the-extensions-sec"
GATE_INPUTS=(
  apps/cli/src
  apps/cli/src/commands/usecase-output.ts
  apps/cli/src/commands/usecase.ts
  apps/cli/src/commands/usecase-flags.ts
  apps/cli/tests/unit/usecase-show-extensions.test.ts
  apps/cli/tests/unit/usecase-output.test.ts
  packages/contracts/src/scenario.ts
  packages/contracts/src/usecase.ts
  docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-006-usecase-show-human-format-omits-the-extensi.md
  goals/44-dogfood-usecase-show-human-format-omits-the-extensions-sec.md
  goals/44-dogfood-usecase-show-human-format-omits-the-extensions-sec.gates.sh
  scripts/check-gate-rigor.sh
  scripts/_gate-cache.sh
)

if gate_cache_hit "$GOAL_NAME" "${GATE_INPUTS[@]}"; then
  echo "[cache hit] goal $GOAL_NAME inputs unchanged"
  exit 0
fi

PASS=true

echo "[44.A1] CLI typecheck (human show renderer + outcome wiring resolves)"
if pnpm --filter @vooster/cli typecheck; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[44.A2] human Extensions parity behavior + existing usecase output suite pass"
# The finding is behavioral: a condition-only extension and every outcome must
# reach the human view. A test proves it exactly (fixtures multiple extensions
# and asserts each point/condition/outcome line) -- so we run the suite rather
# than grepping the renderer body for field names (§1.5). The behavior-lock file
# must EXIST before we trust the run: `vitest run` silently skips a missing path
# and exits 0, which would false-green this goal before the fix is written. So
# the lock file is a hard structure anchor for the behavior gate.
if [ ! -f apps/cli/tests/unit/usecase-show-extensions.test.ts ]; then
  echo "    fail -- behavior lock apps/cli/tests/unit/usecase-show-extensions.test.ts is missing"
  echo "           (write the failing human-Extensions-parity test first -- see next-task.sh)"
  PASS=false
elif pnpm exec vitest run \
  apps/cli/tests/unit/usecase-show-extensions.test.ts \
  apps/cli/tests/unit/usecase-output.test.ts; then
  echo "    pass"
else
  echo "    fail"
  PASS=false
fi

echo "[44.B1] every accepted output format is routed by the show command (none dropped)"
# Format parity is a structural anchor a unit test cannot cleanly reach (the show
# path is network-bound through fetchJson). Enumerate the accepted formats from
# the whitelist source of truth and loop -- each must be routed to a renderer in
# showUsecase, never falling through to an empty default that would drop the
# stored payload (the finding's failure class). (while-read, not mapfile --
# system bash is 3.2 and lacks readarray.)
WHITELIST_LINE=$(grep -n 'includes(format)' apps/cli/src/commands/usecase-flags.ts | head -1)
FORMATS=$(printf '%s\n' "$WHITELIST_LINE" | grep -oE '"[a-z]+"' | tr -d '"' | sort -u)
FORMAT_COUNT=$(printf '%s\n' "$FORMATS" | grep -c .)

if [ "$FORMAT_COUNT" -lt 1 ]; then
  echo "    fail -- could not enumerate the accepted-format whitelist from apps/cli/src/commands/usecase-flags.ts"
  PASS=false
else
  while IFS= read -r fmt; do
    [ -z "$fmt" ] && continue
    if [ "$fmt" = "human" ]; then
      # human is the default branch: showUsecase hands it to the printUsecaseShow renderer.
      if grep -q 'printUsecaseShow' apps/cli/src/commands/usecase.ts; then
        echo "    ok: human -> printUsecaseShow renderer"
      else
        echo "    fail -- human format has no renderer wired in apps/cli/src/commands/usecase.ts"
        PASS=false
      fi
    else
      if grep -Eq "format === \"$fmt\"" apps/cli/src/commands/usecase.ts; then
        echo "    ok: $fmt -> explicit branch in showUsecase"
      else
        echo "    fail -- format '$fmt' is accepted but not routed in apps/cli/src/commands/usecase.ts"
        PASS=false
      fi
    fi
  done < <(printf '%s\n' "$FORMATS")
fi

echo "[44.C1 Gate rigor]"
if bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/$GOAL_NAME.md" >/dev/null 2>&1; then
  echo "    pass"
else
  echo "    fail"
  bash "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/$GOAL_NAME.md" | sed 's/^/      /'
  PASS=false
fi

if [ "$PASS" = true ]; then
  gate_cache_save "$GOAL_NAME" "${GATE_INPUTS[@]}"
  exit 0
else
  exit 1
fi
