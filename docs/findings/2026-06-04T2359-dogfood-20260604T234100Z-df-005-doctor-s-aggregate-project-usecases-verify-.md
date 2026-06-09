---
title: Doctor's aggregate `project.usecases.verify` + 'visible'/'deeper quality checks' wording makes the agent re-do the per-use-case work
created_at: 2026-06-04T23:59:45Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T234100Z
related:
  - docs/dogfood-loop.md
---

# Doctor's aggregate `project.usecases.verify` + 'visible'/'deeper quality checks' wording makes the agent re-do the per-use-case work

**TL;DR.** Have doctor surface the per-use-case verify results it already ran (e.g. list each checked key under the `project.usecases.verify` check, or state explicitly that the aggregate is exhaustive across all visible use cases) so an agent does not distrust the green summary and redo the verification. Clarify the 'visible' qualifier (what is excluded and why) inline. Routing codex (TDD).

Surfaced by the dogfood loop (cycle `20260604T234100Z`). QUANTS: TS.
Root-cause area: `apps/api/src/application/doctor.ts and CLI doctor output formatting (apps/cli/src) — aggregate verify check hides the per-use-case detail it already computed`. Routing: codex.

## Evidence

Doctor reported `project.usecases.verify pass — All visible use case quality checks pass` (digest lines 45, 96-98). Agent narration (digest lines 85-88, 99-100): 'Doctor passes at project level but hints at deeper per-use-case checks. Let me run verify on each use case.' and 'Doctor's summary check could in principle hide per-spec issues, so I didn't take it on faith. I ran vspec usecase verify on all five ... and read the full content of each.' The aggregate check did not expose per-use-case results, so the agent independently re-ran verify on all 5 and read every spec, plus probed archived/workspace/project buckets the 'visible' qualifier hinted at.

## Recommendation

Have doctor surface the per-use-case verify results it already ran (e.g. list each checked key under the `project.usecases.verify` check, or state explicitly that the aggregate is exhaustive across all visible use cases) so an agent does not distrust the green summary and redo the verification. Clarify the 'visible' qualifier (what is excluded and why) inline. Routing codex (TDD).

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
