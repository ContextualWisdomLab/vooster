---
title: "Doctor route hardening: auth ordering, query contract, severity policy"
created_at: 2026-05-23T18:36:00Z
priority: P1
resolved: true
resolved_by:
  - 1fb143c
  - ff68dac
related:
  - docs/findings/2026-05-23T1825-doctor-route.md
  - apps/api/src/http/doctor-routes.ts
  - apps/api/src/application/doctor.ts
---

# Findings — `GET /v1/doctor` ships with three rough edges before beta

## Resolution

Closed in RED/GREEN commits `1fb143c` and `ff68dac`.

- Tranche A: the route now authenticates first and returns 403 before
  any project/usecase lookup for anonymous requests. Use-case doctor
  requests resolve only the owning project before membership checks, then
  run the full diagnosis after authorization.
- Tranche B: the HTTP and CLI contract now uses `usecase` for id-or-key
  lookup semantics, and the doctor result missing-status discriminators
  are normalized to `project_not_found` / `usecase_not_found`.
- Tranche C: a main-success scenario with zero steps is now a `fail`,
  matching the severity of a missing main-success scenario.

Verification:

- `pnpm exec vitest run apps/api/tests/unit/application/doctor.test.ts apps/api/tests/unit/http/doctor-routes.test.ts apps/api/tests/e2e/doctor-route.test.ts apps/cli/tests/unit/doctor-command.test.ts apps/cli/tests/e2e-cli-honest/doctor.test.ts`
- `pnpm exec eslint --max-warnings 0 --no-warn-ignored apps/api/src/application/doctor.ts apps/api/src/http/doctor-routes.ts apps/cli/src/commands/doctor.ts apps/api/tests/unit/application/doctor.test.ts apps/api/tests/unit/http/doctor-routes.test.ts apps/api/tests/e2e/doctor-route.test.ts apps/cli/tests/unit/doctor-command.test.ts`
- `pnpm exec tsc --noEmit`
- `rg '"USECASE_NOT_FOUND"|"PROJECT_NOT_FOUND"' apps/api/src/application/doctor.ts apps/api/src/http/doctor-routes.ts apps/cli/src/commands/doctor.ts apps/api/tests/unit/application/doctor.test.ts apps/api/tests/unit/http/doctor-routes.test.ts apps/api/tests/e2e/doctor-route.test.ts apps/cli/tests/unit/doctor-command.test.ts` returns no matches.

## TL;DR

The freshly-landed `/v1/doctor` route (commit `6fae71a`, closing the
A2/B5 sub-finding) is functional but has three issues to clean up
before the May-30 beta: (A) it reads the database **before** checking
membership — a timing-oracle and unnecessary load; (B) its wire
contract leaks implementation details (`usecase_id` query param
actually accepts id-or-key; `status` union mixes SCREAMING*SNAKE with
snake_case); (C) the check severity assignment (`fail` vs `warning`)
lacks documented rationale. All three are cheapest to fix \_before*
external integrations form.

## Tranche A — auth ordering (security hygiene)

### Reproducer

`apps/api/src/http/doctor-routes.ts:40-94`:

```ts
async function diagnose(request, reply, state, deps) {
  const parsed = doctorQuery.safeParse(request.query);
  if (!parsed.success || bothOrNeither(...)) {
    return reply.code(400).send(...);
  }

  if (parsed.data.usecase_id !== undefined) {
    const result = await diagnoseUseCase(deps, parsed.data.usecase_id);  // ← DB call before auth
    return sendDoctorResult(request, reply, state, deps, result);
  }

  const projectId = parsed.data.project_id;
  ...
  const result = await diagnoseProject(deps, projectId);  // ← DB call before auth
  return sendDoctorResult(...);
}
```

`sendDoctorResult` at line 69-94 only runs `membershipForProject`
**after** the diagnose has already fetched the use case (+ its
project), scenarios, steps, and stakeholder interests.

### Concrete impact

1. **Existence oracle**: unauthenticated requester learns whether a
   use case UUID/key exists by comparing 404 (use case not found,
   pre-auth) vs 403 (use case exists, not authorized, post-auth).
2. **DB load**: every unauthorized request still performs ~5 store
   calls per request — useful for a probe-and-DDoS scenario, useless
   for legitimate flows.

### Proposed fix

Introduce a cheap "which project owns this use case" lookup (or
re-use `findUseCaseWithProject` but discard the body) and re-order:

