---
title: Inserted step renders out of order in `usecase show` (order_index drifts from step_number)
created_at: 2026-06-04T21:16:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# Inserted step renders out of order in `usecase show` (order_index drifts from step_number)

**TL;DR.** On positional insert (`--at`), renumber/rebalance order_index so it stays consistent with step_number, and/or have the `usecase show` human renderer sort steps by step_number. Add a regression test that inserts mid-scenario and asserts order_index ordering equals step_number ordering across all output surfaces (human, agent, markdown).

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: QAST.
Root-cause area: `apps/api/src/application/step-editing.ts / scenario-authoring.ts (positional insert assigns step_number but leaves order_index appended) and apps/api/src/http/step-results.ts (human `usecase show` orders by order_index instead of step_number)`. Routing: codex.

## Evidence

Narration (digest lines 89-90): after `step add ... --at 2`, "the human view printed steps in an odd order (1, 3, 4, 2)" and "The step numbers are right (1-4) but the account step is stored at the end of the array — its order_index is out of sync with its step_number." The agent ran extra inspection commands (turns 13-14: `usecase show --format=agent | python3 ...` dumping step_number vs order_index) and re-synced (turns 15-16) to confirm the spec was not corrupt. The markdown render and agent payload were correctly ordered (1-4), so only the human `usecase show` surface and the persisted order_index were wrong.

## Recommendation

On positional insert (`--at`), renumber/rebalance order_index so it stays consistent with step_number, and/or have the `usecase show` human renderer sort steps by step_number. Add a regression test that inserts mid-scenario and asserts order_index ordering equals step_number ordering across all output surfaces (human, agent, markdown).

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

Step display ordering now has a single shared producer,
`orderScenarioStepsForDisplay`, used by the agent payload, markdown renderer, and
Gherkin renderer. The helper orders by `step_number` for output while the
existing positioning tests continue to lock contiguous `step_number` /
`order_index` updates for inserted and moved steps.

Verified:

- `pnpm --filter @vooster/api typecheck`
- `bash goals/57-dogfood-inserted-step-renders-out-of-order-in-usecase-show.gates.sh`
