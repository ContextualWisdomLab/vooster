# Goal 3: Make vspec ride a managed Postgres

## Why This Goal Exists

Goal 2's gates went green, but inspection found the deploy story rests on
two assumptions that quietly disagree:

1. **The schema is SQLite, the deploy is Postgres.**
   `prisma/schema.prisma` declares `provider = "sqlite"`, while
   `docker-compose.prod.yml` injects a `postgresql://` URL. Prisma
   resolves the provider from the schema at runtime, so the prod stack
   only works because `check-deployable.sh` exercises `signup-start`,
   which writes nothing to the database. Any real DB write (the
   `/callback` step, every UC after that) would explode with a
   provider/URL mismatch.
2. **Tests are unwilling to ride Postgres at all.** Every test that
   boots a server passes a `file:${tmp}/something.sqlite` URL
   (`tests/e2e-cli/helpers.ts`, all twenty cases in
   `tests/integration/persistence-matrix.test.ts`, plus the two bash
   gates `check-bootable.sh` and `check-persistence.sh`). The persistence
   matrix's whole purpose is to prove restart survival, but it can only
   prove it against SQLite — the engine production users will never see.

Goal 3 closes both gaps so vspec runs on a managed Postgres (RDS / Neon /
Supabase / managed Postgres on any cloud) **and** every gate proves
restart survival against the same engine. The gate script
`goals/3-managed-db.gates.sh` enumerates every test file, every config
file, and every Prisma model from a source of truth — you cannot pass by
fixing one example.

## The Goal

vspec runs on Postgres end-to-end such that **every** condition below
holds. The gate script iterates each universal claim; hardcoding a single
case will not satisfy it.

### Tranche A — Test infrastructure rides Postgres

A1. **A single helper owns Postgres test isolation.**
`tests/helpers/postgres-db.ts` exports a function (e.g.,
`withTestDatabase()` or `createTestSchema()`) that allocates a unique
Postgres schema (`?schema=test_<uuid>`), runs
`prisma db push --skip-generate` against it, and exposes both the
DATABASE_URL and a teardown that drops the schema. The helper is the
only place in `tests/` that constructs a `DATABASE_URL`.

A2. **No `file:` URL survives in `tests/`.**
`grep -rE 'file:[^ "]*\.sqlite' tests/` returns zero lines. The grep
enumerates the whole directory; this gate cannot pass by editing one
file.

A3. **`tests/e2e-cli/helpers.ts` uses A1.**
`startNetworkServer` (and any sibling) calls into
`tests/helpers/postgres-db.ts`. The thirty-five CLI E2E files inherit
this without modification. _(The "test passes" half is enforced by
`goals/_meta.md` M.3; this goal's gate enumerates the helper import
and helper file presence only.)_

A4. **`tests/integration/persistence-matrix.test.ts` uses A1.**
Every model stanza in the matrix calls the helper rather than building
a `file:` URL. The test still enumerates every model from
`prisma/schema.prisma` (Goal 2.A4 unchanged), but now restart survival
is proven against Postgres. _(The "test passes" half is enforced by
`goals/_meta.md` M.3; this goal's gate enumerates per-model references
and helper routing only.)_

A5. **Every other server-spawning test routes through A1.** Enumerated:
any file under `tests/` that contains both `spawn(` and `DATABASE_URL`
must reference the helper (`grep -l postgres-db`). No file in this set
is allowed to build its own DATABASE_URL.

### Tranche B — Production schema is Postgres

B1. **`prisma/schema.prisma` declares Postgres.**
`provider = "postgresql"`. The string `"sqlite"` no longer appears in
`prisma/`, `src/`, `scripts/`, `docker-compose*.yml`, `package.json`,
or `.env.example`. The gate greps each directory; one hit fails the
gate.

B2. **`.env.example`, `package.json`, and `docker-compose*.yml` agree on
Postgres.** `scripts/check-db-consistency.sh` (Goal 2.B2) still
passes, with the rule "Postgres for prod _and_ tests; SQLite forbidden"
instead of "Postgres for prod, SQLite for tests." The check script
itself is updated; the new version refuses to accept any `file:` URL
in `.env.example`.

