# Goal 4: Make the layered architecture true, not aspirational

## Why This Goal Exists

Goal 2 declared a layered architecture (`docs/01-architecture.md`,
`AGENTS.md:127-145`) and Goal 2's boundary tranche added an ESLint
`boundaries` plugin. Independent review of the codebase as of
`91755b9 docs(state): refresh managed-db completion state` finds three
load-bearing claims that are quietly false.

1. **The "block upward imports" gate is fake green.**
   `tests/unit/boundaries-config.test.ts` only `readFileSync`s
   `eslint.config.js` and regex-matches the rule text. It never runs
   ESLint, so it cannot tell whether any actual import would be blocked.
   Meanwhile **81 files** under `src/ports/`, `src/infrastructure/`, and
   `src/application/` still `import` from `../http/`:
   ```
   $ grep -l 'from "../http/' src/ports/*.ts src/infrastructure/*.ts \
       src/application/*.ts | wc -l
   81
   ```
   The gate passes because it asks the wrong question. This is exactly
   the "narrow-gate cheat" that `scripts/check-gate-rigor.sh` was
   created to prevent (`AGENTS.md:252-281`).

2. **The dependency arrow runs backwards.**
   Every `Stored<Entity>` type — `StoredProject`, `StoredUseCase`,
   `StoredActor`, every one of them — lives in
   `src/http/signup-types.ts`. `src/ports/*.ts` and
   `src/infrastructure/prisma-signup-store.ts` both `import` those
   types *from the HTTP layer*. In a layered architecture, HTTP is
   supposed to be the outermost ring; here it owns the canonical
   entity vocabulary that every other ring depends on. Moving an HTTP
   file reshapes the whole system.

3. **Two god files violate the project's own size rule.**
   `AGENTS.md:127` says *"Keep files under 200 lines, functions under
   20 lines."* Today:
   - `src/cli/index.ts` is **3,306 lines** — one class, one
     `run()` method, a chain of 30+ `if (parsed.args.command === …)`
     branches that hand-roll the routing oclif was built to do.
   - `src/infrastructure/prisma-signup-store.ts` is **1,811 lines** —
     one class implementing 19 separate `Store` interfaces with 91
     methods. The corresponding in-memory adapters are already split
     into nineteen ~40-line files; only the Prisma side never got
     decomposed.

   Files this size make every change a merge-conflict magnet — the
   exact opposite of what the *"6+ concurrent AI coding agents"* pitch
   in `package.json` promises.

Goal 4 closes all three gaps. The gate script
`goals/4-honest-boundaries.gates.sh` enumerates every file that could
violate each rule from a source of truth (`find`, `grep` over
`prisma/schema.prisma`, `ls src/ports/`). You cannot pass this goal by
fixing one example.

## The Goal

The layered architecture in `docs/01-architecture.md` is enforced by
running tools (ESLint, file-size scans), not by hand-edited config
strings. **Every** condition below holds. The gate script iterates each
universal claim; hardcoding a single case will not satisfy it.

### Tranche A — Boundaries are enforced by ESLint, not by string matching

A1. **The fake boundary test is gone.**
    `tests/unit/boundaries-config.test.ts` no longer exists, or has been
    rewritten so it does not `readFileSync` ESLint/TS config and
    regex-match the contents. The gate fails if any test file under
    `tests/` both reads `eslint.config.js`/`tsconfig.json`/`package.json`
    *and* asserts on its raw string contents. The grep iterates every
    test file.

A2. **ESLint passes with zero violations.**
    `npx eslint . --max-warnings 0` exits 0. *(This is enforced by
    `goals/_meta.md` M.2; this goal's gate does not re-run ESLint, so the
    same lint pass that proves M.2 also proves A2.)*

A3. **`boundaries/element-types` is deny-by-default.**
    `eslint.config.js` sets `default: "disallow"`. Every allowed
    cross-layer edge is then listed explicitly. The gate greps for
    `default:\s*"disallow"` in the rule body. `default: "allow"` fails
    the gate.

