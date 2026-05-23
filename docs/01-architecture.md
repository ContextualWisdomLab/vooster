# 01 — Architecture

## Style: Hexagonal (Ports & Adapters)

```
┌─────────────────────────────────────────────────────────────────┐
│                            Adapters                              │
│                                                                  │
│   CLI (oclif)     HTTP (Fastify)    Filesystem    GitHub OAuth   │
│       │                │                 │              │        │
└───────┼────────────────┼─────────────────┼──────────────┼────────┘
        │                │                 │              │
        ▼                ▼                 ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                             Ports                                │
│  ─ UseCaseRepository   ─ SessionRepository   ─ BranchRepository  │
│  ─ ClockPort           ─ IdPort              ─ HasherPort        │
│  ─ AuthProviderPort    ─ ExportPort          ─ FilesystemPort    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Application Layer                          │
│   Use case interactors (one class per UC where appropriate)     │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Domain Layer                            │
│   Pure types, invariants, value objects. Zero I/O. Zero deps.    │
└─────────────────────────────────────────────────────────────────┘
```

## Layer Rules

- **Domain** imports nothing outside `src/domain/`.
- **Application** imports `src/domain/` and `src/ports/`. Never imports
  `src/infrastructure/`.
- **Infrastructure** implements ports. May import domain types.
- **Adapters** (`src/cli/`, `src/http/`) compose application interactors with
  concrete infrastructure via a small `src/composition-root.ts`.

A failing import direction is caught by an eslint rule (configure
`eslint-plugin-boundaries`).

## Process Model

- A single Fastify server process exposes REST.
- The CLI is a separate Node process. It can run in two modes:
  - **Online**: calls the REST API.
  - **Offline-aware**: reads/writes local `specs/*.md`, then syncs via
    `vspec pull` / `vspec push`.
- Background work is intentionally minimal in MVP. There is no job queue. Heavy
  work (impact analysis, Gherkin export) is synchronous.

## Concurrency Model

The hard part. Read this carefully.

### Revisions

Every write to a `UseCase`, `Scenario`, `Step`, `StakeholderInterest`, `Actor`,
`Stakeholder`, or `Goal` produces a new `Revision` row with a content-addressed
hash (sha256 of canonical JSON). Reads can specify a revision; the default is
"latest on the requested branch."

### Branches

A `SpecBranch` is a moving pointer to a head revision per entity, plus a base
revision. Branches are single-level (no branch-of-a-branch in MVP). The default
branch per project is `main`.

### Work Sessions

A `WorkSession` represents an active piece of work, usually by an agent. It:

- Pins one revision per entity it cares about (`pinned_revisions`).
- Optionally owns a `SpecBranch` (the `--auto-branch` mode).
- Holds zero or more `Lock`s.
- Has a `status` of `ACTIVE | COMPLETED | ABANDONED`.

While a session is `ACTIVE`, reads through that session always return the pinned
revisions, regardless of what happened on the branch since.

### Locks

Three levels:

- `SOFT` — informational. Triggers a warning to anyone else editing. Does not
  block.
- `SEMANTIC` — blocks structural/meaning changes (delete step, change outcome,
  change extension condition, remove actor) but allows cosmetic edits (typos,
  rewording).
- `HARD` — blocks all writes.

A session's `--auto-branch` mode acquires a SEMANTIC lock on the pinned entities
on `main`.

### Merges

- Strategy is `fast-forward` (if branch is ahead of base and base is unchanged)
  or `squash` (collapse branch changes into one revision on `main`).
- A `MergeRequest` is the proposed merge with an attached impact analysis. It
  must be opened, even for fast-forward, so impact is recorded.
- Conflicts are detected at three layers:
  1. **Lock conflict** — target entity has a competing HARD lock.
  2. **Structural conflict** — same field of same entity changed on both sides
     to different values.
  3. **Semantic conflict** — both sides added a scenario at the same extension
     point with different content.

Conflicts must be resolved manually in MVP. Auto-merge is only for
non-overlapping field-level changes.

### Impact Analysis (rule-based, MVP)

For every proposed change, compute:

- **affected_sessions**: active sessions pinning any entity touched.
- **affected_branches**: open branches whose base or head touches the entity.
- **severity**: `COSMETIC | NON_BREAKING | BREAKING` by structural rules
  (`docs/05-data-model.md` enumerates them).
- **confidence**: always `1.0` for rule-based; placeholder field for future AI.

## Persistence

- PostgreSQL via Prisma.
- Each entity has `id`, `created_at`, `updated_at`, plus its domain fields.
- `Revision` table is append-only; entity tables hold the "current pointer" plus
  denormalized current fields for query speed.
- Soft delete via `archived_at` for `UseCase`, `Goal`, `Actor`, `Stakeholder`.

## Observability (MVP-minimal)

- Structured JSON logs to stdout (pino).
- Request ID propagated via `x-vspec-request-id`.
- Error tracking: stub adapter; production wiring is post-MVP.

## Security

- All passwords hashed via argon2id (if local auth is ever added). MVP uses
  GitHub OAuth only.
- API keys hashed at rest (sha256 + per-row salt is overkill for MVP;
  argon2id is the standard but slower — pick **argon2id** for symmetry).
- All write endpoints require an authenticated session OR a valid API key with
  matching scope.
- CSRF: API is token-authenticated; web UI uses same-origin sessions with
  double-submit cookies.
- Rate limiting: stub (token bucket per API key, 100 req/min). Configurable.

## Deployment (MVP-minimal)

- Single container for API.
- Single container for the web UI (Next.js or static React; pick in tech-stack).
- Postgres via managed provider (Neon / Supabase / RDS — choice deferred).
- The CLI ships as an npm package.

## Future-Friendly Seams

These are _not_ MVP but the architecture leaves room:

- `ExportPort` allows formats beyond Gherkin.
- `AuthProviderPort` allows additional OIDC providers.
- The MCP server is a thin adapter that wraps the same application interactors.
- `ImpactAnalysisPort` allows an AI-backed implementation later.