B3. **The Docker image applies migrations on startup.**
`Dockerfile`'s runtime stage runs
`prisma db push --skip-generate` (or equivalent) before
`node dist/src/index.js`, so a fresh managed Postgres becomes usable
without any manual step. `scripts/check-deployable.sh` (existing) is
extended to write through the database — it must call `/callback`,
not just `/start`, so the gate proves the running container can
actually persist.

B4. **The production compose accepts an external `DATABASE_URL`.**
`docker-compose.prod.yml` uses `${DATABASE_URL:-...}` substitution so
that operators on managed Postgres can drop the embedded `db` service
entirely. `scripts/check-managed-db.sh` is a new gate: it boots the
`app` container against an externally-supplied Postgres (a separate
docker network, mimicking a managed provider), runs the full signup
roundtrip including `/callback`, and tears down. The gate is what
proves the deploy works without compose's bundled `db`.

### Tranche C — CI runs the suite against Postgres

C1. **A CI workflow file exists** at `.github/workflows/ci.yml` (or
`ci.yaml`). It runs on `push` and `pull_request` against `main`.

C2. **The workflow declares a Postgres service** — a `services:`
block (or runtime equivalent) named `postgres` using
`postgres:16-alpine`, with a healthcheck. `DATABASE_URL` is wired
into the test job's env.

C3. **The workflow runs the full suite.** At minimum:
`npm ci` (or equivalent), `npm run lint`, `npm run typecheck`,
`npm test`, and `bash scripts/completion-check.sh`. Any of these
failing must fail the workflow.

C4. **The workflow file is parseable YAML.** `scripts/check-ci.sh`
(new) runs `yq` or `python -c "import yaml; yaml.safe_load(...)"`
against every workflow file in `.github/workflows/` and refuses to
pass on a parse error or on a workflow that doesn't reference both
`postgres` and `completion-check.sh`.

### Tranche D — Meta: no regression and gate rigor

D1. `goals/0-init.gates.sh` still passes.
D2. `goals/1-runnable.gates.sh` still passes, now against Postgres.
D3. `goals/2-shippable.gates.sh` still passes, now against Postgres.
D4. `scripts/check-gate-rigor.sh` passes — the active goal's gate file
iterates whenever its markdown contains "every X" language.

## Scope Guards

Same as Goals 0–2 plus:

- **No SQLite fallback for "test convenience."** You may not keep a
  `file:` code path alive behind an env flag. If a test wants a cheap DB,
  it goes through the schema-per-test helper, period. The grep that
  enforces B1 cannot be appeased by adding `// sqlite` as a literal
  string in a comment — the regex matches the bare token in any context.
- **No goal-2 narrowing.** `scripts/check-persistence.sh`,
  `check-deployable.sh`, `check-db-consistency.sh`, `check-bootable.sh`,
  `check-cli.sh`, and the gate scripts for Goals 0/1/2 must remain
  _unchanged or strengthened_. You may rewrite a script to require
  Postgres; you may not weaken any existing assertion.
