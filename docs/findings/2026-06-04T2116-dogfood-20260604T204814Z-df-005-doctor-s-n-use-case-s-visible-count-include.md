---
title: Doctor's "N use case(s) visible" count includes archived specs that `usecase list` hides
created_at: 2026-06-04T21:16:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# Doctor's "N use case(s) visible" count includes archived specs that `usecase list` hides

**TL;DR.** Make the doctor count agree with the default `usecase list` scope (exclude archived), or relabel it to make the archived split explicit (e.g. "5 active, 1 archived"). Drift between doctor's count and list's scope is a contract bug, not cosmetic — it sent the agent on a long dead-end hunt.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: ATS.
Root-cause area: `apps/api/src/http (doctor route count) + apps/cli usecase list scope; vocabulary drift between "visible" and what `list` returns`. Routing: codex.

## Evidence

Digest lines 80/52/91: `vspec doctor` reports `"6 use case(s) visible in this project."` while command 3 `vspec usecase list` (and `pull`, line 36/128) shows only POCKET-001..005 = 5. The 6-vs-5 gap drove ~15 command groups (commands 8-22) and the entire investigation narration (lines 124-135: "doctor counts 6 use cases but only 5 sync... Let me hunt down the 6th"). The phantom was archived POCKET-006.

## Recommendation

Make the doctor count agree with the default `usecase list` scope (exclude archived), or relabel it to make the archived split explicit (e.g. "5 active, 1 archived"). Drift between doctor's count and list's scope is a contract bug, not cosmetic — it sent the agent on a long dead-end hunt.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution Evidence

- Added an integration regression in
  `apps/api/tests/integration/http/doctor-route.test.ts` proving doctor's
  `project.usecases.visible` count matches the default `usecase list` scope
  when archived use cases exist.
- Verification:
  `pnpm exec vitest run apps/api/tests/integration/http/doctor-route.test.ts`;
  `pnpm --filter @vooster/api typecheck`.
