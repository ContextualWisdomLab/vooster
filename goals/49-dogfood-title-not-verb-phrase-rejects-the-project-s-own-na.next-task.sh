#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="49-dogfood-title-not-verb-phrase-rejects-the-project-s-own-na"
GATE="goals/$GOAL_NAME.gates.sh"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 49 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-002 title-not-verb-phrase finding.
MSG
  exit 0
fi

# Advisory proxy: is the suggestion generator still blindly prefixing a verb?
if grep -qE '`Reviews ' apps/api/src/application/usecases.ts 2>/dev/null; then
  cat <<'MSG'
TASK: Fix the suggestedTitles generator (test first).
  - Write a failing unit test in
    apps/api/tests/unit/application/usecases.test.ts: rejecting a title must
    NOT yield "Reviews <the whole sentence>". Any suggestion returned must
    itself pass titleLooksLikeVerbPhrase; if no genuine rewrite is possible,
    return an empty list.
  - Then change suggestedTitles in apps/api/src/application/usecases.ts so it
    stops prepending a hardcoded verb to the rejected sentence. Decide the
    real rewrite (or drop the suggestion); do not special-case one example.
  - Re-run the Goal 49 gate.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Loosen the verb-phrase heuristic to accept finite-verb titles.
  - Write failing unit tests first in
    apps/api/tests/unit/application/verb-phrases.test.ts and the authorUseCase
    path in apps/api/tests/unit/application/usecases.test.ts:
      * "User exports their expenses to CSV" and "User logs a new expense"
        are accepted (subject-first, contain a finite verb).
      * "Order status" / "Expense report" (no finite verb) are still rejected.
  - Then change titleLooksLikeVerbPhrase in
    apps/api/src/application/verb-phrases.ts so it recognizes a finite verb
    anywhere appropriate in the title rather than matching only a tiny
    hardcoded first-word allowlist. The fix must make every title under
    docs/usecases/ pass (gate 49.B1 enumerates them).
  - Decide the heuristic's shape yourself; keep it from over-accepting noun
    phrases. Re-run the Goal 49 gate and completion-check.
MSG
