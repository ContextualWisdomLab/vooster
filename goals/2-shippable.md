# Goal 2: Make vspec actually shippable

## Why This Goal Exists

Goal 1's gates went green, but inspection found three structural debts the
gates failed to detect:

1. **Persistence is mostly fake.** Of the 18 Prisma models defined in
   `prisma/schema.prisma`, only 3 (User, Workspace, Membership) are actually
   read from / written to the database. The remaining 15 — projects, use
   cases, scenarios, steps, branches, sessions, revisions, comments, locks,
   API keys, merge requests, stakeholders, actors, goals, stakeholder
   interests — still live in `SignupState`'s in-memory Maps in
   `src/http/signup-types.ts`. The persistence gate passed because
   `scripts/check-persistence.sh` only verified one workspace slug across
   one restart.
2. **Auth is stub-only.** `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` appear
   in `.env.example` but are referenced nowhere in `src/`. Production
   signup is impossible; only `VSPEC_AUTH_STUB=1` works.
3. **The "layered" architecture is cosmetic.** `src/application/` and
   `src/domain/` contain one file each. ~60 files of business logic remain
   inside `src/http/*-routes.ts`. The layer gate passed because it checks
   "directory is non-empty" rather than "logic actually moved."

Goal 2 closes all three gaps **with gates that enumerate the goal's nouns
rather than sample one**, so the same narrow-gate cheat cannot recur.

## The Goal

vspec is shippable to external users such that **every** condition below
holds. The gate script `goals/2-shippable.gates.sh` enumerates each
universal claim from a source of truth — you cannot pass by addressing one
example.

### Tranche A — Persistence is complete

A1. **No entity state lives in `SignupState`** other than the whitelisted
    ephemera (`pendingOAuth`, `sessionsByToken`, `readOnlyMemberships`).
    Every other `Map`/`Set` field in `src/http/signup-types.ts` is deleted
    in the same commit that migrates it.

A2. **No route reads or writes in-memory entity state.** A grep over
    `src/http/*-routes.ts` for `state.<entityMap>` returns zero lines for
    every non-whitelisted entity name.

A3. **Every Prisma model in `schema.prisma` is exercised by an adapter in
    `src/infrastructure/`.** For each `model X` declaration, there is at
    least one `prisma.<x>.` call inside `src/infrastructure/`. Enumerated
    from `prisma/schema.prisma`, not hardcoded.

A4. **Restart survival is proven per entity.**
    `tests/integration/persistence-matrix.test.ts` boots the server,
    creates one instance of every Prisma model via the **public HTTP API**,
    sends `SIGTERM`, restarts against the same DB file, and asserts every
    instance is still readable. The test references every model name; you
    cannot pass A4 by persisting only some models.

### Tranche B — Real auth + reproducible deploy

B1. **GitHub OAuth works without the stub.** With `VSPEC_AUTH_STUB` unset
    and `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` provided,
    `tests/e2e/UC-001-real-oauth.test.ts` completes signup by intercepting
    GitHub's token + user endpoints (via `undici` `MockAgent` or
    equivalent). `grep -rq 'GITHUB_CLIENT_ID' src/` returns nonzero — the
    secret is read by real code, not just documented in `.env.example`.

B2. **DB configuration is consistent across files.** `prisma/schema.prisma`,
    `.env.example`, `package.json`, and `docker-compose*.yml` all agree on
    `DATABASE_URL` shape. `scripts/check-db-consistency.sh` verifies the
    alignment: Postgres for prod, SQLite only for tests.

B3. **App is deployable via Docker.** `Dockerfile` (multi-stage, Node 20
    runtime) builds successfully. `docker-compose.prod.yml` brings up the
    app + Postgres. `scripts/check-deployable.sh` builds the image, starts
    the stack, polls `/healthz`, executes one signup roundtrip from
    outside the container, and tears the stack down cleanly.

B4. **User-facing README exists.** `README.md` has top-level sections
    `## Install`, `## Run`, and `## Deploy`, each with copy-pasteable
    commands that work on a fresh machine. The autonomous-build-harness
    content moves to `docs/build-harness.md`, cross-linked from README.

### Tranche C — Layers are real, not cosmetic

C1. **Routes are thin.** Every file matching `src/http/*-routes.ts` is
    ≤ 150 lines. Validation/parsing stays in the route; business logic
    does not.

C2. **`src/application/` has substance.** At least 18 modules under
    `src/application/` (≈ one per Prisma model area). Each contains
    use-case functions consumed by routes via direct import.

C3. **Application logic is unit-tested.** `tests/unit/application/`
    contains at least 18 `*.test.ts` files. These tests exercise
    application functions without booting Fastify (no `createServer`, no
    HTTP).

C4. **Boundaries are enforced upward, not just downward.** The
    `eslint-plugin-boundaries` config forbids adapter layers from
    directly importing `infrastructure`. Routes go through
    `application`; CLI goes through the explicit architecture arrows.

### Tranche D — Meta: no regression and gate rigor

D1. `goals/0-init.gates.sh` still passes.
D2. `goals/1-runnable.gates.sh` still passes.
D3. `scripts/check-gate-rigor.sh` passes — the active goal's `.gates.sh`
    iterates whenever its markdown contains "every X" language.

