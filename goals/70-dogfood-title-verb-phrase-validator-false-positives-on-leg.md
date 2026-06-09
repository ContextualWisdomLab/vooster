# Goal 70 -- The verb-phrase validator must not reject legitimate verbs, and a rejection must name the offending word

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

`apps/api/src/application/verb-phrases.ts` gates use-case titles through a
**closed, hand-curated English verb whitelist** (`VERB_PHRASE_STARTS`). The set
happens to contain `approve` and `archive` but not `accept`, so the genuine verb
phrase `Partner accepts a shared-budget invitation` is rejected with
`TITLE_NOT_VERB_PHRASE` even though it is a perfectly well-formed verb phrase.

A closed whitelist of English verbs is a correctness liability: it silently
degrades valid specs, it is impossible to keep complete, and it cuts against the
language-aware / Korean-first design principle. The dogfood agent could not
recover from the rejection on its own — the message ("Use case title should be a
verb phrase") never named *which* word it disliked, so the agent built the wrong
mental model ("the validator only accepts a leading subject like `User`") and
fell back to `--force`.

Two things must become true:

1. The validator must stop false-positiving on legitimate finite verbs. Whether
   the fix is a more permissive heuristic or a meaningfully broadened verb set,
   the dogfood-discovered title and a representative spread of common finite
   verbs the old closed set omitted must all be accepted.
2. When a title *is* genuinely rejected, the `TITLE_NOT_VERB_PHRASE` response
   must name the offending word so an agent can reason about the fix rather than
   guess. `--force` stays a real escape hatch; it must not be the only way past a
   legitimate verb phrase.

## Why This Goal Exists

This resolves the DF-004 facet recorded in the dogfood loop: `vspec usecase
create --title "Partner accepts a shared-budget invitation"` returned
`{"code":"TITLE_NOT_VERB_PHRASE","message":"Use case title should be a verb
phrase"}`, forcing the agent to retry with `--force` under a misleading mental
model that the validator only accepts a leading subject like `User`.

Goal 49 loosened the heuristic to accept subject-first finite-verb titles **but
only when the finite verb already lives in `VERB_PHRASE_STARTS`** — so a
subject-first title whose verb is outside the curated set (`accepts`) still
fails. Goal 52 made the rejection envelope self-teaching (a concrete rewrite
suggestion plus a `--force` next-action with a reason). This goal closes the
remaining gap: the underlying verb set is still closed and incomplete, and the
rejection still does not name the offending word. This is additive to goals 49
and 52 — it does not weaken either prior gate.

## Completion Conditions

1. **Every title in the legitimate-verb regression corpus is accepted by
   `titleLooksLikeVerbPhrase`.** The corpus is a source-of-truth fixture,
   `apps/api/tests/fixtures/legitimate-verb-phrase-titles.txt` (one title per
   line; `#` comment and blank lines ignored). This is a universal claim: the
   gate enumerates every non-comment line from that file and loops the *real*
   validator over each one — no single-case cheat. The corpus must encode the
   dogfood regression anchor (`Partner accepts a shared-budget invitation`) and a
   representative spread of common finite verbs the prior closed set omitted, so
   the gate fails until the validator genuinely stops false-positiving on
   legitimate verbs. Future dogfood findings of the same shape append a line
   here rather than re-opening the heuristic.
2. **A rejection names the offending word.** When `usecase create` rejects a
   title, the `TITLE_NOT_VERB_PHRASE` response surfaces the specific word it
   could not read as a verb (not only a generic "should be a verb phrase"
   message). Behaviour is locked by unit tests over the authoring/response path
   in `apps/api/tests/unit/http/usecase-results.test.ts`.
3. **The verb-phrase behaviour suite stays green.** Titles that were valid before
   (Korean finite-verb endings, subject-first finite verbs, imperative leads)
   remain accepted, and obvious non-verb-phrases (a bare noun phrase) remain
   rejected. Locked by `apps/api/tests/unit/application/verb-phrases.test.ts`.
4. The API typechecks and the targeted behaviour suites pass.

## Sources Of Truth

- The dogfood finding for DF-004 (title verb-phrase validator false-positives on
  legitimate verbs).
- `apps/api/tests/fixtures/legitimate-verb-phrase-titles.txt` (the regression
  corpus; source of the enumerated titles).
- `apps/api/src/application/verb-phrases.ts` (`titleLooksLikeVerbPhrase`,
  `VERB_PHRASE_STARTS`).
- `apps/api/src/http/usecase-results.ts` (rejection envelope).
- `apps/api/tests/unit/application/verb-phrases.test.ts`
- `apps/api/tests/unit/http/usecase-results.test.ts`

The corpus is enumerated from source by stripping `#` comments and blank lines
from the fixture; the gate loops over every remaining title and asserts the
validator accepts it. The dogfood anchor title must be present so the corpus
genuinely encodes the regression.

## Verification

```
pnpm --filter @vooster/api typecheck
pnpm exec vitest run apps/api/tests/unit/application/verb-phrases.test.ts apps/api/tests/unit/http/usecase-results.test.ts
bash goals/70-dogfood-title-verb-phrase-validator-false-positives-on-leg.gates.sh
bash scripts/completion-check.sh
```
