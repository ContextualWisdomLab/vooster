# Autonomous Build Harness

This document preserves the autonomous-build harness instructions for agents
working on vspec itself.

## What This Repository Is

This is the **autonomous-build harness** for vspec. It is designed to be
executed by `codex goal` (or any equivalent looping agent runner) against a
stack of versioned goal files under [`../goals/`](../goals/):

- [`../goals/0-init.md`](../goals/0-init.md) — bring the MVP up via TDD (35
  UCs, full test suite, `scripts/completion-check.sh` returns 0).
- [`../goals/1-runnable.md`](../goals/1-runnable.md) — make vspec actually
  runnable (bootable Fastify, Prisma persistence, oclif CLI, layered
  architecture).

The lowest-numbered goal whose `<n>-<name>.gates.sh` still fails is the
**active goal**. `scripts/completion-check.sh` records it in
`.state/active-goal`.

## Files You Read First

1. [`../goals/`](../goals/) — versioned mission files. Read the active goal
   first.
2. [`../AGENTS.md`](../AGENTS.md) — working protocol (TDD, commit rules,
   layout).
3. [`00-overview.md`](00-overview.md) — what vspec is.
4. [`04-tdd-protocol.md`](04-tdd-protocol.md) — how TDD is enforced.

## Files You Read Per Task

- [`state/next-task.md`](state/next-task.md) — what to work on.
- [`usecases/<UC-ID>-*.md`](usecases/_index.md) — the spec for the task.
- [`05-data-model.md`](05-data-model.md), [`06-api-contract.md`](06-api-contract.md),
  [`07-cli-spec.md`](07-cli-spec.md), [`08-file-format.md`](08-file-format.md)
  — technical reference.

## Loop

```bash
codex goal "$(cat "$(cat .state/active-goal 2>/dev/null || echo goals/0-init.md)")"
```

Each iteration:

1. `bash scripts/diagnose.sh`
2. Read `docs/state/next-task.md` + the relevant UC spec.
3. TDD: red -> green -> refactor, committing each phase.
4. `bash scripts/verify-tdd.sh && bash scripts/check-bypass.sh`
5. `bash scripts/update-state.sh`
6. Loop until `bash scripts/completion-check.sh` returns 0.

## Safety

- `scripts/cost-monitor.sh` enforces a token budget.
- `scripts/verify-no-regression.sh` blocks reductions in passing test count.
- `.state/HARD_STOP` halts iteration if present.
