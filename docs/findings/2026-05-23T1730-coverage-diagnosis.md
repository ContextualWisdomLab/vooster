---
title: "Coverage threshold miss: diagnose per file before adding tests or excluding"
created_at: 2026-05-23T17:30:00Z
priority: P1
resolved: true
resolved_by:
  - a1758ad
related:
  - docs/findings/2026-05-23T1715-world-state-separation.md
  - vitest.config.ts
  - goals/_meta.gates.sh
---

# Findings — coverage threshold miss is real, but the fix needs per-file diagnosis

_Recorded 2026-05-23 after `_meta` M.3 reported branch coverage at
74.66% vs the 75% threshold. The session debate questioned whether
adding unit tests vs adding coverage excludes was the right move._

## TL;DR

The 0.34%p coverage miss is **real** — it's not a measurement artifact.
But the binary "add tests vs exclude" framing is wrong. Per-file
diagnosis falls into four buckets, each demanding a different fix.
Most `*-support.ts` files at 0% turn out to be **real test gaps** at
the HTTP-route layer, not "tested via E2E but blind to the coverage
tool." That changes the action plan: write route-level integration
tests (not unit tests in isolation) for the uncovered routes.

## What was investigated

The coverage report flagged dozens of files with very low or zero
coverage, concentrated in `apps/api/src/http/*-support.ts`. Worst
offenders:

```
apps/api/src/http/session-pin-support.ts     0%
apps/api/src/http/change-preview-support.ts  0%
apps/api/src/http/usecase-support.ts         0%
apps/api/src/http/scenario-support.ts        7.4%
apps/api/src/http/step-session-support.ts    5.26%
apps/api/src/http/step-lock-support.ts       11.11%
apps/api/src/http/sync-result-support.ts     20%
apps/api/src/http/lock-support.ts            27.27%
apps/api/src/http/membership-support.ts      11.53%
apps/api/src/http/signup-support.ts          64.17%
```

The reflex options on the table:

- (a) **Add unit tests** to chase the number up.
- (b) **Add coverage excludes** to make the warning go away.

The investigation below shows why both are wrong as stated.

## Critical finding: these are NOT "E2E-only, coverage blind"

Initial hypothesis: these support files are exercised by E2E tests
that launch a separate process, so the v8 coverage instrument (which
only sees in-process code) misses them. **Confirmed false.**

`apps/api/tests/helpers/server.ts` shows API tests run Fastify
**in-process** via `app.inject(...)`:

```ts
export async function startServer(): Promise<TestServer> {
  const app = await createServer({ authStub: true });
  return {
    fetch: async (path, init) => {
      const response = await app.inject({ method: ..., url: ..., ... });
      return new Response(...);
    },
    ...
  };
}
```

`vitest.config.ts` includes `apps/api/src/**/*.ts` in coverage and
runs API e2e/integration tests in the same vitest process. Therefore:

- Every route handler that any test hits **is** coverage-instrumented.
- A 0% coverage on `session-pin-support.ts` means no test exercises a
  code path that imports it — not that "tests exist but tool is
  blind."

This shifts the diagnosis. The 0% files are **real test gaps** at the
HTTP layer.

## Four classes a 0% file can fall into

The per-file diagnostic question is "who imports this, and what tests
exercise the importer?"

### Class 1 — Real test gap (likely most cases)

File is imported by a `*-routes.ts`. The route is registered. But no
test under `apps/api/tests/` exercises that route via `app.inject`.

Example: `session-pin-support.ts` exports `resolvePins`, called from
`session-routes.ts`. A grep across `apps/api/tests/` for `/sessions/`
or `sessionPin` shows no integration test hitting the pin endpoint.
The helper has 0% because the endpoint has 0% because it's untested
at the HTTP layer.

**Right fix**: write a **route-level integration test** under
`apps/api/tests/integration/` that calls the endpoint via the test
server. Not a unit test for `resolvePins` in isolation. The route
test exercises the helper transitively and asserts user-visible
behavior at the endpoint contract.

### Class 2 — Orphaned (dead code)

File exists, nothing imports it. Lingering refactor artifact.

**Right fix**: delete. Adding tests for dead code is the worst of
both worlds.

### Class 3 — Exercised but only on happy path

File is imported, route is tested, but the test only covers one
branch. The error / edge paths register as uncovered.

**Right fix**: add the missing test cases to the **existing route
test**. Again, not isolation unit tests for the helper.

### Class 4 — Defensive code that can't realistically fire

File contains exhaustiveness checks (`assertNever`, fallthrough
default cases) that exist for type safety but can never execute at
runtime.

**Right fix**: explicit `/* c8 ignore next */` on the defensive line,
with a one-line comment explaining why. Surgical, not file-level
exclude.

## What's wrong with the easy paths

### Wrong: blanket add unit tests for `*-support.ts`

