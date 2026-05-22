# 02 — Tech Stack

This document is **prescriptive**. Do not introduce alternatives without an ADR
in `docs/decisions/`.

## Languages & Runtime

| Concern  | Choice         | Why                                                      |
| -------- | -------------- | -------------------------------------------------------- |
| Language | TypeScript 5.x | Type safety on a JS ecosystem; agents handle it well.    |
| Runtime  | Node.js 20 LTS | Stable, modern, supported through 2026.                  |
| Package  | npm            | Default, no extra config required for codex/agent tools. |

## Server

| Concern    | Choice      | Why                                          |
| ---------- | ----------- | -------------------------------------------- |
| HTTP       | Fastify 4.x | Schema-validated routes, fast, plugin model. |
| Validation | Zod         | Single source of truth for runtime + types.  |
| Logger     | pino        | Bundled with Fastify; structured JSON.       |

## Database

| Concern | Choice                                     | Why                                           |
| ------- | ------------------------------------------ | --------------------------------------------- |
| RDBMS   | PostgreSQL 15+                             | JSON columns for revisions, mature.           |
| ORM     | Prisma 5.x                                 | Type-safe schema, migrations, agent-friendly. |
| Test DB | postgres in Docker via testcontainers-node | Real DB; no mock divergence.                  |

## CLI

| Concern   | Choice                                                        | Why                                           |
| --------- | ------------------------------------------------------------- | --------------------------------------------- |
| Framework | oclif 4.x                                                     | Topic/command structure, hooks, plugin model. |
| Output    | chalk + cli-table3 + boxen                                    | Human-friendly UI primitives.                 |
| Format    | `--format=human` (default), `--format=json`, `--format=agent` | See `docs/07-cli-spec.md`.                    |

## Markdown / Specs

| Concern        | Choice      | Why                                       |
| -------------- | ----------- | ----------------------------------------- |
| Frontmatter    | gray-matter | YAML in fenced block; standard.           |
| Markdown parse | marked      | Lightweight; we don't render server-side. |
| Diff (text)    | diff (npm)  | For change previews.                      |
| Diff (struct)  | custom      | Walks our domain entities for impact.     |

## Auth

| Concern  | Choice                                 | Why                              |
| -------- | -------------------------------------- | -------------------------------- |
| Provider | GitHub OAuth 2.0                       | Single provider for MVP.         |
| Sessions | HTTP-only cookies                      | Standard.                        |
| API keys | Random 32-byte tokens, argon2id hashed | Industry standard.               |
| Hashing  | argon2 (npm)                           | argon2id for passwords/API keys. |

## Testing

| Concern         | Choice                                                    | Why                          |
| --------------- | --------------------------------------------------------- | ---------------------------- |
| Test runner     | Vitest                                                    | Fast, ESM-native, TS-native. |
| Assertions      | Built-in `expect`                                         | No extra dep.                |
| HTTP testing    | undici (built into node)                                  | Native, no extra dep.        |
| E2E harness     | `tests/helpers/server.ts` boots Fastify on ephemeral port | Real I/O.                    |
| Coverage        | c8 (Vitest built-in)                                      | V8 native.                   |
| Mutation sample | stryker-mutator (sampled, not full run)                   | Catch tautological tests.    |
| Fixtures        | factory-girl-ts                                           | Idiomatic factories.         |

## Lint, Format, Type-check

| Concern      | Choice                   | Why                          |
| ------------ | ------------------------ | ---------------------------- |
| Linter       | ESLint 9 (flat config)   | Standard.                    |
| Boundaries   | eslint-plugin-boundaries | Enforce hexagonal layering.  |
| Formatter    | Prettier 3               | Standard.                    |
| Type-checker | `tsc --noEmit` in CI     | Plus `tsc` build for output. |

## Web UI (MVP-minimal)

| Concern   | Choice                     | Why                                                              |
| --------- | -------------------------- | ---------------------------------------------------------------- |
| Framework | Next.js 15 (App Router)    | SSR + RSC + async request APIs + good defaults.                  |
| UI        | Tailwind CSS + shadcn/ui   | Fast composition.                                                |
| Data      | Server actions + fetch     | No client state library needed for MVP.                          |
| Hosting   | Vercel (GitHub-linked)     | Zero-config Next.js deploys + preview URLs per branch.           |
| E2E       | Playwright (chromium only) | Honest browser-driven tests; gated behind VSPEC_GATES_SKIP_DEEP. |

The web UI is **deliberately small** in MVP — list, view, comment, resolve merge
conflicts. Editing happens in markdown files via the CLI.

## Dev Experience

| Tool                | Purpose                                                           |
| ------------------- | ----------------------------------------------------------------- |
| SQLite              | Local dogfood and automated test default (`file:.state/*.sqlite`) |
| docker compose      | Optional local Postgres and production-like deploy                |
| tsx                 | `tsx watch` for local server reload                               |
| dotenv              | `.env` loading                                                    |
| husky + lint-staged | Pre-commit hooks (lint + format staged)                           |

Prisma's checked-in schema uses the SQLite provider so `npm start` and the
restart-survival tests work on a fresh machine without a database daemon.
Production compose files override `DATABASE_URL` with a Postgres connection;
that deploy path is verified separately by the Goal 2 Docker gate.

## Versioning

| Concern       | Approach                                       |
| ------------- | ---------------------------------------------- |
| API           | URL-prefixed `/v1/...`. Breaking changes bump. |
| CLI           | Semver. Major bumps via deprecation cycle.     |
| Spec markdown | `vspec_format: 1` in frontmatter.              |

## Forbidden

- jQuery, Lodash (use native).
- Mongoose, TypeORM, Knex (we picked Prisma).
- jest (we picked Vitest).
- Yarn, pnpm (we picked npm — single tool for agent simplicity).
- Express (we picked Fastify).
- Any ORM-on-top-of-an-ORM ("repository pattern wrapping Prisma" is fine; a
  generic repository library is not).
- Date libraries (use `Date` + Intl APIs; dayjs only if a truly hard case arises
  and an ADR documents it).

## Adding a Dependency

1. Write an ADR in `docs/decisions/` (1-2 paragraphs is fine).
2. Show that the dependency is justified relative to the alternatives above.
3. Install.
4. Commit with prefix `chore: add <dep> per ADR-NNN`.
