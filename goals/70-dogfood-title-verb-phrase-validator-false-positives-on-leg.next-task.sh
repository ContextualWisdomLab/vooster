#!/usr/bin/env bash

set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GOAL_NAME="70-dogfood-title-verb-phrase-validator-false-positives-on-leg"
GATE="goals/$GOAL_NAME.gates.sh"
CORPUS="apps/api/tests/fixtures/legitimate-verb-phrase-titles.txt"

if bash "$ROOT/$GATE" >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Goal 70 is green.
  - Run bash scripts/completion-check.sh.
  - Mark resolved: true in the DF-004 verb-phrase false-positive finding.
MSG
  exit 0
fi

# Advisory proxy 1: the regression corpus does not yet exist.
if [ ! -f "$CORPUS" ]; then
  cat <<MSG
TASK: Establish the legitimate-verb regression corpus (source of truth).
  - Create $CORPUS, one use-case title per line (# comments and blank lines
    are ignored by the gate).
  - It MUST include the dogfood anchor line exactly:
      Partner accepts a shared-budget invitation
    plus a representative spread (>= 6 total) of common finite verbs the old
    closed VERB_PHRASE_STARTS set omitted (decide which verbs yourself from
    real product usage; do not just transcribe the existing whitelist).
  - The Goal 70 gate (70.B1) loops the real validator over every line, so the
    corpus will fail until the validator stops false-positiving on them.
MSG
  exit 0
fi

# Advisory proxy 2: the validator still rejects legitimate corpus titles.
REJECTED="$(pnpm --filter @vooster/api exec tsx -e '
import { titleLooksLikeVerbPhrase } from "./src/application/verb-phrases.ts";
import { readFileSync } from "node:fs";
const titles = readFileSync(process.argv[1], "utf8")
  .split("\n")
  .map((s) => s.replace(/\s+$/, ""))
  .filter((s) => s && !/^\s*#/.test(s))
  .map((s) => s.trim());
for (const t of titles) {
  if (!titleLooksLikeVerbPhrase(t)) console.log(t);
}
' "$CORPUS" 2>/dev/null)"
if [ -n "$REJECTED" ]; then
  cat <<MSG
TASK: Stop the verb-phrase validator from false-positiving on legitimate verbs (test first).
  - These corpus titles are legitimate verb phrases but the validator rejects them:
$(printf '%s\n' "$REJECTED" | sed 's/^/      /')
  - First add failing cases in
    apps/api/tests/unit/application/verb-phrases.test.ts asserting these titles
    are accepted (and keep prior valid titles passing + obvious non-verb-phrases
    rejected).
  - Then fix apps/api/src/application/verb-phrases.ts. Prefer a more permissive
    heuristic over hand-extending the closed whitelist; whatever you choose, do
    not special-case the literal anchor title.
  - Re-run the Goal 70 gate.
MSG
  exit 0
fi

# Advisory proxy 3: the rejection envelope does not name the offending word.
if ! pnpm exec vitest run apps/api/tests/unit/http/usecase-results.test.ts >/dev/null 2>&1; then
  cat <<'MSG'
TASK: Make the TITLE_NOT_VERB_PHRASE rejection name the offending word (test first).
  - Add a failing unit test in apps/api/tests/unit/http/usecase-results.test.ts:
    for a genuinely rejected title, the response surfaces the specific word the
    validator could not read as a verb (not only a generic message).
  - Then update the rejection envelope in apps/api/src/http/usecase-results.ts.
    Decide the wording yourself; this is additive to goal 52's self-teaching
    envelope, so keep its suggestion + --force next-action intact.
  - Re-run the Goal 70 gate and completion-check.
MSG
  exit 0
fi

cat <<'MSG'
TASK: Goal 70 gate is red but the obvious proxies pass.
  - Run `bash goals/70-dogfood-title-verb-phrase-validator-false-positives-on-leg.gates.sh`
    and read the failing sub-gate (typecheck, suite, 70.B1 corpus enumeration,
    or rigor).
  - Address only the reported failure; keep the validator permissive for
    legitimate verbs and the rejection self-teaching.
MSG
