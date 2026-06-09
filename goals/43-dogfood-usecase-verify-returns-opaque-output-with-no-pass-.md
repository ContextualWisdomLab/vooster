# Goal 43 -- `usecase verify` must emit a clear verdict in every format, not an opaque banner

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

When an agent runs `vspec usecase verify <id>` it must get a clear, branchable
verdict -- a human PASS/FAIL line with the drift it found, and under
`--format=agent` a structured envelope carrying a stable `status` field. Today
that invocation dead-ends: `usecase` has no `verify` action, so the command
falls through to `throw new Error("Missing usecase action.")` (or an oclif
banner) and prints nothing an agent can branch on. The agent that surfaced this
burned three invocations and fell back to manual validation.

The verdict logic already exists and is already structured -- it lives in the
top-level `vspec verify` command (`runVerify` in
`apps/cli/src/commands/verify.ts`), which emits `status`, `drift`, broken-link
and unlinked-step detail across human / json / agent formats. The fix is to
route the `verify` use-case action into that **single existing producer**, not
to write a second verdict path.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-006-usecase-verify-returns-opaque-output-with-n.md`
(case `DF-006`, P1). During the dogfood loop the agent called
`vspec usecase verify TODO-001`, then again with `--format=agent` grepping for
`status`/`warning`/`error`/`pass`/`fail`, then `--format=agent | head -60`. All
three printed only the `vspec CLI` banner with no verdict in any format. The
agent could not tell whether `verify` was a stub or whether it had the wrong
invocation, so it abandoned the command and validated by hand via `show` +
`export`.

Root cause: `runUsecase` in `apps/cli/src/commands/usecase.ts` dispatches on the
action argument (`create` / `add-stakeholder` / `list` / `show` / `archive` /
`set` / `restore`) and ends in `throw new Error("Missing usecase action.")`.
`verify` is not one of the handled actions, so `usecase verify <id>` is
silently unroutable. Meanwhile `vspec verify <id>` works fine -- the two never
got connected.

## Completion Conditions

1. `vspec usecase verify <id>` produces the same verdict as `vspec verify <id>`
   by routing into the **single** `runVerify` producer. It does **not** throw
   `Missing usecase action.` for the `verify` action and does not print only a
   banner.
2. For **every** output format the verify command accepts (`human`, `json`,
   `agent`), `usecase verify` emits a machine-branchable verdict:
   - `human` -- an explicit verdict line naming the use-case key and its
     `status` (`pass` / `broken_links` / `unlinked_steps` / `failing_tests`),
     plus the broken-link / unlinked-step detail. Never a bare banner.
   - `json` -- the structured `VerifyResult` with a top-level `status`.
   - `agent` -- the agent envelope whose `data.status` and `data.drift` an agent
     can branch on.
   The exit code follows the verdict exactly as `vspec verify` already does
   (`0` pass, `7` unlinked steps, `1` otherwise).
3. No duplicated verdict logic: there is exactly **one** `runVerify` definition
   under `apps/cli/src`, and **every** `apps/cli/src` file that references it
   (other than the file that defines it) imports the shared producer rather than
   re-declaring its own copy. This keeps the `usecase verify` path and the
   `vspec verify` path from drifting into two verdict implementations.
4. The CLI typechecks, the new `usecase verify` routing + per-format behavior is
   locked by unit tests at the command entry point (`runUsecase`), and the
   existing `vspec verify` verdict suite stays green.

## Sources Of Truth

- `docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-006-usecase-verify-returns-opaque-output-with-n.md`
- `apps/cli/src/commands/usecase.ts`
- `apps/cli/src/commands/verify.ts`
- `apps/cli/tests/unit/usecase-verify-routing.test.ts`
- `apps/cli/tests/unit/verify-command.test.ts`

The set of accepted formats is the whitelist in `verifyFormat`
(`apps/cli/src/commands/verify.ts`): `human`, `json`, `agent`. The set of
`apps/cli/src` files that reference the verdict producer is enumerated from
source with `grep -rln 'runVerify' apps/cli/src`; exactly one of them may
*define* `runVerify`, and the gate loops over the rest to confirm each imports
the shared definition rather than re-declaring it.

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/usecase-verify-routing.test.ts apps/cli/tests/unit/verify-command.test.ts
bash goals/43-dogfood-usecase-verify-returns-opaque-output-with-no-pass-.gates.sh
bash scripts/completion-check.sh
```
