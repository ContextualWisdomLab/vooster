# Goal 41 -- Passive-voice step linter must scope to the main predicate

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

The step-action passive-voice linter must judge the step's **main predicate**,
not any embedded `be + participle` phrase. An active step whose requirement
clause happens to contain `... is positive and a category is selected` is a good
spec and must be accepted, while a genuinely passive main predicate
(`Order is submitted.`) is still flagged.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-001-passive-voice-step-linter-false-positives-o.md`
(case `DF-001`, P1). During the dogfood loop the step action
`validates the amount is positive and a category is selected` was rejected with
`Error: Step action uses passive voice`. The main verb (`validates`) is active;
the detector fired on the trailing subordinate clause `is selected`. The agent
had to reword a correct spec and reorder steps to get past a false positive.

Root cause: the heuristic
`/^.+?\s+is\s+\w+ed\.?$/i` is anchored to the end of the string with a lazy
prefix, so **any** sentence that merely ends in `... is <participle>` trips it,
regardless of the main verb. The same buggy regex is duplicated across three
validation paths (`scenario-authoring`, `step-editing`, and the HTTP support
layer), so the heuristic can silently drift between paths.

## Completion Conditions

1. The passive-voice detector classifies an active step whose subordinate clause
   contains a `be + participle` phrase
   (`validates the amount is positive and a category is selected`) as **not**
   passive, while still flagging a genuinely passive main predicate
   (`Order is submitted.`). Behavior is locked by unit tests at the
   scenario-authoring, step-editing, and HTTP validation entry points.
2. The duplication is removed: **exactly one file** under `apps/api/src` defines
   `usesPassiveVoice`, and every other source file under `apps/api/src` that
   references `usesPassiveVoice` imports that single shared definition rather
   than keeping a private copy. This prevents the scoped heuristic from drifting
   between paths.
3. The API typechecks and the targeted behavior suites pass.

## Sources Of Truth

- `docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-001-passive-voice-step-linter-false-positives-o.md`
- `apps/api/src/application/scenario-authoring.ts`
- `apps/api/src/application/step-editing.ts`
- `apps/api/src/http/scenario-support.ts`
- `apps/api/tests/unit/application/scenario-authoring.test.ts`
- `apps/api/tests/unit/application/step-editing.test.ts`
- `apps/api/tests/unit/http/scenario-support.test.ts`

The set of files that define or reference `usesPassiveVoice` is enumerated from
source with `grep -rln 'usesPassiveVoice' apps/api/src`; the single definer is
enumerated with `grep -rln 'function usesPassiveVoice' apps/api/src`.

## Verification

```
pnpm --filter @vooster/api typecheck
pnpm exec vitest run apps/api/tests/unit/application/scenario-authoring.test.ts apps/api/tests/unit/application/step-editing.test.ts apps/api/tests/unit/http/scenario-support.test.ts
bash goals/41-dogfood-passive-voice-step-linter-false-positives-on-activ.gates.sh
bash scripts/completion-check.sh
```
