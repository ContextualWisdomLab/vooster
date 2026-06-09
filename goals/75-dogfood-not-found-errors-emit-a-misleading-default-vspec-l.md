# Goal 75 -- entity NOT_FOUND errors must teach the real recovery, never inherit a signup-flavored `vspec login` / "Restart signup" default

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

During the dogfood loop the agent ran `vspec step add` with a wrong id and got
back `"code": "NOT_FOUND", "message": "Scenario not found"` -- but the response's
`suggested_next_actions` told it to run `vspec login` to "Restart signup", which
had nothing to do with the actual problem (a stale/unknown scenario id). The
agent retried the same wrong id twice before recovering by guessing. The same
trap fires for `Step not found`, `Use case not found`, and every other entity
NOT_FOUND response in the HTTP layer.

Root cause: the shared `problem()` helper in
`apps/api/src/http/signup-support.ts` defaults its `suggestedNextActions`
parameter to `[{ command: "vspec login", reason: "Restart signup." }]`. Every
`problem(404, "<entity> not found")` caller that omits an explicit suggestion --
including `problem(404, "Scenario not found")` in `scenario-results.ts` and
`problem(404, "Step not found")` in `step-results.ts` -- silently inherits this
signup-flow recovery, which is misleading for an entity-lookup failure.

The fix has two halves:

1. **Remove the signup-flavored default from the shared `problem()` helper.** A
   generic error helper must not bake in a recovery that only makes sense for the
   signup flow. The genuinely signup/auth-related callers (e.g.
   `githubUnavailable`, the no-vspec-user signup case) already pass their auth
   recovery explicitly and must keep doing so; the shared default must no longer
   carry it.
2. **Give entity NOT_FOUND responses a recovery that teaches the real fix.** An
   entity-lookup 404 should point the agent at re-reading the use case to get the
   current ids -- `{ command: "vspec usecase show <KEY>", reason: "Re-read the
   use case to get the current scenario/step ids." }` -- instead of a signup
   command. The exact wording is the implementer's call, but the recovery must
   name `vspec usecase show` (the command that surfaces current ids) and must not
   mention `vspec login` / "Restart signup".

## Why This Goal Exists

This resolves DF-006 from the dogfood loop: an entity NOT_FOUND error whose
`suggested_next_actions` recommended a signup command, sending the agent down a
dead end. A recovery suggestion that has nothing to do with the failure is worse
than none -- it actively misdirects an autonomous agent.

This is additive to the existing Problem Details / `suggested_next_actions`
machinery the HTTP layer already uses; it does not weaken any prior gate. It
removes a wrong default and gives entity NOT_FOUND responses a self-teaching one.

## Completion Conditions

1. **Every not-found route in the recovery-surface corpus teaches the real
   recovery command and never leaks the signup `vspec login` / "Restart signup"
   suggestion.** The corpus is a source-of-truth fixture,
   `apps/api/tests/fixtures/not-found-recovery-surface.txt` (one scenario token
   per line; `#` comment and blank lines ignored). Each token names an entity
   NOT_FOUND response surfaced by a real result-sender. This is a universal
   claim: the gate enumerates every non-comment line from that file and loops the
   **real** sender for each token (capturing the body it would send), with no
   single-case cheat. For each scenario the captured response must (a) contain no
   `vspec login` command, (b) contain no `Restart signup` reason, and (c) carry a
   non-empty `suggested_next_actions` whose recovery names `vspec usecase show`
   (the command that re-surfaces current ids). The corpus must encode the dogfood
   anchor scenario (`step-add-scenario-not-found`, the `Scenario not found` case
   that misdirected the agent) plus a representative spread (>= 2 total) that also
   covers a second entity NOT_FOUND sender (e.g. `Step not found`). Future
   dogfood findings of the same shape append a line here rather than re-opening
   per-scenario handling.
2. **The shared `problem()` helper no longer ships a signup-flavored default.**
   This is the negative universal invariant: because the corpus loop can only
   exercise the senders it lists, a single grep over the helper guarantees no
   *other* (present or future) `problem()` caller silently inherits the signup
   recovery. The gate fails if the `problem()` default `suggestedNextActions`
   parameter still hardcodes `Restart signup`.
3. **Entity NOT_FOUND responses are self-teaching and the genuinely auth-related
   recoveries are preserved.** Locked by unit tests in
   `apps/api/tests/unit/http/not-found-recovery.test.ts`: an entity NOT_FOUND
   response (Scenario / Step / Use case not found) carries a `vspec usecase show`
   recovery and no signup command, while the auth/signup callers that legitimately
   recommend `vspec login` still do so.
4. The API typechecks and the targeted behaviour suite passes.

## Sources Of Truth

- The dogfood finding for DF-006 (entity NOT_FOUND emits a misleading default
  `vspec login` / "Restart signup" recovery).
- `apps/api/tests/fixtures/not-found-recovery-surface.txt` (the recovery-surface
  corpus; source of the enumerated NOT_FOUND scenarios).
- `apps/api/src/http/signup-support.ts` (`problem()` default suggestion).
- `apps/api/src/http/scenario-results.ts` (`Scenario not found`,
  `Use case not found`), `apps/api/src/http/step-results.ts` (`Step not found`).
- `apps/api/tests/unit/http/not-found-recovery.test.ts`.

The corpus is enumerated from source by stripping `#` comments and blank lines
from the fixture; the gate loops the real result-sender for every remaining token
and asserts the captured response carries no signup recovery and a `vspec usecase
show` recovery. The dogfood anchor scenario (`step-add-scenario-not-found`) must
be present so the corpus genuinely encodes the regression.

## Verification

```
pnpm --filter @vooster/api typecheck
pnpm exec vitest run apps/api/tests/unit/http/not-found-recovery.test.ts
bash goals/75-dogfood-not-found-errors-emit-a-misleading-default-vspec-l.gates.sh
bash scripts/completion-check.sh
```
