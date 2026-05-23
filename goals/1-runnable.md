# Goal 1: Make vspec actually runnable

## Why This Goal Exists

Goal 0 (`goals/0-init.md`) achieved a passing test suite, but `completion-check`
gave green to a system that:

- has no real entrypoint (`src/index.ts` is empty),
- stores everything in in-memory Maps that die with the process,
- ships zero CLI binaries even though every UC response advertises one
  (`recommended_next_command: "vspec ..."`),
- keeps `src/application`, `src/domain`, `src/ports`, `src/infrastructure`,
  `src/cli` as empty placeholder directories.

In short: the API contract is honest, the product is not yet usable. Goal 1
closes that gap **without rewriting the use case docs and without weakening any
existing test**.

## The Goal

vspec is runnable end-to-end such that all six conditions below hold:

1. **Bootable.** `npm start` boots a Fastify server on `$PORT` (default 3000)
   and `GET /healthz` returns `{"status":"ok"}` with 200. `src/index.ts` is the
   real entrypoint that wires `createServer` and `app.listen`.
2. **Persistent.** Every entity that was previously kept in in-memory state
   (workspaces, users, projects, actors, stakeholders, use cases, scenarios,
   steps, revisions, branches, sessions, locks, comments, API keys, sync
   markers, merge requests) is read from and written to a real database via
   Prisma. `scripts/check-persistence.sh` passes — boot the server, create a
   workspace + UC, send `SIGTERM`, restart, the same data is still readable
   over the API.
3. **CLI binary.** `npx vspec --help` returns exit 0 from an oclif binary at
   `bin/run.js`. Every distinct CLI command string that appears in HTTP
   responses (`recommended_next_command` / `suggested_next_actions[].command`)
   has a corresponding subcommand that calls the API and prints a result.
   `scripts/check-cli.sh` enumerates them and passes.
4. **CLI E2E.** `tests/e2e-cli/UC-XXX.test.ts` exists for every UC. Each test
   spawns the CLI as a child process against a real server bound to a random
   port and asserts the main success scenario succeeds. Extension flows can
   stay in `tests/e2e/`. _(The "test passes" half is enforced by `goals/_meta.md`
   M.3; this goal's gate enumerates file presence only.)_
5. **Layered.** `src/http/` contains only routing + validation. Business logic
   lives in `src/application/`, domain types in `src/domain/`, adapters in
   `src/infrastructure/`, port interfaces in `src/ports/`. `eslint-plugin-
boundaries` (already installed) is configured and clean.
   `scripts/check-layers.sh` passes.
6. **No goal-0 regression.** `goals/0-init.gates.sh` still passes. Existing
   E2E tests in `tests/e2e/` remain green with the same or stronger
   assertions; weakening any assertion is forbidden.

## Scope Guards

These are the most likely shortcuts the agent will be tempted to take. They
are explicitly forbidden:

- Weakening an existing `tests/e2e/` assertion to make persistence migration
  easier. If a route needs to change to support persistence, the test stays
  the same; the route adapts.
- Authoring a new UC document or editing an existing one. The 35 UC docs are
  frozen for this goal.
- Keeping both an in-memory and a Prisma store alive for the same entity
  beyond a single TDD cycle. Once a route is migrated, the in-memory store
  for that entity is deleted in the same commit.
- Building the CLI as a shell wrapper around `curl`. The CLI must be a real
  oclif application (`@oclif/core`) whose commands construct typed requests
  and parse typed responses.
- Mocking the server inside CLI E2E tests. CLI E2E must spawn the real CLI
  binary and hit a real Fastify server.

## Mandatory First Step (every iteration)

```
bash scripts/diagnose.sh
```

`diagnose.sh` reads `.state/active-goal` to identify which goal you are
working on. While goal 0's gates remain green and goal 1's do not, the active
goal is this file.

## Mandatory Reading Order

1. `AGENTS.md` — TDD protocol (unchanged from goal 0).
2. `goals/1-runnable.md` — this file.
3. `docs/state/next-task.md` — what to do this iteration.
4. `docs/state/blockers.md` — what's stuck.
5. The narrow technical reference for the task at hand:
   - For persistence work: `docs/05-data-model.md`, `prisma/schema.prisma`,
     the specific `src/http/<route>.ts` you're migrating.
   - For CLI work: `docs/07-cli-spec.md`, the relevant UC doc.
   - For layer work: `eslint.config.js`, the route you're refactoring.

Do **not** re-read use case docs you have already loaded — `diagnose.sh`
prints content hashes for cached files so you can skip them.

## The TDD Loop (unchanged)

Every behavior change follows red → green → refactor with one commit per
phase. `scripts/verify-tdd.sh` enforces commit message shape. Goal 1 adds no
new commit type; reuse `red:`, `green:`, `refactor:`, `setup:`, `chore:`.

For UC-scoped changes, keep the existing `red: UC-XXX <description>` shape.
For cross-cutting work in goal 1, use a scope tag:

- `red(persist): <description>` / `green(persist): <description>`
- `red(cli): <description>` / `green(cli): <description>`
- `red(boot): <description>` / `green(boot): <description>`
- `refactor(layers): <description>`

## Recommended Order Of Attack

This is a hint, not a rule. `goals/1-runnable.next-task.sh` enforces this
order automatically, but you should understand the rationale:

1. **Bootable first.** Without `npm start` you cannot do persistence E2E or
   CLI E2E. Write a failing `scripts/check-bootable.sh` against `/healthz`,
   make it pass with a minimal `src/index.ts`. ~1 TDD cycle.
2. **Persistence next, route by route.** Add `prisma migrate dev` for SQLite
   (file URL — keep dev DB at `.state/dev.sqlite`, gitignored). Pick the
   lowest-numbered UC, write a failing persistence test (`tests/integration/
<route>-persists.test.ts` that creates an entity, restarts the server,
   re-reads), migrate that route to Prisma, delete its in-memory store.
   Repeat per route. The existing 207 E2E tests must stay green after every
   route migration.
3. **CLI scaffold.** Create `bin/run.js` and a minimal `src/cli/index.ts`
   oclif root command. Make `npx vspec --help` exit 0. Then add subcommands
   one UC at a time, with CLI E2E covering the main success scenario.
4. **Layer extraction last.** Once persistence and CLI exist, extract
   business logic out of `src/http/*-routes.ts` into `src/application/`. Add
   the `eslint-plugin-boundaries` configuration. This is the riskiest step
   and benefits from having everything already working.

## Completion Check

At the end of each iteration:

```
bash scripts/completion-check.sh
```

This runs **every** goal's `.gates.sh` in numeric order and writes the active
goal pointer to `.state/active-goal`. Exit 0 only when every gate of every
goal passes — at that point, the next goal file (if any) becomes active, or
"ALL_DONE" is recorded.

## Forbidden Actions (additive to goal 0)

All of goal 0's forbidden actions still apply. Goal 1 adds:

- Marking a UC as "migrated to Prisma" without deleting the corresponding
  in-memory `Map`/`Record` from `src/http/`.
- Pushing a commit where `goals/0-init.gates.sh` fails. Goal 0 must remain
  green throughout the migration.
- Adding `process.env.SKIP_PERSISTENCE` or any environment flag that bypasses
  the database during tests. Tests must use the real adapter (SQLite in a
  temp directory is fine).
- Creating CLI commands that print canned output for tests. Each subcommand
  must perform a real HTTP call and render the real response.

## Now Begin

Run: `bash scripts/diagnose.sh`