These helpers exist to be _called by HTTP routes with fastify request
context_. Testing them in isolation requires mocking every store, every
fastify type, every error-shape. The result is tautological assertions
("I called `lockStore.find()`, then I returned a `MISSING` shape — and
the test verifies I did") that prove nothing about real behavior.

A real bug — a missing `await`, a wrong stakeholder lookup, a
forgotten lock check — won't surface in the isolated unit test
because the mock confirms whatever the implementation did. The same
bug **will** surface in the route test that asserts the response shape
of `POST /sessions/.../pin`.

### Wrong: file-level coverage excludes for `*-support.ts`

This silences the warning without addressing the gap. Tomorrow a
genuinely untested support file gets added; it sits at 0% under the
same exclude pattern; nobody notices. The exclude needs to be either
**per-file with rationale** (Class 4) or **none**.

### Right: lower the threshold to 74%

Tempting and trivial, but starts a ratchet — when did 75 become
sacred, and what stops it sliding to 73 next month? The threshold
itself was a one-time judgment call; preserve it and fix the actual
gap.

## Action plan (do **not** execute as part of goal-30)

1. **Per-file classification.** For each `*-support.ts` at <50%
   coverage, run:

   ```
   grep -rln "<base name>" apps/api/src apps/api/tests
   ```

   - Zero hits in `src/` → Class 2 → delete (separate PR).
   - Hits in `src/*-routes.ts`, zero hits in `tests/` → Class 1.
   - Hits in `src/` and `tests/`, partial coverage → Class 3.
   - Suspicious of defensive code → read the file, find the dead
     branches → Class 4.

2. **For Class 1**: write a route-level integration test per missing
   endpoint. Existing pattern:
   `apps/api/tests/integration/<resource>-routes.test.ts` using the
   `startServer` helper. Assert response shapes, status codes, error
   paths — not helper internals.

3. **For Class 2**: delete and commit.
   `refactor(api): delete unused <file>; was orphaned during <prior
refactor>`.

4. **For Class 3**: extend the existing route test to cover the
   missing branch — usually one new `test()` block.

5. **For Class 4**: surgical `/* c8 ignore next */` with rationale.

After the sweep, branch coverage will land somewhere above 75% from
real tests; the threshold stays at 75; the metric finally measures
what it claims.

## Why this matters beyond the 0.34%p

The pattern — 0% coverage at the HTTP support layer — is hiding a
real gap in the test pyramid:

- **Application** layer (`apps/api/src/application/`): high coverage
  (~95%) via the unit tests in `apps/api/tests/unit/application/`.
- **HTTP support / routes** layer (`apps/api/src/http/`): low
  coverage. No tests directly hit many of these endpoints.
- **CLI E2E** (`apps/cli/tests/e2e-cli/`): hits the routes via a
  spawned CLI, but those are out-of-process and don't generate
  coverage.

The middle layer is the thinnest test layer in the codebase. CLI E2E
catches end-to-end behavior; application unit tests catch
business-logic invariants; **nothing systematically catches HTTP
contract regressions** — the exact thing route-level integration
tests would cover.

The coverage threshold accidentally surfaced this. The fix is not
the threshold; the fix is the missing middle layer of the test
pyramid.

## Estimate

- Per-file classification sweep: ~1 hour for ~15 files.
- Class 2 deletions: ~30 minutes including diff review.
- Class 1 route-level integration tests: ~30 minutes per endpoint
  (likely 5–8 endpoints). 2.5–4 hours total.
- Class 3 / 4 patches: ~30 minutes total.

Total: half-day to a full day. Out of goal-30's scope; should be its
own goal or queued as a follow-up. The 0.34%p threshold miss does
not need to block goal-30 activation once world-state checks are
separated (see
[2026-05-23T1715-world-state-separation.md](./2026-05-23T1715-world-state-separation.md)).

## Open question

Should the route-level integration tests be a new goal (e.g.
`goals/32-http-coverage.md`)? Argument for: enforces the test pyramid
explicitly with a universal-claim gate ("every `*-routes.ts` has at
least one integration test"). Argument against: gates over-coupling
risk — coverage threshold itself already enforces the invariant
behaviorally. Pick gate vs threshold per
[`goal-design.md §1.5`](../goal-design.md#15-gates-가-하지-말아야-할-것).
Tentative: just let the coverage threshold pull the work in.

## Resolution

Resolved on 2026-05-23 by `a1758ad`.

The sweep confirmed the coverage miss had at least one honest Class 2
component: several low/zero-coverage HTTP support files were orphaned and should
not have tests added around them. Deleted:

- `apps/api/src/http/scenario-extension-support.ts`
- `apps/api/src/http/session-branch-support.ts`
- `apps/api/src/http/usecase-support.ts`
- `apps/api/src/http/merge-conflict-support.ts`

Classification notes from the current worst-offender list:

| File                                                              | Class   | Prescription                                                                                                                     |
| ----------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `scenario-extension-support.ts`                                   | Class 2 | Deleted; no imports in `apps/api/src` or `apps/api/tests`.                                                                       |
| `session-branch-support.ts`                                       | Class 2 | Deleted; superseded by application session branching.                                                                            |
| `usecase-support.ts`                                              | Class 2 | Deleted; use case creation now owns this logic elsewhere.                                                                        |
| `merge-conflict-support.ts`                                       | Class 2 | Deleted; stale re-export with no importers.                                                                                      |
| `session-pin-support.ts`                                          | Class 3 | Route tests cover user-visible pin failures; remaining exported internals are cleanup candidates, not support-unit-test targets. |
| `scenario-support.ts`                                             | Class 3 | Exercised through scenario and step routes; remaining branches are route edge cases.                                             |
| `step-session-support.ts`                                         | Class 3 | Test-only route support; invalid-body branch is uncovered.                                                                       |
| `step-lock-support.ts`                                            | Class 3 | Test-lock route and lock problems are exercised, with edge branches remaining.                                                   |
| `sync-result-support.ts`                                          | Class 3 | Push/sync routes cover normal/conflict behavior; network-failure branch remains route-testable.                                  |
| `lock-support.ts` / `membership-support.ts` / `signup-support.ts` | Class 3 | Imported by live routes; remaining misses are branch/edge-path route tests, not exclusions.                                      |

Verification:

- `pnpm exec tsc --noEmit`
- `pnpm exec eslint --max-warnings 0 apps/api/src/http`
- `env -u VSPEC_GATES_SKIP_DEEP bash goals/_meta.gates.sh`

The full meta gate passed after the deletion, including `vitest run --coverage`
and all app builds, with the 75% branch threshold unchanged.
