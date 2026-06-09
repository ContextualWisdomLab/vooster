# Goal 52 -- The tool must not teach by self-contradicting example, and a rejected title must be self-teaching

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

The product ships an AI agent guide (`apps/api/src/application/ai-guide.ts`) whose
worked example tells agents to run
`vspec usecase create --title "Record a new expense" ... --force`. The trailing
`--force` is a tell: the tool's own canonical example assumes its title validator
would reject the title, so it teaches agents to bypass the validator instead of
to write an acceptable title. That is the contract-consistency half of the
finding — the product must not model the very workaround the validator forces.

Two things must become true:

1. The guide must stop shipping self-contradicting create examples: every
   `vspec usecase create` example command the guide emits must carry a title the
   validator accepts, and none of those create examples may pass `--force`. A
   self-teaching example must demonstrate a title that *works*, not one that has
   to be forced.
2. When `usecase create` genuinely rejects a title, the `TITLE_NOT_VERB_PHRASE`
   response must teach the fix end to end: it must surface at least one concrete
   rewrite suggestion that the validator itself accepts, and a `--force`
   next-action that carries a human-readable reason.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-004-usecase-create-title-validator-title-not-ve.md`
(case `DF-004`, P1). During the dogfood loop, `vspec usecase create --title
"User invites a partner to a shared budget"` failed with
`TITLE_NOT_VERB_PHRASE` ("Use case title should be a verb phrase"); the agent
inspected the error, then applied `--force` to all three creates, narrating that
"the title validator is a heuristic; existing use cases use the same 'User …'
style, so I'll proceed with `--force`."

Goal 49 already loosened the heuristic so subject-first finite-verb titles are
accepted and locked the `docs/usecases/UC-*.md` spec corpus against it. This goal
closes the two prongs goal 49 did not: (a) the tool still ships a worked example
(`ai-guide.ts`) that bakes `--force` into a `usecase create` call — modeling the
workaround rather than a clean title — and (b) the rejection envelope is not
self-teaching (a bare message plus, before goal 49, a gibberish suggestion). A
guide that teaches `--force` and an error that does not teach the rewrite are
both contract-consistency bugs, not heuristic nits.

## Completion Conditions

1. **Every `vspec usecase create` example command in the shipped agent guide is
   validator-clean.** That is, for every create command enumerated from
   `apps/api/src/application/ai-guide.ts` (both the JSON `examples[].commands`
   list and the `guideMarkdown()` body), the `--title` value is accepted by
   `titleLooksLikeVerbPhrase`. This is a universal claim: the gate enumerates the
   create commands from source and loops the real validator over each title (no
   single-case cheat).
2. **No guide create example bypasses the validator.** No `vspec usecase create`
   example command in `ai-guide.ts` passes `--force`. This is a negative
   universal invariant (the workaround appears nowhere in the shipped guide) — a
   behavioural test verifies one path, so a single grep guards the whole file.
3. **The rejection envelope is self-teaching.** When `usecase create` rejects a
   title, the `TITLE_NOT_VERB_PHRASE` response surfaces at least one concrete
   rewrite suggestion that `titleLooksLikeVerbPhrase` itself accepts, plus a
   `vspec usecase create --force` next-action whose `reason` is non-empty.
   Behaviour is locked by unit tests over `sendUseCaseAuthoringResult` in
   `apps/api/tests/unit/http/usecase-results.test.ts`.
4. The API typechecks and the targeted behavior suites pass.

## Sources Of Truth

- `docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-004-usecase-create-title-validator-title-not-ve.md`
- `apps/api/src/application/ai-guide.ts` (the shipped guide; source of the
  enumerated create examples)
- `apps/api/src/application/verb-phrases.ts` (`titleLooksLikeVerbPhrase`)
- `apps/api/src/http/usecase-results.ts` (`sendUseCaseAuthoringResult`)
- `apps/api/tests/unit/http/usecase-results.test.ts`

The create-example corpus is enumerated from source with
`grep -oE 'usecase create --title "[^"]*"' apps/api/src/application/ai-guide.ts`
and, per match, the quoted title is extracted with `sed`. The gate loops over
every enumerated title and asserts the validator accepts it.

## Verification

```
pnpm --filter @vooster/api typecheck
pnpm exec vitest run apps/api/tests/unit/http/usecase-results.test.ts apps/api/tests/unit/application/verb-phrases.test.ts
bash goals/52-dogfood-usecase-create-title-validator-title-not-verb-phra.gates.sh
bash scripts/completion-check.sh
```