## Scope Guards

Same as Goal 1 plus:

- **No "shadow writes."** You may not keep both an in-memory `Map` and a
  Prisma table alive for the same entity. The migration commit deletes
  the Map.
- **No goal-1 narrowing.** `scripts/check-persistence.sh`, `check-bootable.sh`,
  `check-cli.sh`, `check-layers.sh`, and the gate scripts for Goal 0/1
  must remain *unchanged or strengthened*. You may add new gate scripts;
  you may not weaken old ones.
- **No "test-side seeding."** `persistence-matrix.test.ts` creates
  entities via the public HTTP API. Direct Prisma inserts in that test
  are forbidden — they would mask the case where the route still writes
  in-memory only.
- **No removing entities from the matrix to make the test pass.** If a
  Prisma model genuinely should not be persisted (e.g., an ephemeral
  cache table), delete the model from `schema.prisma` in the same commit
  and the entity-list grep above will stop demanding it.
- **No hardcoded entity lists in gate scripts.** Enumerate from
  `prisma/schema.prisma` or `docs/usecases/UC-*.md`. If you find
  yourself typing entity names into a gate, you are recreating the
  narrow-gate cheat that Goal 1 fell into.

## Mandatory First Step (every iteration)

```
bash scripts/diagnose.sh
```

`diagnose.sh` is extended in this goal to print "Goal 2 coverage" — how
many Prisma models have adapter usage, how many route files exceed 150
lines, etc. You can see progress without re-running the full gate.

## Mandatory Reading Order

1. `AGENTS.md` — TDD protocol (note the new **Designing Gates** section).
2. `goals/2-shippable.md` — this file.
3. `docs/state/next-task.md` — what to do this iteration.
4. `docs/state/blockers.md` — what's stuck.
5. Narrow technical reference for the task at hand:
   - Persistence work: `prisma/schema.prisma`, `docs/05-data-model.md`,
     the specific `src/http/<route>.ts` you're migrating.
   - OAuth work: `src/http/signup-routes.ts`,
     `docs/usecases/UC-001-signup.md`.
   - Deploy work: `package.json`, `docker-compose.yml`.
   - Layer work: `eslint.config.js`, the route you're refactoring.

## Recommended Order of Attack

`goals/2-shippable.next-task.sh` enforces this order. Rationale:

1. **Persistence first, model by model.** Pick the next non-whitelisted
   field in `SignupState`, write a failing entry in
   `persistence-matrix.test.ts`, migrate the corresponding route(s),
   delete the Map field in the same commit. Repeat until A1–A4 green.
   ~1 TDD cycle per model.
2. **Real auth.** Add `tests/e2e/UC-001-real-oauth.test.ts` (RED), wire
   `undici` MockAgent for the GitHub token+user endpoints, implement the
   non-stub branch in `signup-routes.ts`. ~2-3 TDD cycles.
3. **Deployable.** Author `Dockerfile`, `docker-compose.prod.yml`, and
   rewrite `README.md` for end users. Move harness docs to
   `docs/build-harness.md`.
4. **Layers last.** Once persistence is real and routes already touch
   adapters, extract per-route business logic into `src/application/`.
   This is the largest mechanical refactor; do it after persistence so
   adapter interfaces are stable.

Layers are last because moving logic across files while the persistence
contract is still shifting underneath wastes iterations.

## The TDD Loop (unchanged)

Every behavior change follows red → green → refactor with one commit per
phase. `scripts/verify-tdd.sh` enforces commit message shape. Goal 2 adds
no new commit type. For cross-cutting work, reuse scope tags:

- `red(persist): <entity>` / `green(persist): <entity>`
- `red(auth): <description>` / `green(auth): <description>`
- `red(deploy): <description>` / `green(deploy): <description>`
- `refactor(layers): <description>`

## Forbidden Actions (additive to Goals 0 and 1)

- Writing a Goal 2 gate that checks a single entity / single UC / single
  file when the goal text says "every." Gates must enumerate from the
  source of truth.
- Adding a new `Map` or `Set` field to `SignupState`. The whitelist
  cannot grow; only shrink.
- Re-introducing an in-memory shadow of a Prisma-backed entity for
  "performance" or "test convenience." If you want a cache, model it as
  a Prisma table or a port-and-adapter behind an explicit interface.
- Weakening `scripts/check-persistence.sh` (the goal-1 single-slug
  regression guard). Goal 2's `check-full-persistence` is the new bar;
  goal 1's check stays as a cheap smoke test.
- Skipping `scripts/check-gate-rigor.sh` before declaring this goal
  done. It is a meta-check that flags goal gates whose enumeration is
  weaker than the goal text claims.
- Stub-only "GitHub OAuth": writing a code path keyed on
  `GITHUB_CLIENT_ID` that never actually exchanges a code for a token.
  The UC-001-real-oauth test exercises the full token-exchange code
  path.

## Completion Check

At the end of each iteration:

```
bash scripts/completion-check.sh
```

Exit 0 only when goals 0, 1, and 2 all pass their gates.

## Now Begin

Run: `bash scripts/diagnose.sh`
