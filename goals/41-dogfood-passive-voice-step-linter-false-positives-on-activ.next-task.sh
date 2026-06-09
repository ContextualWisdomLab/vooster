#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="41-dogfood-passive-voice-step-linter-false-positives-on-activ"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 41 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-001 passive-voice finding.
MSG
  exit 0
fi

DEF_COUNT=$(grep -rln 'function usesPassiveVoice' apps/api/src | sort -u | wc -l | tr -d ' ')

if [ "$DEF_COUNT" != "1" ]; then
  cat <<'MSG'
TASK: Consolidate the passive-voice detector into one shared module.
  - There are duplicate usesPassiveVoice definitions across
    scenario-authoring, step-editing, and the HTTP support layer.
  - Move it to a single shared module under apps/api/src and have every
    other path import it instead of keeping a private copy.
  - Keep behavior unchanged in this refactor step; the regex fix comes next.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Scope passive-voice detection to the step's main predicate.
  - Write a failing unit test first: the active step
    "validates the amount is positive and a category is selected"
    must be classified as NOT passive, while "Order is submitted."
    stays flagged. Add the assertion at the scenario-authoring,
    step-editing, and HTTP validation entry points.
  - Then change the heuristic so it judges the main predicate rather than
    any trailing "be + participle" subordinate clause. Decide the wording
    and approach; do not just special-case the example sentence.
  - Re-run the Goal 41 gate and completion-check.
MSG
