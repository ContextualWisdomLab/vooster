---
title: `vspec doctor` reports clean while per-use-case quality gates fail; it does not roll up `verify`
created_at: 2026-06-04T21:16:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# `vspec doctor` reports clean while per-use-case quality gates fail; it does not roll up `verify`

**TL;DR.** Have `doctor` aggregate per-use-case `verify` results (or at minimum report a non-ok status / actionable pointer when any use case fails its gates) so a clean doctor actually means clean specs. A 'doctor' that always passes while verify fails teaches the agent the wrong invariant.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: NTA.
Root-cause area: `apps/api/src/application (doctor aggregation) + docs/07-cli-spec.md doctor semantics`. Routing: codex.

## Evidence

Task asked the agent to "fix what doctor reports." Doctor only ran project-level checks (`project.exists`, `project.usecases.visible`) and returned `status: ok` (lines 47/52, 138). The real quality signals — POCKET-006 `scenario_completeness: fail` and `unlinked_steps` on 001..005 — only appear under `vspec verify <KEY>`, which the agent had to discover and loop manually (command 6, lines 31, 146). Narration lines 124-125: "Project-level doctor is clean but it points to per-use-case checks."

## Recommendation

Have `doctor` aggregate per-use-case `verify` results (or at minimum report a non-ok status / actionable pointer when any use case fails its gates) so a clean doctor actually means clean specs. A 'doctor' that always passes while verify fails teaches the agent the wrong invariant.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution evidence

- Added a project doctor regression proving active use-case failures roll up to
  `status: "issues_found"` with a `vspec doctor --usecase <KEY>` action.
- `pnpm exec vitest run apps/api/tests/unit/application/doctor.test.ts apps/api/tests/integration/http/doctor-route.test.ts`
  passes.
- `pnpm --filter @vooster/api typecheck` passes.
