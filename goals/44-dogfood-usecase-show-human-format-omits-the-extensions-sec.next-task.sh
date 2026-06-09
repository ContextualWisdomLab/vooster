#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="44-dogfood-usecase-show-human-format-omits-the-extensions-sec"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 44 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-006 usecase-show extensions finding.
MSG
  exit 0
fi

if [ ! -f apps/cli/tests/unit/usecase-show-extensions.test.ts ]; then
  cat <<'MSG'
TASK: Write the failing test first -- human `usecase show` must render extensions at parity.
  - Today printUsecaseShow in apps/cli/src/commands/usecase-output.ts gates the
    Extensions section behind `extensions.some((s) => s.steps.length > 0)` and
    never renders `outcome`. So a condition-only extension (extension point +
    condition + outcome, no steps -- e.g. "2a. Title is empty -> FAILURE") is
    dropped entirely, and outcomes never appear. The agent/json formats and the
    markdown export carry this data; only the human view drops it.
  - Create apps/cli/tests/unit/usecase-show-extensions.test.ts. Drive
    printUsecaseShow with a fixture carrying MORE THAN ONE extension:
      * one condition-only EXTENSION (extension_point + condition + an `outcome`
        of FAILURE, steps: []), and
      * one EXTENSION with recovery steps.
    Assert the human output (a) emits the "Extensions" section even though the
    condition-only extension has no steps, (b) for EACH extension shows its
    extension point + condition + outcome, and (c) still renders the steps of the
    stepped extension. This test must FAIL against the current renderer.
  - Do NOT touch the json/agent paths -- they already serialize the scenarios.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Make printUsecaseShow render extensions at full parity, then verify.
  - Edit printUsecaseShow in apps/cli/src/commands/usecase-output.ts:
      * render the "Extensions" section whenever there is >= 1 EXTENSION scenario
        (drop the `steps.length > 0` gate),
      * for each extension render its extension point + condition + outcome
        (outcome is one of FAILURE / PARTIAL / SUCCESS -- see
        packages/contracts/src/scenario.ts; render it only when present),
      * keep rendering recovery steps when present (no regression).
    The scenario show schema is a looseObject, so `outcome` already flows through
    the parsed body -- surface it in the typed shape if the typecheck needs it.
  - Keep apps/cli/tests/unit/usecase-output.test.ts green (its extension has no
    outcome, so no outcome line should appear for it).
  - Re-run:
      pnpm --filter @vooster/cli typecheck
      pnpm exec vitest run apps/cli/tests/unit/usecase-show-extensions.test.ts apps/cli/tests/unit/usecase-output.test.ts
      bash goals/44-dogfood-usecase-show-human-format-omits-the-extensions-sec.gates.sh
MSG
