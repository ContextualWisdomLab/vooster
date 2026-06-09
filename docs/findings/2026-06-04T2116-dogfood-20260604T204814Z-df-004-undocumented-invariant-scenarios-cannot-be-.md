---
title: Undocumented invariant: scenarios cannot be added until the use case has >=1 stakeholder interest, surfaced only as a late SCHEMA_INVALID
created_at: 2026-06-04T21:16:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# Undocumented invariant: scenarios cannot be added until the use case has >=1 stakeholder interest, surfaced only as a late SCHEMA_INVALID

**TL;DR.** Attach `suggested_next_actions` to the SCHEMA_INVALID error pointing to `usecase add-stakeholder`, and document the ordering (stakeholder interest before scenarios) in `ai-guide`. Better still, reconsider whether scenario creation should hard-block on stakeholder interests at all, or warn instead.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: NAT.
Root-cause area: `apps/api/src/http/scenario-routes.ts / scenario-support.ts, apps/api/src/application/ai-guide.ts`. Routing: codex.

## Evidence

Agent repeatedly misread the failure as 'transient' across multiple retries on POCKET-003/005/004 (narration lines 214-219), then discovered the real rule on POCKET-004 (lines 222-223, 241): `SCHEMA_INVALID: Use case needs at least one stakeholder interest` (digest lines 850-851). The prerequisite is not stated in `ai-guide` and the scenario-add error offered no `suggested_next_actions` pointing at `usecase add-stakeholder`, so the agent burned turns guessing.

## Recommendation

Attach `suggested_next_actions` to the SCHEMA_INVALID error pointing to `usecase add-stakeholder`, and document the ordering (stakeholder interest before scenarios) in `ai-guide`. Better still, reconsider whether scenario creation should hard-block on stakeholder interests at all, or warn instead.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution Evidence

- Added scenario authoring/result coverage for the stakeholder-interest
  prerequisite and the remedial `suggested_next_actions`.
- Added AI guide coverage proving markdown and JSON guide output state:
  "Add at least one stakeholder interest before creating scenarios."
- Verification:
  `pnpm exec vitest run apps/api/tests/unit/application/scenario-authoring.test.ts apps/api/tests/unit/http/scenario-results.test.ts apps/api/tests/unit/application/ai-guide.test.ts`;
  `pnpm --filter @vooster/api typecheck`.
