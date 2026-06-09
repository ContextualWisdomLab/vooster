---
title: agent-format scenario envelope conflates scenario.id and revision.id
created_at: 2026-06-04T23:03:54Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T224051Z
related:
  - docs/dogfood-loop.md
---

# agent-format scenario envelope conflates scenario.id and revision.id

**TL;DR.** Contract/guide clarity: distinguish the two ids in agent output and docs — e.g. label the scenario entity id as `scenario_id` distinctly from `revision_id`, or document in ai-guide that `data.scenario.id` is the value `step add` consumes, so agents don't grep ambiguously.

Surfaced by the dogfood loop (cycle `20260604T224051Z`). QUANTS: NS.
Root-cause area: `apps/api/src/http/scenario-results.ts / packages/contracts/src (scenarioCreateResponseSchema shape); docs/07-cli-spec.md`. Routing: codex.

## Evidence

Digest line 38 the agent piped scenario add output through `grep -A2 '"id"' | head -6`; agent narration (line 115): "The human-readable scenario add output didn't obviously distinguish the scenario entity id from the revision id, which briefly cost me a detour." The scenario create response (scenario-results.ts CREATED case) sends both `scenario` (with id) and `revision` (with id), so a naive grep for `"id"` matches both.

## Recommendation

Contract/guide clarity: distinguish the two ids in agent output and docs — e.g. label the scenario entity id as `scenario_id` distinctly from `revision_id`, or document in ai-guide that `data.scenario.id` is the value `step add` consumes, so agents don't grep ambiguously.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
