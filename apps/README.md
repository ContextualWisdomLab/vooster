# apps/ — Workspace Applications

vspec is a pnpm-workspace monorepo (`pnpm-workspace.yaml` declares `apps/*`).
Every deployable surface lives under `apps/<name>` and publishes as
`@vooster/<name>`. The hexagonal core (`domain`, `ports`, `application`,
`infrastructure`, `http`) lives **inside `apps/api`**; the other apps consume
the API over HTTP or the local filesystem and never import API internals
(treat `docs/06-api-contract.md` as the contract).

| Dir   | Package        | Role                                               | Stack                     | Ships as    |
| ----- | -------------- | -------------------------------------------------- | ------------------------- | ----------- |
| `api` | `@vooster/api` | REST API + the domain core (source of truth)       | Fastify + Prisma/Postgres | Container   |
| `cli` | `@vooster/cli` | `vspec` — primary surface for humans and AI agents | oclif (Node 20+)          | npm package |
| `app` | `@vooster/app` | Authenticated product web UI (read-only viewer)    | Next.js 15 App Router     | Vercel      |
| `www` | `@vooster/www` | Korean marketing / landing site                    | Astro 5                   | Vercel      |

> The `app` directory was renamed from `web` on 2026-05-26. The Vercel project
> name (`vooster-new-web`) and the test tier folder (`tests/e2e-web/`) keep
> their original names; only the workspace path and package name changed.

## `api` — `@vooster/api`

The Fastify HTTP server and the inner layers that hold all business rules.
This is the **only** app that owns the data model and persistence (Prisma /
PostgreSQL). Everything else is an adapter or a client of it.

- Architecture & layer rules: `docs/01-architecture.md`
- Data model: `docs/05-data-model.md`
- HTTP contract: `docs/06-api-contract.md`

## `cli` — `@vooster/cli`

The `vspec` command-line tool — the primary surface for both human developers
and AI coding agents. Runs **online** (calls the REST API) and
**offline-aware** (reads/writes local `specs/*.md`, then `vspec pull` /
`vspec push`). Self-teaching: errors suggest the next command and
`--format=agent` emits JSON with `suggested_next_actions`.

- CLI spec: `docs/07-cli-spec.md`
- File format: `docs/08-file-format.md`

## `app` — `@vooster/app`

The authenticated product web UI on Vercel. Users browse projects → use-case
list → use-case detail. All pages are Server Components; data is fetched
server-side from the API with the `vspec_session` cookie forwarded.
**Read-only — no write affordances** (writes go through the CLI/API).

- App guidance: `apps/app/AGENTS.md`
- Design / labeling principles: `apps/app/DESIGN.md`
- Origin goal: `goals/8-web-readonly-viewer.md`

## `www` — `@vooster/www`

The public Korean marketing site (hero → social proof → features → workflow →
showcase → pricing/CTA → footer), modeled after conductor.build. Static Astro,
deployed on Vercel under https://v2.vooster.ai.

- Site guidance: `apps/www/AGENTS.md`
- Design source: `apps/www/DESIGN.md`

---

**Workspace verbs:** `pnpm install`, `pnpm --filter @vooster/<app> <script>`,
`pnpm -r <script>`.
