# Goal 55 -- a failing `usecase verify` must hand the agent its next move, not just a verdict

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

When an agent runs `vspec usecase verify <id>` (or the equivalent `vspec verify
<id>`, which shares the same `runVerify` producer) and the verdict is **not**
clean, the command must tell the agent what to do about it -- not just that
something failed. Goal 43 already made `verify` route into `runVerify` and emit a
stable `status` in every format; that closed the "opaque banner" symptom for the
*pass* case. But the finding behind this goal is the *fail* case: when verify
reports drift the agent still has to reverse-engineer the remedy by hand. A
verification command whose failure output cannot be acted on programmatically
forced the dogfood agent to abandon `verify` and validate by eye.

This goal adds the remediation half. Whenever `runVerify` produces a non-passing
verdict, **every failing check it reports must contribute a corresponding
suggested next action** -- a short, actionable remediation hint -- and that hint
set must be surfaced in both surfaces an agent reads:

- the `--format=agent` envelope, whose `suggested_next_actions` carries one entry
  per failing check so the agent can branch on it without parsing prose;
- the default human verdict, which prints the same remediation guidance inline so
  a human reading the terminal gets the identical next step.

No failing check may be silently dropped from the suggestion set: a verdict with
N failing checks yields N suggested next actions, so an agent that wires up the
remediation for only one failing-check kind does not satisfy the goal. A clean
verdict carries no suggested actions and still exits `0`.

To stop the human and agent surfaces from drifting into two divergent remediation
texts, the failing-check → next-action mapping lives in a **single** producer
(`suggestVerifyActions`) that both surfaces feed through -- the same
single-source discipline Goal 43 established for `runVerify` itself.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-006-usecase-verify-returns-opaque-output-with-n.md`
(case `DF-006`, P1). During the dogfood loop the agent ran
`vspec usecase verify TODO-001`, got only a bare `vspec CLI` line with no
pass/fail signal, and -- unsure whether the command had even run -- fell back to
`usecase show` to confirm the result visually. The finding's recommendation is
explicit: verify "must emit an explicit machine-readable verdict (pass/fail, list
of checks, and any failing invariants) ... **with suggested_next_actions on
failure**. A verification command that prints a bare banner defeats its purpose
and forced an agent workaround."

Goal 43 delivered the verdict and the per-format `status`. This goal delivers the
missing piece that recommendation names: on failure the verdict must carry
`suggested_next_actions`, so the agent gets an actionable move instead of being
stranded with a verdict it must interpret by hand.

This goal **extends** the single `runVerify` producer Goal 43 enforced; it does
not add a parallel verdict path and does not weaken any Goal 43 gate (`runVerify`
stays single-source, and `usecase.ts` still routes the `verify` action into it).

## Completion Conditions

1. When `vspec usecase verify <id>` / `vspec verify <id>` produces a non-passing
   verdict, every failing check the verdict reports contributes a distinct
   suggested next action. A verdict with multiple failing checks yields multiple
   suggestions (none dropped); a clean verdict yields none and exits `0`. This is
   locked by unit tests at the command entry point.
2. The remediation set is surfaced in both reader surfaces, locked by unit tests
   across the `human`, `json`, and `agent` formats:
   - `agent` -- the envelope's `suggested_next_actions` carries one entry per
     failing check, with no human-only prose mixed into stdout;
   - `human` -- the same remediation guidance is printed inline under the verdict
     (never a bare banner);
   - `json` -- the structured result still carries the verdict and the suggestion
     list.
3. No duplicated remediation logic: there is exactly **one** file under
   `apps/cli/src` that defines the producer `suggestVerifyActions`, and **every**
   `apps/cli/src` file that references `suggestVerifyActions` (other than the file
   that defines it) imports that single shared definition rather than re-declaring
   its own copy. This keeps the human and agent remediation surfaces from drifting
   into two suggestion sets.
4. The CLI typechecks, the new next-actions behavior suite passes, and the
   existing `vspec verify` verdict suite (`verify-command.test.ts`) and
   `usecase verify` routing suite (`usecase-verify-routing.test.ts`) stay green.

## Sources Of Truth

- `docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-006-usecase-verify-returns-opaque-output-with-n.md`
- `apps/cli/src/commands/verify.ts`
- `apps/cli/src/commands/usecase.ts`
- `apps/cli/tests/unit/usecase-verify-next-actions.test.ts`
- `apps/cli/tests/unit/verify-command.test.ts`
- `apps/cli/tests/unit/usecase-verify-routing.test.ts`

The set of `apps/cli/src` files that reference the remediation producer is
enumerated from source with `grep -rln 'suggestVerifyActions' apps/cli/src`;
exactly one of them may *define* `suggestVerifyActions` (enumerated with
`grep -rln 'function suggestVerifyActions' apps/cli/src`), and the gate loops over
the rest to confirm each imports the shared definition rather than re-declaring
it.

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/usecase-verify-next-actions.test.ts apps/cli/tests/unit/verify-command.test.ts apps/cli/tests/unit/usecase-verify-routing.test.ts
bash goals/55-dogfood-usecase-verify-returns-opaque-output-with-no-pass-.gates.sh
bash scripts/completion-check.sh
```
