---
title: scenario add agent envelope: new scenario id location is ambiguous
created_at: 2026-06-04T23:03:54Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T224051Z
related:
  - docs/dogfood-loop.md
---

# scenario add agent envelope: new scenario id location is ambiguous

**TL;DR.** Document and stabilize the agent-format envelope for `scenario add` so the created entity id has one canonical, documented location (e.g. data.scenario.id), and surface it in a suggested_next_action that includes the id, so agents don't have to probe alternate fields.

Surfaced by the dogfood loop (cycle `20260604T224051Z`). QUANTS: NS.
Root-cause area: `apps/api/src/http/scenario-results.ts and apps/cli/src/commands/scenario-output.ts / packages/contracts — agent envelope shape for scenario add`. Routing: codex.

## Evidence

Line 34: to extract the created scenario id the agent had to defensively try two paths — `d['data'].get('scenario',{}).get('id') or d['data'].get('revision',{}).get('entity_id')` — indicating uncertainty about where the id lives in the `--format=agent` response for `vspec scenario add`.

## Recommendation

Document and stabilize the agent-format envelope for `scenario add` so the created entity id has one canonical, documented location (e.g. data.scenario.id), and surface it in a suggested_next_action that includes the id, so agents don't have to probe alternate fields.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
