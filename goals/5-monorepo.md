# Goal 5: Monorepo (pnpm workspaces) with API, CLI, web app, and Astro landing

## Why This Goal Exists

Goals 0–4 shipped a single-package CLI + Fastify server with Prisma and
an enforceable layered architecture. Everything still lives in one
`package.json` managed by `npm`. To prepare for the marketing landing
page (and for future shared packages) the codebase moves to a
**pnpm workspaces monorepo** with four apps:

- `apps/api` — Fastify HTTP server + the inner layers
  (`domain`, `ports`, `application`, `infrastructure`, `http`) + Prisma
- `apps/cli` — the `vspec` oclif CLI (current `src/cli/` + `bin/run.js`)
- `apps/web` — a Next.js authenticated product UI for reading specs
- `apps/www` — a new Astro site that hosts the Korean landing page,
  modeled after https://www.conductor.build/ (hero → social-proof
  logos → features → workflow → showcase → pricing/CTA → footer)

Three load-bearing reasons:

1. **Different toolchains stop sharing one config tree.** Astro brings
   its own compiler, dev server, and Tailwind/PostCSS stack. Mixing it
   with the server's `tsc` + `vitest` + `tsx` setup at root is a
   configuration tangle waiting to happen.
2. **CLI and API need to import shared domain types without circular
   installs.** Workspaces make `@vooster/api`'s domain exports
   trivially consumable from `@vooster/cli`.
3. **One lockfile, one package manager.** `pnpm-lock.yaml`
   deterministically pins every workspace dependency. The legacy
   `package-lock.json` is removed; we do not run two package managers
   side-by-side.

Goal 5 closes the migration. The gate script
`goals/5-monorepo.gates.sh` enumerates the required apps and layers
from sources of truth (`pnpm-workspace.yaml`,
`find apps -maxdepth 1`). You cannot pass this goal by hand-fixing a
single example. Landing-page composition is deliberately left to the
www app's owners; only the existence of `apps/www/src/pages/index.astro`
and the Korean-copy sweep are enforced.

## The Goal

Every condition below holds. Gates iterate; a single example does not
satisfy them.

### Tranche A — Workspace skeleton

A1. **`pnpm-workspace.yaml` at the repo root declares `apps/*`.**
    The gate parses the YAML and asserts the `packages:` list contains
    `apps/*`. A `"workspaces"` field in `package.json` (npm-style) does
    not satisfy this gate.

A2. **The root `package.json` is a workspace root, not a deployable
    package.** It has `"private": true`, declares
    `"packageManager": "pnpm@<version>"`, and lists no runtime
    `dependencies`. The gate parses the JSON with `node -e`, not by
    string-matching.

A3. **`apps/` contains exactly four subdirectories: `api`, `cli`,
    `web`, `www`.** The gate enumerates `find apps -maxdepth 1 -mindepth 1
    -type d` and compares the sorted basenames against the required
    set. Extras fail just like omissions.

A4. **Every app has its own `package.json`** with `"name":
    "@vooster/<app>"` and `"private": true`. The gate iterates each
    app's manifest.

A5. **`pnpm-lock.yaml` is the only lockfile.** `package-lock.json`
    and `yarn.lock` are gone. The gate fails if any two lockfiles
    coexist.

A6. **`pnpm install` has been run.** `node_modules/.pnpm` exists at the
    repo root, proving pnpm — not npm — populated `node_modules`.

### Tranche B — API and CLI relocated

B1. **The legacy root directories `src/`, `bin/`, `prisma/`, `tests/`
    no longer exist at the repo root.** The gate iterates that list of
    legacy paths and fails on any survivor. Contents have moved into
    `apps/api/` and `apps/cli/`; nothing is duplicated.

B2. **`apps/api/src/` owns every API layer.** For every entry in
    `(domain, ports, application, infrastructure, http)`, the gate
    asserts `apps/api/src/<layer>/` is a directory.

B3. **`apps/api/prisma/schema.prisma` exists.** The schema moved with
    the API. The gate checks the file directly.

B4. **`apps/cli/` is a working CLI package**: `src/` plus
    `bin/run.js` exist, and `apps/cli/package.json` declares
    `"bin": { "vspec": "./bin/run.js" }`. The gate parses the
    manifest's `bin` field.

