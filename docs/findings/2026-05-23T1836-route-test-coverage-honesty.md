---
title: "Route-level unit tests violate coverage-diagnosis prescription"
created_at: 2026-05-23T18:36:00Z
priority: P2
resolved: false
related:
  - docs/findings/2026-05-23T1730-coverage-diagnosis.md
  - apps/api/tests/unit/http
  - apps/api/tests/helpers/server.ts
---

# Findings — `tests/unit/http/*-routes.test.ts` are the anti-pattern coverage-diagnosis warned against

## TL;DR

The coverage-diagnosis finding (closed 2026-05-23) explicitly named the
right fix for uncovered HTTP routes: **integration tests** under
`apps/api/tests/integration/` that drive `app.inject(...)`. After it
closed, ~80 unit tests under `apps/api/tests/unit/http/*-routes.test.ts`
landed using the exact anti-pattern the finding called out — mocking
`FastifyInstance`, mocking stores, capturing `request`/`reply`,
asserting "the handler returned this shape". These tests pass schema
checks, miss real Fastify wiring, and produce tautological green
signals. We cannot migrate ~80 files before beta; we can be honest
about the violation and stop the bleed.

## Reproducer

1. The original prescription
   (`docs/findings/2026-05-23T1730-coverage-diagnosis.md:155-200`,
   "Class 1 — Real test gap"):

   > _Wrong_: blanket add unit tests for `*-support.ts`. _Right fix_:
   > write a route-level integration test under
   > `apps/api/tests/integration/` that calls the endpoint via the
   > test server. Not a unit test for `resolvePins` in isolation.

2. After resolution, ~80 files landed under `apps/api/tests/unit/http/`
   matching the warned-against shape. Sample —
   `apps/api/tests/unit/http/lock-routes.test.ts` (representative):

   ```ts
   const app = { post: (path, handler) => { handlers[path] = handler; } }
     as unknown as FastifyInstance;
   registerLockRoutes(app, signupState(), lockStore(...), ...);
   await handlers['/v1/locks'](mockRequest, mockReply);
   expect(captured.statusCode).toBe(400);
   ```

   What this **does not** catch:
   - Fastify schema validation (mocked `app` skips it)
   - Route registration order, hooks, middleware
   - Missing `.code().send()` in reply chain
   - Real cookie parsing from `request.headers.cookie`
   - JSON body parser interactions

3. The fully honest pattern exists at
   `apps/api/tests/helpers/server.ts` (in-process `app.inject` via the
   real `createServer`). Tests using it are the gold standard
   coverage-diagnosis pointed to.

## Why P2 (not P1)

- The tests **pass** and provide partial coverage.
- 80+ files = multi-day migration. Not realistic before May-30 beta.
- No user-facing impact today.

But the technical debt compounds: every new route added now defaults
to the unit-mock pattern because that's the local convention. We need
to (a) acknowledge the violation, (b) plant an exemplar so the next
route written follows the integration pattern, (c) queue per-route
migration as follow-up.

## Proposed fix

### Phase 1 (this finding's scope)

1. **Decision doc** — append a section to this finding (or
   `docs/02-architecture.md`) stating: "Going forward, new HTTP routes
   land with a `tests/integration/http/<route>.test.ts` using
   `app.inject`. Existing `tests/unit/http/*-routes.test.ts` are
   technical debt; do not propagate the pattern."
2. **Exemplar** — add **2-3** integration tests under
   `apps/api/tests/integration/http/` covering distinct route families
   (e.g., `doctor`, `lock`, `sync`) using `startServer` +
   `app.inject`. They co-exist with the unit tests; they don't
   replace yet.
3. **Lint gate** (optional) — `goals/<n>.gates.sh` rule:
   "for every `apps/api/src/http/*-routes.ts` created after sha XXX,
   there exists at least one `apps/api/tests/integration/http/*` that
   imports it". Enforces the convention for _new_ work without
   forcing migration of the back catalog.

### Phase 2 (follow-up findings, sub-finding queue)

Per-route migration. Each becomes its own short finding:
`<TS>-test-honesty-<route>.md`. Closed in batches as time permits.

## Acceptance signal — Phase 1

- `ls apps/api/tests/integration/http/` shows ≥ 3 `*.test.ts` files
  with imports from `../helpers/server.ts`.
- Decision text exists in this finding (or linked doc) and is
  discoverable via `rg 'integration pattern' docs`.
- `pnpm exec vitest run apps/api/tests/integration/http` green.

## Goal promotion judgment

**No** for Phase 1 — decision + exemplar is human judgment work, not
gate-able. **Maybe** for Phase 2 — once a sub-finding queue exists,
the universal "every `*-routes.ts` has an integration test importer"
becomes a clean negative grep gate.

## Migration plan (Phase 2 queue, ordered by risk)

1. `doctor-routes` (newest, smallest blast radius)
2. `sync-routes` (data integrity — already a P0 elsewhere)
3. `signup-routes` (auth surface)
4. `lock-routes`, `session-routes` (concurrency-sensitive)
5. Remaining ~75 in alphabetical order

Stop point per cycle: any cycle that hits 3 RED→GREEN sub-finding
closures is a good cycle. Do not block on the full sweep.
