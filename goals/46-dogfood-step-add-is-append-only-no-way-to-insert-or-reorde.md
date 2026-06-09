# Goal 46 -- scenario steps must support first-class insert and reorder, with one shared re-sequencer

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

Authoring a scenario must let a step be placed at an explicit position and an
existing step be moved to a new position -- not only appended at the end. After
any positioning operation (append, insert-at, move) the scenario's steps must
be re-sequenced so that `step_number` runs contiguously from 1 with no gaps and
`order_index` matches, and that re-sequencing must be computed in exactly **one**
place so the three write paths cannot drift apart.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-001-step-add-is-append-only-no-way-to-insert-or.md`
(case `DF-001`, P1). During the dogfood loop a save step landed as step 2 after a
passive-voice rejection, and there was no way to insert the validation step ahead
of it. The agent narrated the workaround: "Step add only appends, no insertion.
I'll repurpose the current step 2 (save) into the validation step ... then append
a fresh save step." `step add` help confirms: "step add appends; use step edit for
existing step wording." Repurposing an existing step via `step edit` started a
pinned session and produced a BREAKING revision (version 7) for what should have
been a simple placement.

Root cause: `addScenarioStep` in `apps/api/src/application/scenario-authoring.ts`
hard-codes `order_index: steps.length` and `step_number: steps.length + 1`, so a
new step can only land at the tail. There is no operation to insert at a chosen
position or to move an existing step, and the CLI (`apps/cli/src/commands/step.ts`)
exposes only the append form.

## Completion Conditions

1. **Insert at a position.** A step can be created at an explicit position within
   its scenario (e.g. `vspec step add --at <n>`), not only at the tail. Inserting
   at position 1, at a middle position, and past the end (clamped to append) all
   produce a scenario whose `step_number` values are `1, 2, 3, ...` contiguous with
   no gaps, and whose `order_index` values agree with that order. Omitting the
   position keeps today's append behavior unchanged.
2. **Move an existing step.** An existing step can be moved to a new position
   (e.g. `vspec step move <id> --to <n>`) without repurposing another step's
   wording. After a move, the scenario's `step_number` / `order_index` are
   re-sequenced contiguously from 1, the moved step's `action` / `actor` / `notes`
   are preserved, and the operation is authorized + revision-tracked like other
   step writes.
3. **One shared re-sequencer.** The contiguous re-numbering of a scenario's steps
   is produced by a single function `resequenceScenarioSteps` in
   `apps/api/src/application/scenario-authoring.ts`. No other file under
   `apps/api/src` defines a second step re-sequencer, and every referring file
   imports the shared one rather than re-deriving step numbers itself, so the
   append / insert / move paths cannot drift to inconsistent numbering.
4. The API and CLI typecheck, the insert / move / re-sequence behavior is locked by
   new unit tests, and the existing append + step-edit suites stay green.

## Sources Of Truth

- `docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-001-step-add-is-append-only-no-way-to-insert-or.md`
- `apps/api/src/application/scenario-authoring.ts`
- `apps/api/src/application/step-editing.ts`
- `apps/cli/src/commands/step.ts`
- `apps/api/tests/unit/application/scenario-step-positioning.test.ts`
- `apps/cli/tests/unit/step-positioning.test.ts`

The set of files that may define the re-sequencer is enumerated from source with
`grep -rln 'function resequenceScenarioSteps' apps/api/src` (must be exactly one),
and the referring files are enumerated with
`grep -rln 'resequenceScenarioSteps' apps/api/src`; every referring file other than
the sole definer must `import` the shared function rather than declare its own.

## Verification

```
pnpm --filter @vooster/api typecheck
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/api/tests/unit/application/scenario-step-positioning.test.ts apps/cli/tests/unit/step-positioning.test.ts
bash goals/46-dogfood-step-add-is-append-only-no-way-to-insert-or-reorde.gates.sh
bash scripts/completion-check.sh
```
