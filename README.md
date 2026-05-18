# vspec

Cockburn-style use case management for environments with **6+ concurrent AI
coding agents**.

> Spec first, then tests, then code. Pin a stable spec snapshot per agent
> session so multiple agents can work in parallel without invalidating each
> other's completion conditions.

## What this Repository Is

This is the **autonomous-build harness** for vspec MVP. It is designed to be
executed by `codex goal` (or any equivalent looping agent runner) with a single
high-level goal:

> Implement all 35 use cases under `docs/usecases/` such that each has
> passing E2E tests, and `scripts/completion-check.sh` returns 0.

## Files You Read First

1. [`GOAL.md`](GOAL.md) — the mission given to the agent.
2. [`AGENTS.md`](AGENTS.md) — working protocol (TDD, commit rules, layout).
3. [`docs/00-overview.md`](docs/00-overview.md) — what vspec is.
4. [`docs/04-tdd-protocol.md`](docs/04-tdd-protocol.md) — how TDD is enforced.

## Files You Read Per Task

- [`docs/state/next-task.md`](docs/state/next-task.md) — what to work on.
- [`docs/usecases/<UC-ID>-*.md`](docs/usecases/_index.md) — the spec for the
  task.
- [`docs/05-data-model.md`](docs/05-data-model.md),
  [`docs/06-api-contract.md`](docs/06-api-contract.md),
  [`docs/07-cli-spec.md`](docs/07-cli-spec.md),
  [`docs/08-file-format.md`](docs/08-file-format.md) — technical reference.

## Loop

```
codex goal "$(cat GOAL.md)"
```

Each iteration:

1. `bash scripts/diagnose.sh`
2. Read `docs/state/next-task.md` + the relevant UC spec.
3. TDD: red → green → refactor, committing each phase.
4. `bash scripts/verify-tdd.sh && bash scripts/check-bypass.sh`
5. `bash scripts/update-state.sh`
6. Loop until `bash scripts/completion-check.sh` returns 0.

## Safety

- `scripts/cost-monitor.sh` enforces a token budget.
- `scripts/verify-no-regression.sh` blocks reductions in passing test count.
- `.state/HARD_STOP` halts iteration if present.
