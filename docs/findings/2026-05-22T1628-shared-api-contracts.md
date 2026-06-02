---
title: Shared API Contracts Plan
created_at: 2026-05-22T16:28:28Z
resolved: partial
status_notes: |
  2026-06-03: CLI read-path 3-cast slice CLOSED in impact/status/auto-export:
  `revisionHistoryResponseSchema`, `sessionListResponseSchema`, and
  `syncPullResponseSchema` now parse the fetched bodies; local response types
  were removed. Verification: `rg "\.body as" apps/cli/src` returns 0,
  `pnpm --filter @vooster/cli typecheck` passes, and
  `pnpm exec vitest run apps/cli` passes (113 files / 210 tests). KEEP partial:
  central typed CLI client layer and other reviewed contract-wide work remain
  deferred.
  Remaining non-contract reads (tracked 2026-06-02, cycle 260602-01 meta-audit
  #2): only two CLI read sites still cast `response.body as <hand-rolled type>`
  instead of parsing through a contract — the revision-list read inside
  `apps/cli/src/commands/impact.ts` (`RevisionListResponse`) and a read in
  `apps/cli/src/commands/status.ts`. These are the tail of the deferred typed
  CLI client work; left deferred (not ad-hoc fixed) so the typed-client slice
  stays one coherent piece.
  Impact domain CLOSED on 2026-06-02 (cycle 260602-01): the file-based impact
  variant of `POST /v1/changes/preview` got its own
  `packages/contracts/src/impact.ts` (request + preview response schemas,
  reusing common `suggestedNextActionSchema`) rather than polluting change.ts;
  API `impact-routes.ts` parses the request and CLI `impact.ts` parses the
  response through the shared schemas, dropping both route-local `previewSchema`
  and the CLI's hand-rolled `ImpactResponse`. Strict CLI parsing also surfaced a
  unit-mock that omitted the always-present `reason` on suggested actions; mock
  corrected. Still partial: central typed CLI client remains deferred.
  Stakeholder-interest domain CLOSED on 2026-06-02 (cycle 260602-01): add/delete
  request, params, and add/remove success response schemas moved to
  `@vooster/contracts` (`packages/contracts/src/stakeholder-interest.ts`); API
  `stakeholder-interest-routes.ts` and CLI `usecase.ts` now parse through the
  shared schemas, route-local `interestRequestSchema` removed, and the CLI's
  hand-rolled `StakeholderInterestResponse` type now aliases the contract type.
  This was one of the previously-deferred "non-package-shape production
  surfaces". Still partial: impact route + central typed CLI client remain.
  Auth domain CLOSED on 2026-05-27: OAuth start/callback and device-token
  request bodies/query plus login/signup success response schemas moved to
  `@vooster/contracts`; API and CLI auth paths now parse through the shared
  schemas. Package-shape extraction is complete: 21 planned package domains plus
  the separately tracked Doctor slice were migrated. Finding remains partial:
  central typed CLI client extraction and any non-package-shape production
  surfaces are deferred.
  Session domain CLOSED on 2026-05-27: start/list/watch/complete params,
  query/body, and success response schemas moved to `@vooster/contracts`; API
  and CLI session paths now parse through the shared schemas. Domains migrated:
  21/21 planned package slices; auth remained as the final planned slice, with
  Doctor already tracked separately.
  Sync domain CLOSED on 2026-05-27: pull/push project params, request bodies,
  and success response schemas moved to `@vooster/contracts`; API and CLI sync
  paths now parse through the shared schemas. Domains migrated: 20/21.
  Revision domain CLOSED on 2026-05-27: history/diff/revert params, query,
  bodies, and success response schemas moved to `@vooster/contracts`; API and
  CLI revision paths now parse through the shared schemas. Domains migrated:
  19/21.
  Merge domain CLOSED on 2026-05-27: open/resolve request and success response
  schemas moved to `@vooster/contracts`; API and CLI merge paths now parse
  through the shared schemas. Domains migrated: 18/21.
  Change domain CLOSED on 2026-05-27: preview/commit request and success
  response schemas moved to `@vooster/contracts`; API and CLI change paths now
  parse through the shared schemas. Domains migrated: 17/21.
  Export domain CLOSED on 2026-05-27: usecase export params/body and
  gherkin/markdown text response schemas moved to `@vooster/contracts`; API and
  CLI export paths now parse through the shared schemas. Domains migrated:
  16/21.
  Invitation domain CLOSED on 2026-05-27: create/accept params and request
  bodies plus create/accept success response schemas moved to
  `@vooster/contracts`; API and CLI member invite now parse through the shared
  schemas. Domains migrated: 15/21.
  Who domain CLOSED on 2026-05-27: request params and success response schema
  moved to `@vooster/contracts`; API and CLI now parse through the shared
  schema. Domains migrated: 14/21.
  Scenario/step domain CLOSED on 2026-05-27: scenario create, step add, and
  step edit params, query/body, and success response schemas moved to
  `@vooster/contracts`; API and CLI now parse through the shared schemas.
  Domains migrated: 13/21.
  Usecase domain CLOSED on 2026-05-27: create/list/show/update/archive/restore
  params, query/body, and success response schemas moved to `@vooster/contracts`;
  API, CLI, and app usecase readers now parse through the shared schemas.
  Domains migrated: 12/21.
  Project domain CLOSED on 2026-05-27: create/list/rename/delete params,
  bodies, query, and success response schemas moved to `@vooster/contracts`;
  API, CLI, and app project readers/mutations now parse through the shared
  schemas. Domains migrated: 11/21.
  Comment domain CLOSED on 2026-05-27: add/list/edit/resolve/delete params,
  bodies, query, and success response schemas moved to `@vooster/contracts`;
  API and CLI now parse through the shared schemas. Domains migrated: 10/21.
  Lock domain CLOSED on 2026-05-27: acquire/renew/release params/body and
  success response schemas moved to `@vooster/contracts`; API and CLI now parse
  through the shared schemas. Domains migrated: 9/21.
  Branch domain CLOSED on 2026-05-27: create request params/body and success
  response schemas moved to `@vooster/contracts`; API and CLI now parse through
  the shared schemas. Domains migrated: 8/21.
  API-key domain CLOSED on 2026-05-27: create/list/revoke request and success
  response schemas moved to `@vooster/contracts`; API and CLI now parse through
  the shared schemas. Domains migrated: 7/21.
  Goal domain CLOSED on 2026-05-27: create/patch/list params, show/list/
  create/patch/promote response schemas moved to `@vooster/contracts`; API and
  CLI now parse through the shared schemas, and stale route-local validation was
  removed. Domains migrated: 6/21.
  Actor/stakeholder CLI unit overfit CLOSED on 2026-05-27: migrated command
  tests no longer assert exact `fetch(..., RequestInit)` objects; shared
  schemas and honest CLI E2E cover contract and behavior drift.
  Stakeholder domain CLOSED on 2026-05-27: create/patch params and list/show/
  create/archive response schemas moved to `@vooster/contracts`; API and CLI
  now parse through the shared schemas. Domains migrated: 5/21.
  Actor domain CLOSED on 2026-05-27: create/patch params and list/show/create/
  archive response schemas moved to `@vooster/contracts`; API, CLI, and the
  app actor reader now parse through the shared schemas. Domains migrated: 4/21.
  Doctor domain CLOSED on 2026-05-27: query and success diagnostic response
  schemas moved to `@vooster/contracts`; API and CLI now parse through them.
  Domains migrated: 3/21.
  AI-guide domain CLOSED on 2026-05-27: route query/body and success response
  schemas moved to `@vooster/contracts`; API and CLI now parse through them.
  Domains migrated: 2/21.
  Common/health domain CLOSED on 2026-05-27: `/healthz` now returns through
  `@vooster/contracts` `healthResponseSchema`. Domains migrated: 1/21.
  Scaffold CLOSED on 2026-05-27: `packages/contracts` exists, workspace package
  wiring is in place, and the smoke schema parse test is green. Domains
  migrated: 0/21 at scaffold.
  2026-05-27: web app paths corrected apps/web → apps/app (@vooster/app); the
  product UI package is @vooster/app. Picked up by cycle 260527-01 as an XL,
  chain-green-per-commit, partial-OK block — see "Unattended execution" below.
  Expect to end partial ("N/21 domains migrated"); that is a successful run.
related:
  - apps/api
  - apps/cli
  - apps/app
  - pnpm-workspace.yaml
---

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
make `apps/app` parse API responses in its data layer.

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
5. Update `apps/app` data access to use shared response schemas and avoid
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
 apps/api   apps/cli   apps/app
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
  `apps/app`.
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

- Replace local DTO types in `apps/app/app/data.tsx` with contract-inferred
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
- `pnpm --filter @vooster/app test`

Known caveat: root `pnpm typecheck` currently fails before this work because
`apps/app/hooks/use-mobile.ts` references `window` without DOM lib typing. Do
not hide that failure inside the contract migration; report it separately unless
the contract work naturally touches the Web tsconfig boundary.

## Acceptance Signals

The finding is resolved when:

1. `packages/contracts` exists and is consumed by `apps/api`, `apps/cli`, and
   `apps/app`.
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
5. `refactor(app): parse api responses with contracts`

---

## Unattended execution — chain-green-per-commit ledger (locked 2026-05-27)

This is an **XL structural refactor** (≈44 API routes + 19 CLI fetch sites + 16
`apps/app` readers). The risk is not the design — the plan above is settled —
it is the **scale**: a half-done migration splits the schema source of truth
and breaks `completion-check.sh`. To make it safe for an unattended overnight
loop, execute it as an **append-only ledger of small, independently-green
commits**, never as one big change. **Ending partial is the expected, correct
outcome** — the night closes K domains and leaves the chain green.

### The iron rule

**Every commit leaves `bash scripts/completion-check.sh` GREEN.** No exceptions.
A commit that can't be greened in one RED→GREEN cycle is reverted (below).

### Commit order (one slice per commit, each green)

1. **Scaffold** (`setup:`) — add `packages/*` to `pnpm-workspace.yaml`; create
   `packages/contracts/{package.json,src/index.ts}`; add `packages/**/*.ts` to
   root `tsconfig.json` include; add `@vooster/contracts: workspace:*` to
   `apps/api`, `apps/cli`, `apps/app`; one smoke test
   (`packages/contracts/.../smoke.test.ts`) proving inference + runtime parse.
   No consumers yet — an unused workspace **dependency** is chain-safe (it is
   not an unused _import_). `pnpm install` + `completion-check.sh` green.
2. **Per-domain slices** — **one domain module per commit**, in roughly this
   risk order (low → high; mirror the route-test risk order):
   `common` → `ai-guide` / `doctor` / health → `actor` → `stakeholder` →
   `goal` → `comment` → `project` → `usecase` → `scenario`/`step` →
   `revision` → `export` → `lock` → `branch` → `merge` → `change` → `sync` →
   `who` → `session` → `auth` → `api-key` → `invitation`.
   For each domain, in the **same commit**: (a) define the domain's contract
   module in `packages/contracts/src/<domain>.ts`; (b) replace the route-local
   Zod in the matching `apps/api/src/http/*-routes.ts`; (c) route the matching
   `apps/cli` fetch site(s) through the typed client method; (d) parse the
   matching `apps/app` reader(s) with the contract schema; (e) relax that
   domain's CLI unit test off exact `fetch(..., RequestInit)` equality.
   Tests green → commit `refactor(contracts): migrate <domain> to shared schema`.
3. Update this finding's status_notes after each domain: "N/21 domains".

### Revert-guard (HARD, prevents wedging the night)

If a domain slice leaves the chain red and you cannot green it within **one**
RED→GREEN cycle: `git revert` that commit (do **not** `reset --hard`), set this
finding `resolved: partial` with status_notes "N/21 domains migrated; <domain>
reverted — <one-line reason>", append a `docs/state/blockers.md` line, and
**move to the next cycle target**. The chain returns to green; the night
continues elsewhere. Do not retry the same domain more than twice.

### Disjoint from route-test Phase 2

This block edits `apps/api/src/http/*-routes.ts` (route _source_); the
route-test Phase 2 queue edits `apps/api/tests/.../*-routes.test.ts` (route
_tests_). They are mostly file-disjoint. If both touch the same domain in one
session, do the contract slice first, then migrate that route's test — never
interleave the two on the same file within one iteration.

### Typecheck caveat (updated path)

The finding originally noted root `pnpm typecheck` failing on
`apps/app/hooks/use-mobile.ts` (`window` without DOM lib typing). The chain is
currently GREEN, so this is either resolved or not on the `completion-check`
path. If a root typecheck failure surfaces there during this work, **report it
separately** (a blocker line) — do not absorb or hide it inside a contract
slice.