A4. **The explicit allow-list is the architecture from
    `docs/01-architecture.md`.** The configured rules must permit
    *exactly* these arrows and no others:
    - `cli → http, application, ports, domain`
    - `http → application, ports, domain`
    - `application → ports, domain`
    - `infrastructure → ports, domain`
    - `ports → domain`
    - `domain → (nothing)`

    The gate iterates every required arrow against the allow-list in
    `eslint.config.js` and fails on any drift from the architecture
    text. (A4 is the static-config half; A5 below proves the rule
    actually fires.)

A5. **The configured boundary rule actually fires at lint time.**
    A separate `node` process drives ESLint through its Node API and
    lints two fixture files — one forbidden upward import
    (`ports → http`) and one allowed architecture arrow
    (`cli → application`). The `boundaries/element-types` rule must
    produce exactly one error on the forbidden fixture and zero on
    the allowed one. This catches the failure mode where A4's text
    matches but the rule itself is misconfigured. ESLint runs
    out-of-band of vitest so the TypeScript Project build does not
    compete with test workers — the previous unit-test version of
    this check (`apps/api/tests/unit/boundaries-config.test.ts`)
    timed out under CI load for exactly that reason.

### Tranche B — Domain owns the entity vocabulary

B1. **`src/domain/entities/` exists and is the home of every
    `Stored<Model>` type.** For every model in `prisma/schema.prisma`,
    a `type Stored<Model> = …` must be declared in some file under
    `src/domain/`. The gate enumerates models with
    `grep '^model ' prisma/schema.prisma | awk '{print $2}'` and
    refuses to pass if any one is undeclared in `src/domain/`. There is
    no whitelist; new models added to Prisma must show up in domain
    automatically.

B2. **`src/http/signup-types.ts` no longer exports `Stored*` types.**
    `grep -E '^export (type|interface) Stored' src/http/*.ts` returns
    zero lines. The gate scans every file under `src/http/`, not just
    `signup-types.ts`, so the cheat of "rename the file" doesn't
    work.

B3. **Zero upward imports from inner layers to HTTP.** For every file
    under `src/ports/`, `src/application/`, and `src/infrastructure/`,
    `grep -E 'from "(\.\./|\.\.\/.+/)http/' ` returns zero hits. The
    gate enumerates every file in each directory; it doesn't sample.
    Pair this with A2 — the lint rule catches drift, this gate
    catches the migration.

