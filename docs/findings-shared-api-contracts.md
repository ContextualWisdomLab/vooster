# Findings — Shared API Contracts Plan

Captured 2026-05-23 while reviewing tests that were overfit to implementation
details. The specific trigger was CLI unit tests asserting exact `fetch`
`RequestInit` objects. The agreed direction is to stop treating hand-written
payload shape tests as the primary drift defense and introduce a shared Zod
contract package consumed by API, CLI, and Web.

## TL;DR

Add `packages/contracts` as the single source of truth for production HTTP
boundary schemas. Migrate all production routes to parse params, query, body,
and response DTOs through those schemas. Add a typed CLI API client layer and
make `apps/web` parse API responses in its data layer.

This is a larger structural task, not a small test cleanup. It should be
implemented as one focused tranche but committed in small verified steps.

## Scope

In scope:

1. Add a new workspace package: `@vooster/contracts`.
2. Define Zod schemas and inferred TypeScript types for every production HTTP
   route boundary.
3. Update `apps/api` route handlers to import and use the shared schemas.
4. Add a typed `apps/cli` API client layer that owns URL construction, request
   validation, and response parsing.
5. Update `apps/web` data access to use shared response schemas and avoid
   duplicating API DTO types locally.
6. Relax CLI command tests away from exact `fetch` object equality and toward
   command behavior plus typed client contracts.

Out of scope:

1. OpenAPI/Swagger generation.
2. Generated SDK/client code.
3. Moving DB/domain `Stored*` types into contracts.
4. UI component state/view-model types.
5. Test-only `__test/*` routes unless a later decision explicitly creates an
   internal-test contract module.

## Package Shape

Proposed layout:

```text
packages/contracts/
  package.json
  src/
    actor.ts
    ai-guide.ts
    api-key.ts
    auth.ts
    branch.ts
    change.ts
    comment.ts
    common.ts
    export.ts
    goal.ts
    invitation.ts
    lock.ts
    merge.ts
    project.ts
    revision.ts
    scenario.ts
    session.ts
    stakeholder.ts
    sync.ts
    usecase.ts
    who.ts
    index.ts
```

`packages/contracts` must remain independent:

```text
packages/contracts
        ↑
 apps/api   apps/cli   apps/web
```

It must not import from `apps/api/src/domain`, Prisma, Fastify, CLI commands, or
Web components.

## Route Coverage

Production routes to cover include:

- Auth: GitHub start/callback token flow, logout
- Projects: list, create, create in workspace, rename, delete
- Actors: list, show, create, update, archive
- Stakeholders: list, show, create, update, archive
- Goals: list, show, create, update, promote
- Use cases: create, search/list, agent fetch, update, archive/delete, restore
- Scenarios and steps: create scenario, add step, edit step
- Stakeholder interests: create, delete
- Comments: add, list, update, resolve, delete
- Sessions: start, list/watch, complete
- Locks: acquire, renew
- Branches: create
- Merges: open, resolve
- Changes: preview, commit
- Revision history, diff, revert
- Exports: markdown, gherkin
- Sync: pull, push
- Impact, who, API keys, invitations, AI guide
- Health response can use a small common schema or remain a trivial local
  literal if we decide not to treat it as an API contract.

Test routes under `__test/*` are not part of the public shared contract.

## Implementation Plan

### 1. Workspace Setup

- Add `packages/*` to `pnpm-workspace.yaml`.
- Add `packages/contracts/package.json`.
- Add `packages/**/*.ts` to root `tsconfig.json` include.
- Add `@vooster/contracts: workspace:*` to `apps/api`, `apps/cli`, and
  `apps/web`.
- Add a minimal `packages/contracts/src/index.ts` and one smoke test proving
  schema inference and runtime parsing work.

### 2. Contract Extraction

- Move existing route-local Zod schemas into contract modules.
- Keep names HTTP-oriented: `createProjectRequestSchema`,
  `projectResponseSchema`, `usecaseParamsSchema`, not domain-oriented names
  like `StoredProjectSchema`.
- Define response schemas for bodies currently returned by API routes.
- Use `z.infer` exports for request/response DTO types.
- Prefer permissive response schemas only where the existing API returns
  intentionally open-ended agent envelopes or problem details.

### 3. API Adoption

- Replace route-local schemas with imports from `@vooster/contracts`.
- Continue returning the same HTTP status codes and bodies.
- Parse request params/query/body at route boundaries.
- Parse response DTOs before `reply.send` where cheap and useful; for text
  exports, validate request and keep response as text.
- Keep application-layer result types separate from HTTP DTOs.

### 4. CLI API Client

- Add a typed `apps/cli/src/api-client.ts` or equivalent module.
- The client owns:
  - endpoint URL construction
  - request schema validation
  - `fetchJson`/`postJson`/`patchJson`/`deleteJson` calls
  - response schema parsing
- Commands should call client methods such as `client.updateUsecase(...)`
  instead of assembling raw URLs and payloads themselves.
- Command unit tests should focus on flag-to-operation behavior and renderer
  output. Exact global `fetch` object equality should move down to a much
  smaller HTTP client test if still needed.

### 5. Web Data Layer

- Replace local DTO types in `apps/web/app/data.tsx` with contract-inferred
  types where they describe API responses.
- Change `readApi<T>(path)` to `readApi(path, schema)`.
- Change `mutateApi(...)` to parse successful JSON responses with a supplied
  schema.
- Keep contract imports inside data/access modules instead of spreading them
  through page components.

### 6. Verification

Targeted checks:

- `pnpm exec vitest run packages/contracts`
- `pnpm exec vitest run apps/api/tests/unit apps/api/tests/e2e`
- `pnpm exec vitest run apps/cli/tests/unit`
- focused CLI E2E tests for commands migrated to the client layer
- `pnpm --filter @vooster/web test`

Known caveat: root `pnpm typecheck` currently fails before this work because
`apps/web/hooks/use-mobile.ts` references `window` without DOM lib typing. Do
not hide that failure inside the contract migration; report it separately unless
the contract work naturally touches the Web tsconfig boundary.

## Acceptance Signals

The finding is resolved when:

1. `packages/contracts` exists and is consumed by `apps/api`, `apps/cli`, and
   `apps/web`.
2. Production route-local request schemas have been replaced by shared contract
   schemas.
3. CLI API calls for production API surfaces go through a typed client that
   validates requests and parses responses.
4. Web API reads/mutations parse responses through shared schemas.
5. CLI command unit tests no longer rely on exact `fetch(..., RequestInit)`
   object equality for API contract correctness.
6. Targeted API/CLI/Web tests pass, with any unrelated global gate failures
   documented explicitly.

## Risks

- This is broad enough to touch many route files and command files; commit in
  small steps even if implemented under one task.
- Response schemas may expose inconsistent existing API shapes. Prefer
  documenting and preserving the current shape first, then normalize in later
  product work.
- Contract names can drift into domain naming if copied from `Stored*` types.
  Keep the package focused on HTTP DTOs.

## Recommended Commit Sequence

1. `setup: add shared contracts package`
2. `test: cover shared http contracts`
3. `refactor(api): use shared route contracts`
4. `refactor(cli): add typed api client`
5. `refactor(web): parse api responses with contracts`

