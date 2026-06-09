---
title: Use-case `level` is effectively immutable: `usecase set` 404s and `change propose` silently drops it
created_at: 2026-06-04T21:16:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# Use-case `level` is effectively immutable: `usecase set` 404s and `change propose` silently drops it

**TL;DR.** Make `level` a first-class mutable field: either expose a working `usecase set --field level` route or have `change propose` accept and diff/persist `level` in its patch `fields`. Silently dropping a provided field is a correctness bug — at minimum reject unknown/unsupported fields with a self-teaching error. Cockburn levels are core to spec fidelity, so this is a core-workflow capability gap.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: QNAT.
Root-cause area: `apps/api/src/http (usecase set/change-propose routes), apps/api/src/application/usecases.ts, packages/contracts/src/scenario.ts`. Routing: codex.

## Evidence

Narration lines 202-211, 243: agent set out to promote umbrella POCKET-006 to SUMMARY. `vspec usecase set --field level --value SUMMARY POCKET-006` returned `ApiError: API request failed with 404` (digest lines 494-500, 554). The documented alternate path `change propose` was tried with a full-field patch (lines 99-119) but `.data.diff` only ever contained `title` (line 78/119/210). Agent's conclusion (line 211): 'level is silently ignored by both usecase set (404) and change propose'; it archived the umbrella rather than leave a mis-leveled duplicate. Levels SUMMARY/USER_GOAL/SUBFUNCTION are a documented enum (line 195).

## Recommendation

Make `level` a first-class mutable field: either expose a working `usecase set --field level` route or have `change propose` accept and diff/persist `level` in its patch `fields`. Silently dropping a provided field is a correctness bug — at minimum reject unknown/unsupported fields with a self-teaching error. Cockburn levels are core to spec fidelity, so this is a core-workflow capability gap.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution Evidence

- Added an honest CLI regression in
  `apps/cli/tests/e2e-cli-honest/usecase-write.test.ts` for the dogfood
  command shape `vspec usecase set --field level --value SUMMARY <usecase>`.
- Fixed the top-level CLI route so `usecase set` resolves the target argument
  even when flags precede the use case key, then verified the command prints
  `Level SUMMARY`.
- Verified API persistence with
  `apps/api/tests/integration/http/usecase-update-route.test.ts`.
- Verification:
  `pnpm exec vitest run apps/cli/tests/e2e-cli-honest/usecase-write.test.ts`;
  `pnpm exec vitest run apps/api/tests/integration/http/usecase-update-route.test.ts`;
  `pnpm exec vitest run apps/cli/tests/unit/dispatcher-routes.test.ts apps/cli/tests/unit/usecase-command.test.ts`.
