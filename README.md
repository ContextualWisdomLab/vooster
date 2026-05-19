# vspec

Cockburn-style use case management for environments with **6+ concurrent AI
coding agents**.

> Spec first, then tests, then code. Pin a stable spec snapshot per agent
> session so multiple agents can work in parallel without invalidating each
> other's completion conditions.

## What this Repository Is

This is the **autonomous-build harness** for vspec. It is designed to be
executed by `codex goal` (or any equivalent looping agent runner) against a
stack of versioned goal files under [`goals/`](goals/):

- [`goals/0-init.md`](goals/0-init.md) — bring the MVP up via TDD (35 UCs,
  full test suite, `scripts/completion-check.sh` returns 0).
- [`goals/1-runnable.md`](goals/1-runnable.md) — make vspec actually runnable
  (bootable Fastify, Prisma persistence, oclif CLI, layered architecture).

The lowest-numbered goal whose `<n>-<name>.gates.sh` still fails is the
**active goal**. `scripts/completion-check.sh` records it in
`.state/active-goal`.

## Files You Read First

1. [`goals/`](goals/) — versioned mission files (see above). Read the active
   goal first.
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
codex goal "$(cat "$(cat .state/active-goal 2>/dev/null || echo goals/0-init.md)")"
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