- **No "single-schema" cheat in tests.** The helper in A1 must allocate a
  unique schema per call (cuid, uuid, ts+pid — implementer's choice).
  Tests that share a schema are forbidden because they mask cleanup bugs
  and break Vitest's parallel runner. The gate checks this by spotting
  whether the helper takes a "name" parameter that is constant across
  calls in a single file.
- **No skipping migrations at container boot.** The Dockerfile may not
  rely on the operator running `prisma db push` by hand. The image must
  be self-sufficient against an empty Postgres.
- **No "shadow" managed-db gate.** `check-managed-db.sh` must boot the
  app against a Postgres that is _not_ the one declared in
  `docker-compose.prod.yml`'s embedded `db` service. The gate's whole
  point is to prove the prod path works without that embedded service.
- **No hardcoded entity lists in gate scripts.** Enumerate models from
  `prisma/schema.prisma`, files from `find`, tests from `find tests/`.
  Goal 2 banned this; Goal 3 keeps the ban.

## Mandatory First Step (every iteration)

```
bash scripts/diagnose.sh
```

`diagnose.sh` is extended in this goal to print "Goal 3 coverage" —
how many tests still reference `file:`, whether the Prisma provider has
flipped, whether the CI workflow exists. You can see progress without
re-running the full gate.

## Mandatory Reading Order

1. `AGENTS.md` — TDD protocol.
2. `goals/3-managed-db.md` — this file.
3. `docs/state/next-task.md` — what to do this iteration.
4. `docs/state/blockers.md` — what's stuck.
5. Narrow technical reference for the task at hand:
   - Test-infra work: `tests/e2e-cli/helpers.ts`,
     `tests/integration/persistence-matrix.test.ts`, the Prisma docs
     section on connection-string `?schema=` parameter.
   - Schema work: `prisma/schema.prisma`, `.env.example`,
     `docker-compose.prod.yml`.
   - Deploy work: `Dockerfile`, `scripts/check-deployable.sh`,
     `scripts/check-managed-db.sh` (new).
   - CI work: `.github/workflows/ci.yml`, the GitHub Actions service
     containers reference.

## Recommended Order of Attack

`goals/3-managed-db.next-task.sh` enforces this order. Rationale:

1. **Test helper first.** Author `tests/helpers/postgres-db.ts`. Write
   it against a _real_ local Postgres (the `db` service in
   `docker-compose.yml` is fine). Add one passing usage from a small
   integration test before touching the existing 55+ tests. ~1 TDD cycle.
2. **Switch the noisiest consumers next.**
   `tests/e2e-cli/helpers.ts:22` and the persistence matrix together
   cover ~55 of the ~57 failing tests. One commit each. The bash gates
   (`check-bootable.sh`, `check-persistence.sh`) follow the same shape.
3. **Schema and config last.** Flip `prisma/schema.prisma` to
   `postgresql`, update `.env.example`, `package.json`, and
   `docker-compose.prod.yml`. Update `Dockerfile` to run migrations on
   boot. By now every test that boots a server already builds its own
   schema, so this flip should be near-zero noise.
4. **CI workflow.** Drop in `.github/workflows/ci.yml` with a
   `postgres:16-alpine` service and the standard `npm` steps. Verify
   with `act` locally or by pushing a throwaway branch.

Test infra is first because you cannot prove the schema flip works
without a Postgres-shaped test bed. CI is last because it's the cheapest
piece once everything underneath is green.

## The TDD Loop (unchanged)

Every behavior change follows red → green → refactor with one commit per
phase. `scripts/verify-tdd.sh` enforces commit message shape. Goal 3 adds
no new commit type. For cross-cutting work, reuse scope tags:

- `red(testdb): <description>` / `green(testdb): <description>`
- `red(pgschema): <description>` / `green(pgschema): <description>`
- `red(deploy): <description>` / `green(deploy): <description>`
- `red(ci): <description>` / `green(ci): <description>`

## Forbidden Actions (additive to Goals 0–2)

- Writing a Goal 3 gate that checks one test, one file, or one workflow
  when the goal text says "every." Gates must iterate.
- Re-introducing `file:` URLs anywhere outside the schema-per-test
  helper itself (which constructs no `file:` URL — only a
  `postgresql://...?schema=` URL).
- Skipping `npm test` or `completion-check.sh` in CI because "it's slow."
  Slow gates are not a license to weaken them.
- Hardcoding `postgres://vspec:vspec@db:5432/vspec` in
  `docker-compose.prod.yml` such that an external `DATABASE_URL` cannot
  override it. The compose file must use `${DATABASE_URL:-...}`.
- Mocking the Postgres client in any test. The whole reason for this
  goal is to stop pretending — every test must hit a real Postgres
  schema.
- Skipping `scripts/check-gate-rigor.sh` before declaring this goal
  done.

## Completion Check

At the end of each iteration:

```
bash scripts/completion-check.sh
```

Exit 0 only when goals 0, 1, 2, and 3 all pass their gates.

## Now Begin

Run: `bash scripts/diagnose.sh`
