#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="52-dogfood-usecase-create-title-validator-title-not-verb-phra"
GATE="goals/$GOAL_NAME.gates.sh"
GUIDE="apps/api/src/application/ai-guide.ts"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 52 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-004 usecase-create title-validator finding.
MSG
  exit 0
fi

# Advisory proxy 1: the guide still teaches the --force workaround.
if grep -qE 'usecase create.*--force' "$GUIDE" 2>/dev/null; then
  cat <<'MSG'
TASK: Stop the AI guide from teaching the --force workaround (test first).
  - The shipped guide (apps/api/src/application/ai-guide.ts) has a `vspec usecase
    create ... --force` worked example. A self-teaching example must demonstrate
    a title that the validator accepts, not one that has to be forced.
  - Decide a clean verb-phrase title for the example create command and update
    both the JSON examples[].commands list and the guideMarkdown() body, dropping
    --force from those create calls. (--force stays a real escape hatch; it just
    must not be the canonical example.)
  - Re-run the Goal 52 gate (gate 52.B1 enumerates the example titles and runs
    the real validator; 52.B2 forbids --force on any guide create example).
MSG
  exit 0
fi

# Advisory proxy 2: the envelope behavior suite is not yet locking self-teaching.
if ! pnpm exec vitest run apps/api/tests/unit/http/usecase-results.test.ts >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Make the TITLE_NOT_VERB_PHRASE rejection self-teaching (test first).
  - Write failing unit tests in apps/api/tests/unit/http/usecase-results.test.ts
    over sendUseCaseAuthoringResult for a rejected title:
      * the response surfaces at least one concrete rewrite suggestion that
        titleLooksLikeVerbPhrase itself accepts;
      * the response includes a `vspec usecase create --force` next-action whose
        reason is non-empty.
  - Then adjust sendUseCaseAuthoringResult in
    apps/api/src/http/usecase-results.ts so the envelope teaches the fix. Decide
    the wording yourself; do not special-case one example title.
  - Re-run the Goal 52 gate and completion-check.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Goal 52 gate is red but the obvious proxies pass.
  - Run `bash goals/52-dogfood-usecase-create-title-validator-title-not-verb-phra.gates.sh`
    and read the failing sub-gate (typecheck, suite, 52.B1 enumeration, or rigor).
  - Address only the reported failure; keep titles validator-clean and the
    envelope self-teaching.
MSG
