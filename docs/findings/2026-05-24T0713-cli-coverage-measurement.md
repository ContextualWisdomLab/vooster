---
title: "CLI source coverage is under-measured by spawn-heavy e2e tests"
created_at: 2026-05-24T07:13:00Z
resolved: true
priority: P1
status_notes: |
  2026-05-24 — Closed in the current working tree: @vooster/cli now has test:unit, test:e2e, and test:coverage scripts; vitest.cli-unit.config.ts gates the in-process CLI unit surface at 80/75 thresholds; spawned CLI e2e remains the behavior coverage surface.
  2026-05-24 — Common CLI HTTP client unit coverage was added, and the broad all-source CLI measurement moved from statements 57.5% / branches 43.62% to statements 58.22% / branches 44.15%. That broad measurement remains diagnostic-only because spawned CLI e2e tests validate behavior but do not instrument apps/cli/src in Vitest coverage.
related:
  - vitest.config.ts
  - apps/cli/tests/e2e-cli/helpers.ts
  - apps/cli/tests/e2e-cli-honest
  - apps/cli/tests/unit/http-client.test.ts
  - docs/findings/2026-05-23T1730-coverage-diagnosis.md
---

# CLI source coverage is under-measured by spawn-heavy e2e tests

## TL;DR

The API coverage gate is healthy, but it is not a whole-product source
coverage statement: `vitest.config.ts` includes `apps/api/src/**/*.ts`
only. A separate CLI source coverage run shows low measured coverage,
even though many CLI behaviors are covered by honest e2e tests. The
reason is structural: CLI e2e tests spawn a child process, so Vitest's
in-process V8 coverage does not count most `apps/cli/src` execution.

## Evidence

Current root coverage scope:

```ts
// vitest.config.ts
coverage: {
  include: ["apps/api/src/**/*.ts"],
  thresholds: {
    branches: 75,
    functions: 80,
    lines: 80,
    statements: 80
  }
}
```

Current root gate result on 2026-05-24:

```text
VSPEC_COVERAGE_DIR=coverage/current pnpm test:coverage
Test Files  288 passed (288)
Tests       912 passed (912)
Statements 99.23%
Branches   93.16%
Functions  99.83%
Lines      99.22%
```

That number is valid for API source coverage, because API e2e tests run
the Fastify server in-process through `apps/api/tests/helpers/server.ts`.
It is not valid for CLI source coverage.

Separate CLI source coverage measurement:

```text
VSPEC_COVERAGE_DIR=coverage/cli pnpm exec vitest run apps/cli/tests \
  --coverage --coverage.include='apps/cli/src/**/*.ts' --coverage.reporter=text

Test Files  109 passed (109)
Tests       194 passed (194)
Statements 58.22%
Branches   44.15%
Functions  68.37%
Lines      58.44%
```

This is not just "missing tests"; it is mixed evidence. Some modules
are genuine unit-test gaps, and some are intentionally covered by e2e
tests that spawn the real CLI:

- `apps/cli/tests/e2e-cli/helpers.ts` imports `spawn` from
  `node:child_process` and runs the CLI as a child process.
- `apps/cli/tests/e2e-cli-honest/` contains the honest CLI behavior
  suite, also using the same `runCli` helper.
- Spawned child process execution is outside Vitest's in-process V8
  coverage collection.

## What was improved immediately

The common HTTP client is shared by many CLI commands and was not
directly unit-tested. `apps/cli/tests/unit/http-client.test.ts` now
covers:

- JSON request construction and `set-cookie` propagation.
- `POST`, `PATCH`, `DELETE`, explicit `fetchJson`, and text responses.
- JSON error bodies.
- non-JSON error bodies and `isApiError` narrowing.

This moved the separate CLI source coverage measurement from statements
57.5% / branches 43.62% to statements 58.22% / branches 44.15%.

## Resolution

Do not add `apps/cli/src/**/*.ts` to the root `vitest.config.ts`
coverage include with the current global thresholds. That creates a red
gate that mostly measures instrumentation topology, not product risk.

The CLI quality signals are split into two explicit surfaces:

1. **CLI unit coverage surface** — pure/shared modules that can be
   imported in-process (`http-client`, flags, output renderers,
   envelope builders, local state, mutation runner). This is now gated
   by `vitest.cli-unit.config.ts` and `pnpm --filter @vooster/cli
test:coverage`.
2. **CLI command behavior surface** — spawned CLI e2e and honest e2e
   suites. This is now runnable as `pnpm --filter @vooster/cli
test:e2e` and should be treated as behavioral contract coverage, not
   V8 line coverage.

## Acceptance signal

Verified on 2026-05-24:

- A dedicated CLI coverage command/config exists and includes only
  in-process-testable CLI source modules, with thresholds that pass
  without weakening the API coverage gate.
- This finding states explicitly that `apps/cli/tests/e2e-cli*` are
  behavior coverage, not V8 source coverage.
- `VSPEC_CLI_COVERAGE_DIR=coverage/cli-unit pnpm --filter @vooster/cli
test:coverage` passes: 32 files / 107 tests, statements 88.42%,
  branches 78.64%, functions 96.66%, lines 88.42%.
- `pnpm --filter @vooster/cli test:e2e` passes: 77 files / 87 tests.