B5. **No file lives at both root `src/` and an `apps/<n>/src/`
    location.** This is enforced even though B1 already kills root
    `src/`; B5 catches the half-finished migration where one tree was
    copied but not deleted.

B6. **Every app declares standard scripts** — `build`, `test`,
    `typecheck`. The gate iterates the cartesian product of
    `(api, cli, web, www) × (build, test, typecheck)` and reads each
    `package.json` with `node -e`.

B7. **`pnpm --filter @vooster/api build` exits 0.** *(Enforced by
    `goals/_meta.md` M.4 — the meta gate enumerates every app in
    `apps/*` with a `build` script and runs it. This goal's gate does
    not re-run the build.)*

B8. **`pnpm --filter @vooster/cli build` exits 0.** *(Enforced by
    `goals/_meta.md` M.4 — same enumeration as B7.)*

### Tranche C — Astro landing (`apps/www`)

C1. **`apps/www/package.json` depends on `astro`.** The gate reads
    `dependencies` + `devDependencies` and asserts the `astro` key
    exists.

C2. **`apps/www/astro.config.mjs` (or `.ts`) exists.** Plain HTML
    files do not count.

C3. **`apps/www/src/pages/index.astro` exists.** This is the landing
    page entry.

C4. **Every landing file is in Korean.** The gate iterates
    `apps/www/src/pages/index.astro` plus every `*.astro` file under
    `apps/www/src/components/` and requires at least one Hangul
    character (U+AC00 – U+D7A3) per file. An English-only section file
    fails the gate even if `index.astro` is Korean.

C5. **`pnpm --filter @vooster/www build` exits 0.** *(Enforced by
    `goals/_meta.md` M.4 — the meta gate enumerates every app in
    `apps/*` with a `build` script. Landing-page section composition is
    intentionally left to the www app's own design iteration — the
    monorepo goal only enforces that the app exists and has Korean copy
    via C4; the build proof lives at the meta layer.)*

### Tranche D — Meta: regression + rigor

D1. **Every prior goal's gate suite still passes.** The gate iterates
    `(0-init, 1-runnable, 2-shippable, 3-managed-db, 4-honest-boundaries)`
    and runs each `goals/<n>-*.gates.sh`. Any failure fails Tranche D.
    The expected work here is updating each prior gate script (and any
    `scripts/check-*.sh` it calls) to point at the new
    `apps/api/...`, `apps/api/prisma/...`, `apps/cli/...` paths. Do
    *not* loosen prior assertions.

D2. `scripts/check-gate-rigor.sh goals/5-monorepo.md` passes — the
    universal claims in this file are matched by enumeration in the
    gate script.

## Scope Guards

Same as Goals 0–4 plus:

- **No mixed package managers.** Once `pnpm-lock.yaml` lands, `npm`
  and `yarn` are off-limits. `pnpm install`, `pnpm --filter`, and
  `pnpm -r` are the verbs.
- **No `"workspaces"` field in the root `package.json`.** That is
  npm's convention; pnpm reads `pnpm-workspace.yaml`. A1 explicitly
  checks the yaml.
- **No duplicate source trees.** When a directory moves, the original
  is deleted in the same commit (or the next). Tranche B5 catches
  half-finished migrations.
- **No "transitional" re-export shims at root.** A file like
  `src/index.ts` that re-exports from `apps/api/src/...` defeats B1
  and B5; do not introduce it.
- **No English-only landing copy.** C4 iterates every section file;
  a single Korean string in `index.astro` does not satisfy it.
- **No `eslint-disable boundaries/element-types` inside `apps/api`.**
  The goal-4 ESLint config still applies after the move; if a
  relocated import trips a boundary rule, fix the import.
- **No skipping Tranche D regression.** If a prior `goals/<n>-*.gates.sh`
  greps a path that no longer exists, *update the gate to the new path*.
  Deleting the gate is forbidden.

## Mandatory First Step (every iteration)

```
bash scripts/diagnose.sh
```

`diagnose.sh` is extended in this goal to print "Goal 5 coverage": which
of `apps/{api,cli,www}` exist, whether `pnpm-workspace.yaml` and
`pnpm-lock.yaml` are in place, and whether the legacy root directories
linger.

## Mandatory Reading Order

1. `AGENTS.md` — TDD protocol + commit shape.
2. `docs/01-architecture.md` — the layered architecture continues to
   apply *inside* `apps/api`; layer rules don't change because the
   files moved.
