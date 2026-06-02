---
title: "Route-level unit tests violate coverage-diagnosis prescription"
created_at: 2026-05-23T18:36:00Z
priority: P2
resolved: true
resolved_by:
  - 629c842
  - 97b766d
  - 78a8feb
status_notes: |
  RESOLVED 2026-06-02 (cycle 260602-01). Phase 1 (decision + exemplars) was
  already closed. Phase 2 (migrate the 37-file mocked-unit back catalog to the
  app.inject integration pattern) is now complete: 33 files fully migrated to
  tests/integration/http/ with their mocked units removed, and the 4 remaining
  unit files (change-commit, actor-management, stakeholder-management, session)
  are each trimmed to a SINGLE defensive branch that is genuinely unreachable
  through real HTTP (vanished-preview 404, updates-not-configured 500,
  AUTO_BRANCH_COLLISION 409) — for those, the mocked unit is the only possible
  exerciser, so they are accepted documented exceptions (with in-file NOTE
  comments citing where the rest is covered), not the anti-pattern this finding
  targeted. The 6 src/http/*-routes.ts without a name-matching integration test
  (actor-test, ai-guide, usecase-agent, usecase-archive, usecase-search, who)
  never had a mocked unit and were never in this queue; they are covered by
  UC-*.test.ts e2e. Verification: integration+unit/http = 263 tests green,
  `bash scripts/completion-check.sh` exit 0. Detailed per-batch history below.
  The "every *-routes.ts has an integration importer" gate idea (Goal promotion
  judgment, below) was reconsidered and REJECTED: app.inject tests use
  server.fetch (no module import) and route paths are dynamic, so any such grep
  would be form-coupled per goal-design.md §1.5; the convention is enforced by
  33 exemplars + the existing coverage gate + code review instead.
  Phase 1 is closed: the route integration pattern is documented below, and three app.inject exemplars now live under apps/api/tests/integration/http/.
  Phase 2 open: migrate the apps/api/tests/unit/http/*-routes.test.ts back catalog to the app.inject integration pattern, one route at a time. Verified count 2026-05-27 after the post-completion correction commit 97b766d: 36 *-routes.test.ts files remain; doctor-routes was migrated to apps/api/tests/integration/http/doctor-route.test.ts and the mocked unit file was removed. Progress: 1/37 migrated. The earlier "~80" figure in the body below was an over-estimate; the real Phase 2 queue is 37 files. Picked up by cycle 260527-01 as the overnight filler queue.
  2026-06-02 honesty re-verify (cycle 260602-01): queue confirmed at 36 unit files. NOTE: lock-routes.test.ts and sync-routes.test.ts unit files still exist alongside their Phase-1 integration exemplars (lock-route.test.ts, sync-route.test.ts) — those exemplars added coverage but did NOT remove the unit files, so lock/sync are still "not migrated" (only doctor is fully migrated). Migrating lock/sync = fold the unit cases into the existing exemplar (avoid a duplicate file), confirm green, then delete the unit file. Picked up by cycle 260602-01 as the overnight filler queue. Progress 2026-06-02: sync-routes migrated (folded push-malformed + no-membership cases into the existing sync-route.test.ts integration exemplar, unit file removed) -> 2/37 migrated, 35 unit files remain. Then a batch of 13 single-test validation-only route-units migrated to app.inject integration (api-key, branch, gherkin-export, goal-promotion, impact, merge-resolve, merge, revision-history, revision-revert, session-complete, stakeholder-interest, step, usecase-test) -> 15/37 migrated, 22 unit files remain. Remaining 22 split into ~12 more pure-validation files and ~10 side-effect-heavy files (lock/project/usecase/stakeholder/stakeholder-management/actor-management/invitation/session/session-list/usecase-update) that assert mocked store mutations and need full auth+project+session integration setup.
  branch-test-routes migrated 2026-06-02 (validation 400 cases + missing-branch 404; no seeding needed) -> 22/37 migrated, 15 unit files remain.
  Batch 2 (2026-06-02): fully migrated + unit removed: actor, comment, goal, revision-diff, scenario, signup -> 21/37 migrated, 16 unit files remain. Partially migrated (validation cases moved to new integration files, but UNIT KEPT because some cases need pre-seeded auth/session/store state that is not HTTP-reachable from empty stores): auth-device (slug-conflict 422 left in unit), change-commit (seeded-preview 404 left), change-preview (valid-preview + internal pass-through left), goal-show (stored-goal access/success left), markdown-export (seeded-session 404 left; also corrected: real route returns 404 "Use case not found" not the mock's 403). These 5 kept units + their new integration files co-exist (like the original exemplars). The seeded-state cases are the harder tail; closing them needs integration fixtures that authenticate a user and seed a project/usecase/session.
  Batch 3 (2026-06-02): the side-effect-heavy tail was migrated using the uc-fixtures helpers (createProject/createActor/createUseCase/createStakeholder -> authenticated ProjectSetup{cookie,projectId}). Every mocked store-mutation assertion (savedLocks/updatedLocks/deletedLockIds, savedMemberships, sessionsByToken.size, etc.) was replaced with an OBSERVABLE check — a follow-up GET (e.g. lock create -> /v1/usecases/:id/who reflects held_by_session_id; release -> /who empty) or the real response body + set-cookie. Fully migrated + unit removed: auth-device, change-preview, goal-show, markdown-export, invitation, lock (+lock-routes-fixtures.ts), project (+project-routes-fixtures.ts), usecase, usecase-update, stakeholder, session-list -> 33/37 migrated, 4 unit files remain. The 4 remaining (change-commit, actor-management, stakeholder-management, session) are each TRIMMED to a single genuinely-HTTP-unreproducible defensive branch, with an in-file NOTE comment citing where the rest is covered: change-commit "preview use case no longer exists" 404 (in-memory store has no delete; archived use cases stay findable), actor-management + stakeholder-management "updates not configured" 500 (the wired store always implements updateActor/updateStakeholder), session AUTO_BRANCH_COLLISION 409 (auto-branch namer retries with random uuid suffixes, so a collision can't be forced via HTTP). These 4 are honest residuals — the mocked unit is the only way to exercise that defensive code path; not tautological. integration/http suite: 37 files, 116 tests green; full integration+unit/http: 263 tests green.
related:
  - docs/findings/2026-05-23T1730-coverage-diagnosis.md
  - apps/api/tests/unit/http
  - apps/api/tests/helpers/server.ts
---

# Findings — `tests/unit/http/*-routes.test.ts` are the anti-pattern coverage-diagnosis warned against

## Phase 1 resolution

Closed as `resolved: partial` in commit `629c842`.

Going forward, new HTTP routes should use the **route integration
pattern**: add at least one test under `apps/api/tests/integration/http/`
that starts the real test server through `apps/api/tests/helpers/server.ts`
and drives the route with `app.inject` via `server.fetch`. Existing
`apps/api/tests/unit/http/*-routes.test.ts` files are acknowledged
technical debt and should not be copied as the default pattern for new
routes.

Three exemplars now exist:

- `apps/api/tests/integration/http/doctor-route.test.ts`
- `apps/api/tests/integration/http/lock-route.test.ts`
- `apps/api/tests/integration/http/sync-route.test.ts`

Verification:

- `pnpm exec vitest run apps/api/tests/integration/http`

Phase 2 remains open: migrate the existing mocked route-unit back
catalog one route at a time. That migration is deliberately not part of
this cycle.

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

1. `doctor-routes` — migrated 2026-05-27 to the app.inject integration pattern.
2. `sync-routes` (data integrity — already a P0 elsewhere)
3. `signup-routes` (auth surface)
4. `lock-routes`, `session-routes` (concurrency-sensitive)
5. Remaining 32 route-unit files in alphabetical order

Stop point per cycle: any cycle that hits 3 RED→GREEN sub-finding
closures is a good cycle. Do not block on the full sweep.
