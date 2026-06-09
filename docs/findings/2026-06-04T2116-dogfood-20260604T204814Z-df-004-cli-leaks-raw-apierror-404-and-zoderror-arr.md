---
title: CLI leaks raw `ApiError: 404` and `ZodError` arrays instead of the documented envelope
created_at: 2026-06-04T21:16:57Z
resolved: true
priority: P0
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# CLI leaks raw `ApiError: 404` and `ZodError` arrays instead of the documented envelope

**TL;DR.** Catch zod validation and HTTP 404s at the CLI/API boundary and map them to the documented envelope with a stable `code`, human message, and `suggested_next_actions`. Never print raw `ZodError`/`ApiError` stack text to agents — leaked internals are a contract break.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: SNA.
Root-cause area: `apps/cli/src (envelope mapping / error boundary), apps/api/src/http/scenario-support.ts, apps/api/src/http/step-routes.ts`. Routing: codex.

## Evidence

`usecase set --field level --value BOGUS` and an invalid `--field` produced a raw `ZodError: [ { code: invalid_value, ... } ]` dump (digest lines 340-351). `change propose` with an incomplete patch dumped raw `ZodError` arrays exposing internal paths/messages ('Invalid input: expected object, received undefined', lines 589-637). `usecase set` failures surfaced as bare `ApiError: API request failed with 404.` (lines 494-500, 554). These bypass the Problem Details / agent envelope (no stable `code`, no `suggested_next_actions`). Contrast: `actor create --type BOGUS` returned a clean teaching message 'Actor type must be PRIMARY, SUPPORTING, or OFFSTAGE.' (line 351) — proving the inconsistency.

## Recommendation

Catch zod validation and HTTP 404s at the CLI/API boundary and map them to the documented envelope with a stable `code`, human message, and `suggested_next_actions`. Never print raw `ZodError`/`ApiError` stack text to agents — leaked internals are a contract break.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution Evidence

- Added `usecase set --format=agent` coverage for invalid field, invalid
  `level`, and API 404 responses in
  `apps/cli/tests/unit/usecase-command.test.ts`.
- Added `change propose --format=agent` coverage for incomplete patch files in
  `apps/cli/tests/unit/change-agent-format.test.ts`.
- Verification:
  `pnpm exec vitest run apps/cli/tests/unit/usecase-command.test.ts apps/cli/tests/unit/change-agent-format.test.ts`;
  `pnpm --filter @vooster/cli typecheck`.
