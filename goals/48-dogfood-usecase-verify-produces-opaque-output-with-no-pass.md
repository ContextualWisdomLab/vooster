# Goal 48 -- `usecase verify` must report per-check spec-fidelity verdicts, not just link drift

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

When an agent runs `vspec usecase verify <id>` (or the equivalent
`vspec verify <id>`, which shares the same producer) it must get a concrete,
branchable **spec-fidelity report** -- not just the implementation-link drift the
command checks today. Goal 43 already routed `usecase verify` into the single
`runVerify` producer and made it emit a `status` in every format. But that
verdict only answers "are the step `implements:` refs and tests intact?" It says
nothing about whether the spec itself is well-formed, so an agent still cannot
rely on `verify` to confirm a use case is correct before pushing.

This goal adds the substantive checks the finding asks for. The verify result
must carry a per-check breakdown over the spec-fidelity checks the verifier runs:

- **actors registered** -- every actor a scenario step references is a declared
  actor/stakeholder of the use case (no dangling actor).
- **scenario completeness** -- the use case has at least a main success scenario
  and no scenario is empty of steps.
- **extension points resolved** -- every extension point the use case declares is
  resolved (handled by an extension/alternate path), with none left dangling.
- **Cockburn fidelity** -- the required Cockburn fields (goal/primary-actor level
  metadata) the spec template mandates are present and non-empty.

Each check reports an explicit `pass`/`fail` with the offending detail, an
overall verdict aggregates them with the existing link/test verdict, and the
exit code is non-zero whenever any check fails. The `--format=agent` envelope
must expose the per-check breakdown so an agent can branch on it.

To avoid two verdict implementations drifting apart, the spec checks live in a
**single** producer that both the `usecase verify` path and the `vspec verify`
path feed through -- the same single-source discipline Goal 43 established for
`runVerify`.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-001-usecase-verify-produces-opaque-output-with-.md`
(case `DF-001`, P1). During the dogfood loop the agent ran
`vspec usecase verify POCKET-001` and got only
`============ VERIFY ============` / `vspec CLI` with `EXIT 0` -- no checks run,
no pass/fail summary, no findings. The agent could not rely on `verify` and fell
back to reading `usecase show` ("The spec reads correctly") to validate
correctness by eye, making the verify step dead weight before push.

Goal 43 closed the *routing* half of this symptom (verify no longer dead-ends on
a banner). DF-001 is the *substance* half: even when verify runs, it only checks
link drift, so a structurally broken spec (missing actor, empty scenario,
dangling extension point, missing Cockburn field) still verifies clean. This
goal makes verify actually inspect the spec and emit a per-check verdict an agent
can gate on.

This goal **extends** the single `runVerify` producer Goal 43 enforced; it does
not add a parallel verdict path and does not weaken any Goal 43 gate (`runVerify`
stays single-source, and `usecase.ts` still routes the `verify` action into it).

## Completion Conditions

1. `vspec usecase verify <id>` and `vspec verify <id>` both emit a per-check
   spec-fidelity breakdown covering the four checks above (actors registered,
   scenario completeness, extension points resolved, Cockburn fidelity). Each
   check carries an explicit `pass`/`fail` and, on failure, the offending detail.
   This is locked by unit tests at the command entry point.
2. The result aggregates the per-check outcomes into an overall verdict together
   with the existing link/test drift, and the exit code is **non-zero whenever
   any spec check fails** (a clean spec with intact links/tests still exits `0`).
   Behavior is locked by unit tests across the `human`, `json`, and `agent`
   formats:
   - `human` -- a per-check verdict line for each spec check (never a bare
     banner),
   - `json` -- the structured result with the per-check breakdown,
   - `agent` -- the agent envelope whose `data` carries the per-check breakdown an
     agent can branch on.
3. No duplicated check logic: there is exactly **one** file under `apps/cli/src`
   that defines the spec-check producer `runSpecChecks`, and **every**
   `apps/cli/src` file that references `runSpecChecks` (other than the file that
   defines it) imports that single shared definition rather than re-declaring its
   own copy. This keeps the `usecase verify` and `vspec verify` paths from
   drifting into two spec-check implementations.
4. The CLI typechecks, the new spec-check behavior suite passes, and the existing
   `vspec verify` verdict suite (`verify-command.test.ts`) and `usecase verify`
   routing suite (`usecase-verify-routing.test.ts`) stay green.

## Sources Of Truth

- `docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-001-usecase-verify-produces-opaque-output-with-.md`
- `apps/cli/src/commands/verify.ts`
- `apps/cli/src/commands/usecase.ts`
- `apps/cli/tests/unit/usecase-verify-checks.test.ts`
- `apps/cli/tests/unit/verify-command.test.ts`
- `apps/cli/tests/unit/usecase-verify-routing.test.ts`

The set of `apps/cli/src` files that reference the spec-check producer is
enumerated from source with `grep -rln 'runSpecChecks' apps/cli/src`; exactly one
of them may *define* `runSpecChecks` (enumerated with
`grep -rln 'function runSpecChecks' apps/cli/src`), and the gate loops over the
rest to confirm each imports the shared definition rather than re-declaring it.

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/usecase-verify-checks.test.ts apps/cli/tests/unit/verify-command.test.ts apps/cli/tests/unit/usecase-verify-routing.test.ts
bash goals/48-dogfood-usecase-verify-produces-opaque-output-with-no-pass.gates.sh
bash scripts/completion-check.sh
```