3. `goals/5-monorepo.md` — this file.
4. `docs/state/next-task.md`
5. `docs/state/blockers.md`
6. Narrow technical reference per task:
   - Tranche A: pnpm docs on workspaces and filtering
     (`pnpm-workspace.yaml`, `pnpm --filter`).
   - Tranche B: every file currently under root `src/`, `bin/`,
     `prisma/`, `tests/`; the sibling `goals/<n>-*.gates.sh` that
     references each path.
   - Tranche C: the Astro starter guide (`https://docs.astro.build/`)
     and the conductor.build landing page for visual reference.

## Recommended Order of Attack

`goals/5-monorepo.next-task.sh` enforces this order.

1. **Stand up pnpm (A1 + A2 + A5 + A6).** Write
   `pnpm-workspace.yaml`. Add `"packageManager": "pnpm@<version>"` to
   the root `package.json`, set `"private": true`, and move runtime
   deps out of root into per-app manifests as you go.
   `corepack enable && pnpm install`. Delete `package-lock.json`.
   Commit before touching code.

2. **Create the three empty app shells (A3 + A4).** Each app gets a
   `package.json` with `"name": "@vooster/<app>"` and `"private": true`.
   No code moved yet — this is a small, safe commit.

3. **Migrate the API (B1 + B2 + B3 + B6).** `git mv` each layer
   directory under `src/` to `apps/api/src/`. Move `prisma/` to
   `apps/api/prisma/`. Move tests that target the API into
   `apps/api/tests/`. Update the per-app `tsconfig.json` to extend a
   root base. Update `scripts/check-*.sh` and every
   `goals/<n>-*.gates.sh` that referenced the moved paths.

4. **Migrate the CLI (B4 + B6).** `git mv src/cli apps/cli/src`,
   `git mv bin apps/cli/bin`, and split CLI tests off. The CLI
   imports from `@vooster/api` (workspace path) for shared domain
   types.

5. **Verify builds (B7 + B8).** `pnpm --filter @vooster/api build`,
   then the CLI. These are DEEP; iterate with
   `VSPEC_GATES_SKIP_DEEP=1`, but run a full pass before declaring the
   goal green.

6. **Scaffold the Astro app (C1 + C2 + C3).**
   `pnpm create astro@latest apps/www -- --template minimal
   --typescript strict --no-install --no-git`, then `pnpm install`.

7. **Author the Korean landing copy (C4).** Section composition is left
   to www's own iteration; just keep every `*.astro` file under
   `apps/www/src/{pages,components}/` written in Korean — placeholder
   Lorem ipsum fails C4.

8. **Verify the Astro build (C5).** `pnpm --filter @vooster/www build`.

9. **Tranche D last.** `bash scripts/completion-check.sh`; the prior
   gate suites re-run and surface anything you forgot to retarget at
   the new paths.

## The TDD Loop

Most of this goal is mechanical relocation, not new behavior. Use
`chore(monorepo): …` for relocation, `feat(www): …` for new landing
work. New behavioral additions (e.g. a CTA form) still follow red →
green → refactor with `scripts/verify-tdd.sh` enforcing commit shape.

Reusable scopes:

- `chore(monorepo): <description>` — workspace + relocation commits
- `feat(www): <section>` — landing-page additions
- `red(www): …` / `green(www): …` — behavioral landing work

## Forbidden Actions (additive to Goals 0–4)

- Adding a `"workspaces"` field to the root `package.json` and
  claiming A1 satisfied (npm-style workspaces fail the gate).
- Leaving any file under root `src/`, `bin/`, `prisma/`, or `tests/`
  after the migration. B1 catches this.
- Re-exporting moved types from their former paths through a shim file
  at the old location.
- Replacing the Hangul iteration with "check `index.astro` only" to
  satisfy C4 with an English section file.
- Dropping the Tranche D regression check by deleting a prior
  `goals/<n>-*.gates.sh`.
- Running `npm install` after `pnpm-lock.yaml` lands — it will recreate
  `package-lock.json` and fail A5.

## Completion Check

```
bash scripts/completion-check.sh
```

Exit 0 only when goals 0, 1, 2, 3, 4, and 5 all pass their gates.

## Now Begin

Run: `bash scripts/diagnose.sh`
