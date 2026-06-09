#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="45-dogfood-passive-voice-step-linter-false-positives-on-activ"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 45 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-001 passive-voice (1910) finding.
MSG
  exit 0
fi

if [ ! -f apps/api/tests/unit/application/passive-voice.test.ts ]; then
  cat <<'MSG'
TASK: Lock the passive-voice invariants with a unit test (write it first, RED).
  - Create apps/api/tests/unit/application/passive-voice.test.ts importing
    usesPassiveVoice from apps/api/src/application/passive-voice.ts.
  - Korean exemption: a Hangul step action such as
    "사용자가 금액을 입력하고 카테고리를 선택한다" must be classified NOT passive.
  - No over-correction: "Order is submitted." must stay classified passive.
  - Also assert the recommended example
    "validates the amount is positive and the category is selected" is NOT passive.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Make vspec's linter self-consistent with the wording it recommends.
  - The gate enumerates every --action "<text>" example from
    apps/api/src/application/ai-guide.ts and apps/cli/src/cli-help.ts and runs
    the real usesPassiveVoice over each; some are still flagged passive.
  - Fix the heuristic in apps/api/src/application/passive-voice.ts so a copular
    clause ("is positive", "is selected") inside an active actor-led step does
    not trigger, while a genuinely passive main predicate ("Order is submitted.")
    still does. Keep Hangul actions exempt from the English-only rule.
  - Decide the wording/approach; do not special-case the example sentences.
  - Re-run the Goal 45 gate and completion-check.
MSG
