# Goal 57 -- an inserted step renders in step_number order on every surface, with order_index kept consistent through one shared display ordering

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

When a step is inserted mid-scenario (`vspec step add --at <n>`), the scenario
must read back in the same `1, 2, 3, ...` order on **every** output surface --
the human `usecase show`, the agent (`--format=agent`) payload, and the rendered
markdown -- and the persisted `order_index` must stay consistent with
`step_number` rather than drifting to the tail. The display ordering of a
scenario's steps must be computed in exactly **one** shared place so these
surfaces cannot disagree again.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-003-inserted-step-renders-out-of-order-in-useca.md`
(case `DF-003`, P1). During the dogfood loop the agent ran
`step add ... --at 2`; the human `usecase show` then "printed steps in an odd
order (1, 3, 4, 2)." The step numbers were right (1-4) but the inserted account
step "is stored at the end of the array -- its order_index is out of sync with
its step_number." The markdown render and the agent payload were correctly
ordered (1-4), so only the human surface and the persisted `order_index` were
wrong. The agent burned turns 13-16 dumping `step_number` vs `order_index` and
re-syncing just to confirm the spec was not corrupt.

Root cause: a positional insert assigns `step_number` but leaves `order_index`
appended (`apps/api/src/application/scenario-authoring.ts` /
`apps/api/src/application/step-editing.ts`), and the human `usecase show`
renderer orders by `order_index` instead of `step_number`. Because each surface
chose its own ordering, they drifted: markdown sorted by `step_number` and was
correct; the human path sorted by `order_index` and was wrong.

## Completion Conditions

1. **order_index stays consistent with step_number after a positional insert.**
   Inserting a step at position 1, at a middle position, and past the end
   (clamped to append) each yields a scenario whose persisted steps have
   `step_number` values `1, 2, 3, ...` contiguous with no gaps **and**
   `order_index` values that agree with that same order (i.e. ordering the steps
   by `order_index` produces the identical sequence as ordering by
   `step_number`). Omitting `--at` keeps today's append behavior unchanged.
2. **Every output surface renders an inserted step in step_number order.** After
   a mid-scenario insert, rendering the use case in the human `usecase show`
   format, in the agent (`--format=agent`) payload, and as markdown each lists
   the scenario's steps in `1, 2, 3, ...` order -- no surface emits the stored
   `order_index` order (`1, 3, 4, 2`).
3. **One shared display ordering.** The order in which a scenario's steps are
   presented for output is produced by a single shared function
   `orderScenarioStepsForDisplay` defined in exactly one file under
   `apps/api/src`. Every file under `apps/api/src` that references it imports the
   shared function rather than re-deriving step order (e.g. by sorting on
   `order_index`) itself, so the human / agent / markdown surfaces cannot drift
   to inconsistent ordering again.
4. The API typechecks, the insert-ordering / cross-surface behavior is locked by
   a new unit test, and the existing step-positioning and step-editing suites
   stay green.

## Sources Of Truth

- `docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-003-inserted-step-renders-out-of-order-in-useca.md`
- `apps/api/src/application/scenario-authoring.ts`
- `apps/api/src/application/step-editing.ts`
- `apps/api/src/application/usecase-agent-data.ts`
- `apps/api/src/application/markdown-renderer.ts`
- `apps/api/tests/unit/application/inserted-step-display-order.test.ts`

The set of files that may define the shared ordering is enumerated from source
with `grep -rln 'function orderScenarioStepsForDisplay' apps/api/src` (must be
exactly one), and the referring files are enumerated with
`grep -rln 'orderScenarioStepsForDisplay' apps/api/src`; every referring file
other than the sole definer must `import` the shared function rather than declare
its own ordering.

## Verification

```
pnpm --filter @vooster/api typecheck
pnpm exec vitest run apps/api/tests/unit/application/inserted-step-display-order.test.ts apps/api/tests/unit/application/scenario-step-positioning.test.ts
bash goals/57-dogfood-inserted-step-renders-out-of-order-in-usecase-show.gates.sh
bash scripts/completion-check.sh
```
