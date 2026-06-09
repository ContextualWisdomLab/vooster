---
title: step add is append-only — no way to insert or reorder a step mid-scenario
created_at: 2026-06-04T19:10:26Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# step add is append-only — no way to insert or reorder a step mid-scenario

**TL;DR.** Add a first-class insert/reorder capability, e.g. `vspec step add --at <n>` or `vspec step move <id> --to <n>`, so a step rejected/added out of order can be placed without repurposing existing steps and triggering breaking revisions. Document it in the ai-guide authoring flow.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: NAT.
Root-cause area: `apps/cli/src (step add command) and apps/api/src/application/step-editing.ts; docs/07-cli-spec.md step authoring surface`. Routing: codex.

## Evidence

After the passive-voice rejection, the save step landed as step 2 (lines 286-289) and there was no insert command, forcing a workaround the agent narrated (lines 109-110): "Step add only appends, no insertion. I'll repurpose the current step 2 (save) into the validation step ... then append a fresh save step." The step add help confirms: "step add appends; use step edit for existing step wording." The workaround required a step edit, starting a pinned session, and produced a BREAKING revision (line ~351 "Revision BREAKING version 7").

## Recommendation

Add a first-class insert/reorder capability, e.g. `vspec step add --at <n>` or `vspec step move <id> --to <n>`, so a step rejected/added out of order can be placed without repurposing existing steps and triggering breaking revisions. Document it in the ai-guide authoring flow.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

Implemented `vspec step add --at <n>` and `vspec step move <id> --to <n>` on a
shared `resequenceScenarioSteps` path.

Verified with:

- `pnpm exec vitest run apps/api/tests/unit/application/scenario-step-positioning.test.ts apps/cli/tests/unit/step-positioning.test.ts packages/contracts/tests/scenario.test.ts`
- `pnpm --filter @vooster/api typecheck`
- `pnpm --filter @vooster/cli typecheck`
- `bash goals/46-dogfood-step-add-is-append-only-no-way-to-insert-or-reorde.gates.sh`