```
parse → resolve project_id (lightweight) → membershipForProject → diagnose
```

Suggested store method (if not already present):
`UseCaseStore.findProjectIdFor(usecaseIdOrKey): Promise<string | undefined>`
returning just the FK column — single-row, single-column scan.

### Acceptance signal

- Integration test: anon request to `/v1/doctor?usecase_id=<existing>`
  returns **403** identical to anon request to
  `/v1/doctor?usecase_id=<nonexistent>` (both 403, indistinguishable).
- Integration test asserts that the `useCaseStore.findUseCaseWithProject`
  / `scenarioStore.findMainScenario` / `stepStore.listSteps` /
  `stakeholderInterestStore.listStakeholderInterests` mocks are **not**
  called when membership check fails.

## Tranche B — query contract (wire format, pre-beta)

### Reproducer

1. `apps/api/src/http/doctor-routes.ts:20` declares the param as
   `usecase_id`:

   ```ts
   const doctorQuery = z.object({
     project_id: z.string().min(1).optional(),
     usecase_id: z.string().min(1).optional()
   });
   ```

   But `diagnoseUseCase` calls
   `deps.useCaseStore.findUseCaseWithProject(usecaseIdOrKey)`
   (`apps/api/src/application/doctor.ts:79`) which resolves the
   argument as id-or-key. The HTTP wire name lies about the contract.

2. `apps/api/src/application/doctor.ts:14-29` mixes case styles in the
   discriminator:

   ```ts
   export type DoctorResult =
     | { status: "PROJECT_NOT_FOUND" }
     | { status: "USECASE_NOT_FOUND" }
     | {
         status: "issues_found" | "ok";
         ...
       };
   ```

   CLI consumers must parse two style families per response.

### Proposed fix

- Rename query param `usecase_id` → `usecase` (Cockburn-style id-or-key
  semantics) **or** `usecase_id_or_key`. Recommend `usecase` for
  brevity. Update the route's zod schema, the CLI parser, and any docs.
- Normalize the `status` union to a single style. Recommend
  snake_case throughout: `"project_not_found" | "usecase_not_found" |
"issues_found" | "ok"`. Update `sendDoctorResult` mapping and CLI
  parser.

### Acceptance signal

- Schema snapshot test under `apps/api/tests/integration/` asserts the
  exact zod shape of the request query and the response discriminator.
- CLI test (`apps/cli/tests/e2e-cli-honest/doctor.test.ts` or unit)
  asserts it sends the new param name and recognizes the normalized
  status values.
- Grep: `rg '"USECASE_NOT_FOUND"|"PROJECT_NOT_FOUND"' apps` returns 0.

## Tranche C — severity policy (UX)

### Reproducer

`apps/api/src/application/doctor.ts:113-149`:

```ts
{ id: "main_success.present", status: hasMainScenario ? "pass" : "fail" },
{ id: "main_success.steps",   status: mainStepCount === 0 ? "warning" : "pass" }
```

A use case _with_ a main scenario but _zero_ steps is `warning`. A use
case _without_ a main scenario is `fail`. Both states are equally
"the use case is unusable for export". The user-visible rationale for
why one is red and the other is yellow is undocumented.

### Proposed fix

Two acceptable choices:

- **C-fail**: both become `fail`. Cleaner mental model — "missing
  required Cockburn element" is always red.
- **C-document**: keep the split, but add a one-line message field
  explaining "you have a scenario but no steps — add steps before
  export", and document the rationale in
  `docs/02-cockburn-model.md` (or wherever doctor semantics live).

Recommend **C-fail**. Beta users will not read severity docs; a
consistent rule is kinder.

### Acceptance signal

- Unit test on `useCaseChecks` (or whichever helper) asserts both
  checks share the chosen severity.

## Why P1, not P0

The auth ordering leaks _use case existence_, not PII or credentials.
The wire-format and severity issues are UX cleanup. None of these
silently corrupt user data (which would be P0 — see the sync-conflict
finding). All three are cheaper to fix now (pre-beta) than after
external integrations form.

## Goal promotion judgment

- Tranche A could promote as part of a broader "every authenticated
  route checks membership before any non-lookup DB call" universal,
  but enforcing that as a grep is hard (call-graph analysis). Better
  handled here as a targeted fix + integration test.
- B and C are one-shot wire/UX work — no universal claim.
- Recommendation: do **not** promote to a goal. Handle as a single
  finding-driven PR with three commits (A → B → C tranche order).