B4. **The domain layer imports nothing from the rest of `src/`.**
    `grep -rE 'from "(\.\.\/cli|\.\.\/http|\.\.\/application|\.\.\/ports|\.\.\/infrastructure)/' src/domain/`
    returns zero lines. The domain is leaf in the dependency graph.
    (This generalizes the rule the ESLint `domain` allow-list from
    Goal 2 set, and removes that rule's no-op status.)

### Tranche C — No god files

C1. **No file under `src/` exceeds 1,000 lines.**
    The gate runs `find src -name '*.ts' -exec wc -l {} +` and fails on
    any file over 1,000 lines. Source of truth = the filesystem. The
    1,000-line cap is a generous interpretation of `AGENTS.md`'s
    200-line guideline; it is a hard ceiling, not a target. Two files
    are over today:
    - `src/cli/index.ts` (3,306)
    - `src/infrastructure/prisma-signup-store.ts` (1,811)

    *How* you split them is up to you, but the canonical approaches
    are listed under Recommended Order of Attack.

C2. **There is one Prisma store per port, not one for all of them.**
    For every file under `src/ports/`, there must be a corresponding
    Prisma adapter file under `src/infrastructure/`. The gate
    enumerates: for each `src/ports/<name>-store.ts`, a file matching
    `src/infrastructure/prisma-<name>-store.ts` must exist. The
    `signup-store.ts` port is allowed to map to a different filename
    pattern (e.g., `prisma-signup-flow.ts`) because the SignupStore
    god intersection itself must dissolve — the in-memory adapters
    already prove the per-port pattern works.

C3. **The CLI is split per command.** `src/cli/commands/` exists and
    holds one file per top-level subcommand. The gate enumerates every
    distinct first-word subcommand the CLI advertises today
    (`grep -oE '"vspec [a-z][a-z-]+' src/http/ -r | sort -u` is one
    source; the existing inventory in `src/cli/index.ts` is another).
    For each, a file in `src/cli/commands/` must export an oclif
    `Command` subclass. The monolithic `if (parsed.args.command === …)`
    chain is gone.

### Tranche D — Meta: honest gates and no regression

D1. **`scripts/check-honest-gates.sh` exists and passes.**
    A new meta-gate. It enumerates every test file under `tests/`. If a
    test file both (a) reads a config file
    (`eslint.config.js`, `tsconfig.json`, `package.json`,
    `prisma/schema.prisma`, `docker-compose*.yml`) via `readFileSync`
    *and* (b) asserts on the raw string contents (`toMatch`, `toContain`
    on the file body), the test is presumed dishonest and the gate
    fails. The script is conservative: tests that read these files but
    assert on parsed structure (`JSON.parse`, `yaml.safe_load`,
    invoking ESLint as a library) are allowed.

    This generalizes the lesson from
    `tests/unit/boundaries-config.test.ts`. The previous goal's
    `check-gate-rigor.sh` catches universal-claim/non-iterating
    *gates*; this catches dishonest *tests*.

D2. `goals/0-init.gates.sh` still passes.
D3. `goals/1-runnable.gates.sh` still passes.
D4. `goals/2-shippable.gates.sh` still passes.
D5. `goals/3-managed-db.gates.sh` still passes.
D6. `scripts/check-gate-rigor.sh goals/4-honest-boundaries.md` passes.

## Scope Guards

Same as Goals 0–3 plus:

- **No new file-content-grep tests.** The whole reason this goal
  exists is that Goal 2 shipped one. Any new test under `tests/` that
  asserts on the raw text of a config file is forbidden. D1 enforces
  this; do not loosen the enforcer by adding allow-lists.
- **No "transitional" `Stored*` re-exports from `src/http/`.** Once
  the types live in `src/domain/`, the old declarations are deleted,
  not turned into `export type { StoredX } from "../domain/…"`.
  Re-exports defeat B2 because the symbol still appears under
  `src/http/`.
- **No `eslint-disable boundaries/element-types`.** If the lint rule
  rejects an import, the import is wrong. Suppressing the rule on a
  line, file, or directory basis is forbidden; the gate `grep`s for
  the disable directive across `src/`.
- **No carve-out from C1 for "this one file is unavoidably long."**
  A 1,200-line file that imports `Command` subclasses is still a
  god file; split it. The cap is mechanical.
- **No new use of `serverOptions.signupStore ?? createMemoryX()` in
  `src/http/server.ts`.** The 19-fold repetition there is a symptom
  of the `SignupStore` god intersection. As C2 makes per-port Prisma
  adapters real, `server.ts` must wire each store independently.
  ESLint A2 will not flag this on its own; treat it as a refactor
  obligation tracked under C2.
- **No oclif `strict = false` workaround.** If a command needs
  positional arguments, declare them on its `Command` subclass.
- **No hardcoded entity lists in gate scripts.** Enumerate models
  from `prisma/schema.prisma`, files from `find`, ports from
  `ls src/ports/`.

## Mandatory First Step (every iteration)

```
bash scripts/diagnose.sh
```

`diagnose.sh` is extended in this goal to print "Goal 4 coverage":
how many ports/infrastructure/application files still import from
`../http/`, whether the domain entity index is complete, whether ESLint
is green, and which files are still over the 1,000-line cap. You see
progress without re-running the full gate.

## Mandatory Reading Order

1. `AGENTS.md` — TDD protocol + the "200 lines" rule.
2. `docs/01-architecture.md` — the arrows you are encoding into A4.
3. `goals/4-honest-boundaries.md` — this file.
4. `docs/state/next-task.md` — what to do this iteration.
5. `docs/state/blockers.md` — what's stuck.
6. Narrow technical reference for the task at hand:
   - Tranche A: `eslint.config.js`, `eslint-plugin-boundaries` README,
     `tests/unit/boundaries-config.test.ts` (the file you're deleting).
   - Tranche B: `src/http/signup-types.ts`, `src/ports/*.ts`,
     `prisma/schema.prisma`.
   - Tranche C1/C2: `src/infrastructure/prisma-signup-store.ts`
     + the 19 sibling `memory-*-store.ts` files as the template.
   - Tranche C3: `@oclif/core` topics + multi-command docs, the
     current `src/cli/index.ts`.

## Recommended Order of Attack

`goals/4-honest-boundaries.next-task.sh` enforces this order. Rationale:

1. **Real lint test first (A1 + A2).** Delete
   `tests/unit/boundaries-config.test.ts`. Replace it with a test that
   invokes ESLint programmatically over a tiny fixture
   (`tests/fixtures/boundary-cases/`) and asserts that a `ports → http`
   import is rejected and a `cli → application` import is accepted.
   This is RED today because the lint rules don't actually forbid the
   import yet. Commit RED, then make GREEN by tightening the rules in
   A3/A4. The 81 violating files will go red on `npm run lint` — that
   red is the honest signal that should have existed from the start.

2. **Mechanical type relocation (B1 + B2 + B3).** Create
   `src/domain/entities/index.ts`. Move every `Stored<Model>` type out
   of `src/http/signup-types.ts` into a file per entity under
   `src/domain/entities/`. Rewrite the 81 violating imports with a
   single `find … -exec sed` invocation; review the diff in chunks.
   ESLint goes green when B3 is fully satisfied.

3. **Per-port Prisma adapters (C2).** Use the in-memory adapters as
   the structural template: `prisma-actor-store.ts`,
   `prisma-branch-store.ts`, etc. Each receives a `PrismaClient`
   instance. `prisma-signup-store.ts` shrinks to the cross-cutting
   `saveSignup`/`saveProjectWithDefaultBranch` flow, or is deleted
   entirely if those move to a `signup` application service.
   `src/http/server.ts` wires each store independently — the
   19-fold `?? createMemoryX()` smell vanishes.

4. **CLI split (C3).** Generate the command list from the existing
   `if (parsed.args.command === …)` chain. For each, author a file
   under `src/cli/commands/` that extends `Command` and registers
   flags. `src/cli/index.ts` becomes a thin entry that delegates to
   oclif's topic routing.

5. **Meta gate last (D1).** Once the codebase is honest, ship the
   meta-gate that prevents the next fake-green test from landing.

Real lint enforcement is first because it is the smallest piece of
real verification — once it exists, every subsequent change has a
truthful gate behind it. CLI split is last because it is the largest
mechanical job and benefits from the boundaries already being tight.

## The TDD Loop (unchanged)

Every behavior change follows red → green → refactor with one commit
per phase. `scripts/verify-tdd.sh` enforces commit message shape. For
cross-cutting work, reuse scope tags:

- `red(boundaries): <description>` / `green(boundaries): <description>`
- `red(domain): <description>` / `green(domain): <description>`
- `red(prisma-split): <description>` / `green(prisma-split): <description>`
- `red(cli-split): <description>` / `green(cli-split): <description>`
- `red(honest-gates): <description>` / `green(honest-gates): <description>`

## Forbidden Actions (additive to Goals 0–3)

- Writing a Goal 4 test that `readFileSync`s a config file and asserts
  on its string contents. D1 catches this; do not silence D1.
- Re-introducing any `Stored*` declaration under `src/http/` once it
  has moved to `src/domain/`. Re-exports count.
- Adding `// eslint-disable-next-line boundaries/element-types` (or
  block/file variants) anywhere in `src/`.
- Keeping `prisma-signup-store.ts` over 1,000 lines after C2 is
  declared green. If the file dropped to 950 lines by extracting two
  methods, the goal is not satisfied — C2 demands per-port files, not
  shaving.
- Replacing the `cli/index.ts` `if`-chain with a `switch` and claiming
  C3 is satisfied. C3 demands per-command files.
- Skipping `scripts/check-honest-gates.sh` or `check-gate-rigor.sh`
  before declaring this goal done.

## Completion Check

At the end of each iteration:

```
bash scripts/completion-check.sh
```

Exit 0 only when goals 0, 1, 2, 3, and 4 all pass their gates.

## Now Begin

Run: `bash scripts/diagnose.sh`
