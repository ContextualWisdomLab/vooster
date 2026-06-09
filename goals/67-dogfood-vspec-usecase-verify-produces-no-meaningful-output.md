# Goal 67 -- `vspec usecase verify <id>` must reach its verdict producer, not fall through to the bare banner

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

`vspec usecase verify <id>` printed nothing but the bare `vspec CLI` banner, so
the dogfood agent could not tell what `verify` checks or whether the spec passed
and abandoned the command. Goals 43/54/55 already built the verdict producer:
`runVerify` is single-source (Goal 43), emits per-dimension structural checks
(Goal 54), and on failure hands back `suggested_next_actions` (Goal 55), and
`runUsecase` already routes `action === "verify"` into `runVerify`. None of that
ran for the finding's command, because the failure is one hop earlier: the
top-level CLI dispatcher in `apps/cli/src/index.ts` (`commandRoutes` /
`commandRouteKeys`) has **no `usecase verify` route**. `vspec usecase verify <id>`
resolves to no route key and to no `usecase` fallback, so oclif drops the agent
onto the bare description banner -- the command never reaches `runUsecase` at all.

This goal closes that routing gap and generalizes it so it cannot recur for a
sibling action. The dispatcher must register `usecase verify` so the command
routes into the same `runVerify` verdict producer that `vspec verify <id>` feeds,
emitting a structured verdict (checks run, pass/fail, and on failure
`suggested_next_actions`) and respecting `--format=agent` -- never a bare banner.

The general invariant: **every `usecase` command that `runUsecase` handles must
have a corresponding route registered in the dispatcher.** A handler with no
route is exactly the DF-006 failure -- a usable subcommand that silently falls
through to the banner. The source of truth is the set of `action === "..."`
branches in `apps/cli/src/commands/usecase.ts`; the dispatcher must carry a
`usecase <action>` route for each, so an agent that wires only `verify` while
leaving another handled action routeless does not satisfy the goal.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-006-vspec-usecase-verify-produces-no-meaningful.md`
(case `DF-006`, P1). In dogfood cycle `20260604T204814Z`, command 20
(`vspec usecase verify TODO-001 2>&1 | tail -15`) produced only `vspec CLI`
(narration line 112: "vspec usecase verify produced no real output ... so its
purpose remains unclear"). The agent could not determine what verify checks or
whether its spec passed.

Goals 43/54/55 made the *verdict* rich and actionable but operated on
`runUsecase`/`runVerify` internals; they were verified through direct calls and a
frozen route snapshot, neither of which enumerates the `runUsecase` action set
against the live route table. So the missing `usecase verify` route slipped
through: the verdict was never reached because the command never dispatched. This
goal enforces the routing completeness that lets that work actually run.

This goal is **purely additive**: it registers a dispatcher route and locks route
completeness. It does not change `runVerify`/`runUsecase` semantics and does not
weaken any prior goal gate (`runVerify` stays single-source, `suggestVerifyActions`
stays single-source, structural checks stay intact).

## Completion Conditions

1. `vspec usecase verify <id>` no longer falls through to the bare `vspec CLI`
   banner: the dispatcher resolves it to a route that calls `runUsecase` with the
   `verify` action, which routes into the shared `runVerify` verdict producer. The
   resulting verdict carries the checks run and a pass/fail status, carries
   `suggested_next_actions` on failure (Goal 55), and respects `--format=agent`
   (no human-only prose mixed into the agent envelope's stdout). This is locked by
   a dispatch unit test that asserts `usecase verify` is a routed key and that it
   dispatches into the verify path rather than the banner.

2. Every `usecase` command that `runUsecase` handles has a corresponding route in
   the dispatcher. The handled actions are enumerated from the `action === "..."`
   branches in `apps/cli/src/commands/usecase.ts` (the source of truth), and for
   each the dispatcher's route surface (`commandRouteKeys()` in
   `apps/cli/src/index.ts`) must carry the matching `usecase <action>` key. None
   may be dropped: N handled actions yield N routes, so no handled subcommand can
   fall through to the bare banner.

3. The CLI typechecks, the new dispatch suite passes, and the existing dispatcher
   route snapshot and the verify / usecase-verify routing suites stay green.

## Sources Of Truth

- `docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-006-vspec-usecase-verify-produces-no-meaningful.md`
- `apps/cli/src/commands/usecase.ts` -- the handled actions, enumerated with
  `grep -oE 'action === "[a-z-]+"' apps/cli/src/commands/usecase.ts`.
- `apps/cli/src/index.ts` -- the dispatcher route table (`commandRoutes`) and the
  `commandRouteKeys()` surface that must carry a `usecase <action>` key per
  handled action.
- `apps/cli/tests/unit/usecase-verify-dispatch.test.ts` -- the new dispatch test.
- `apps/cli/tests/unit/dispatcher-routes.test.ts` -- the existing route snapshot.
- `apps/cli/tests/unit/usecase-verify-routing.test.ts` -- the existing routing
  suite that proves `runUsecase`'s `verify` action reaches `runVerify`.

The gate enumerates the handled actions from `usecase.ts` and loops, confirming
each has a `usecase <action>` route registered in `index.ts` -- no single-case
cheat.

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/usecase-verify-dispatch.test.ts apps/cli/tests/unit/dispatcher-routes.test.ts apps/cli/tests/unit/usecase-verify-routing.test.ts
bash goals/67-dogfood-vspec-usecase-verify-produces-no-meaningful-output.gates.sh
bash scripts/completion-check.sh
```
