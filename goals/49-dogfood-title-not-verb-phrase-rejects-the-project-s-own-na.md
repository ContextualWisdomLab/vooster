# Goal 49 -- Verb-phrase title heuristic must accept finite-verb titles and stop emitting gibberish suggestions

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

The use-case title validator (`titleLooksLikeVerbPhrase`) must accept a title
that contains a finite verb — including the subject-first
`Subject <verb> ...` shape the project itself uses (`User exports their
expenses to CSV`) — instead of rejecting everything whose first word is not on
a tiny hardcoded allowlist. When a title genuinely is rejected, the
`suggestedTitles` generator must offer a real verb-phrase rewrite or no
suggestion at all; it must never produce the nonsensical
`Reviews <the whole rejected sentence>` output.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-002-title-not-verb-phrase-rejects-the-project-s.md`
(case `DF-002`, P1). During the dogfood loop
`vspec usecase create --title "User exports their expenses to CSV"` failed with
`TITLE_NOT_VERB_PHRASE` and `details.suggested_titles =
["Reviews user exports their expenses to CSV"]`. The agent was asked to mirror
the existing `User logs a new expense` use case (identical `User <verb> ...`
shape), had to retry with `--force`, and narrated the contradiction.

Root cause: `titleLooksLikeEnglishVerbPhrase` only checks whether the **first
word** is in a 30-entry hardcoded `VERB_PHRASE_STARTS` set. Any subject-first
title (`User exports ...`) is rejected even though it contains a finite verb,
and `suggestedTitles` "fixes" the rejection by literally prefixing `Reviews `
to the rejected sentence, producing gibberish. The allowlist is so narrow that
**21 of the repository's own 35 use-case titles** under `docs/usecases/`
(e.g. `Archive or restore a use case`, `Propose a spec change (AI agent)`,
`Complete a work session`) are themselves rejected by the current heuristic —
the project does not pass its own validator.

## Completion Conditions

1. The heuristic accepts a subject-first finite-verb title
   (`User exports their expenses to CSV`, `User logs a new expense`) as a verb
   phrase, while still rejecting a title with no finite verb at all
   (`Order status`, `Expense report`). Behavior is locked by unit tests in
   `apps/api/tests/unit/application/verb-phrases.test.ts` and at the
   `authorUseCase` entry point in
   `apps/api/tests/unit/application/usecases.test.ts`.
2. The `suggestedTitles` generator never returns the broken
   `Reviews <rejected sentence>` form. Any suggestion it returns is itself
   accepted by `titleLooksLikeVerbPhrase`; if it cannot produce a genuine
   verb-phrase rewrite it returns no suggestion (an empty list). Locked by a
   unit test in `apps/api/tests/unit/application/usecases.test.ts`.
3. **Every UC title in the repository's spec corpus is accepted by the
   heuristic.** That is, for every `title:` enumerated from
   `docs/usecases/UC-*.md`, `titleLooksLikeVerbPhrase` returns `true` — the
   project passes its own validator. This is a universal claim: the gate
   enumerates the corpus from source and loops over every title (no
   single-case cheat).
4. The API typechecks and the targeted behavior suites pass.

## Sources Of Truth

- `docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-002-title-not-verb-phrase-rejects-the-project-s.md`
- `apps/api/src/application/verb-phrases.ts`
- `apps/api/src/application/usecases.ts`
- `apps/api/tests/unit/application/verb-phrases.test.ts`
- `apps/api/tests/unit/application/usecases.test.ts`

The corpus of accepted titles is enumerated from source with
`find docs/usecases -maxdepth 1 -name 'UC-*.md' -type f` and, per file,
`grep -E '^title:'`. The gate loops over every enumerated title and asserts the
heuristic accepts it.

## Verification

```
pnpm --filter @vooster/api typecheck
pnpm exec vitest run apps/api/tests/unit/application/verb-phrases.test.ts apps/api/tests/unit/application/usecases.test.ts
bash goals/49-dogfood-title-not-verb-phrase-rejects-the-project-s-own-na.gates.sh
bash scripts/completion-check.sh
```
