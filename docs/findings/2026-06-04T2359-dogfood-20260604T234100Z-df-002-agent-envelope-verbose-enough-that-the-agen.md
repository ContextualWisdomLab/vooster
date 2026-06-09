---
title: Agent envelope verbose enough that the agent post-processed every result with python3
created_at: 2026-06-04T23:59:45Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T234100Z
related:
  - docs/dogfood-loop.md
---

# Agent envelope verbose enough that the agent post-processed every result with python3

**TL;DR.** Consider a terser agent-result shape or a documented quick-status field so agents don't hand-roll JSON extraction in their inner loop. At minimum verify the envelope leads with status + warnings + suggested_next_actions so a single read is sufficient without filtering.

Surfaced by the dogfood loop (cycle `20260604T234100Z`). QUANTS: TN.
Root-cause area: `apps/cli/src/domain/envelope.ts, apps/cli/src/commands/*-output.ts, apps/api/src/http`. Routing: codex.

## Evidence

Commands 9-27 (digest lines 34-44): every scenario/step `--format=agent` call is piped through `python3 -c "...json.load... print('status'...) print('warnings'...)"` to extract just status/warnings/next-actions — 12 times across the authoring loop. The agent read full output only during discovery; for the repetitive mutation loop it filtered the envelope down to a few fields.

## Recommendation

Consider a terser agent-result shape or a documented quick-status field so agents don't hand-roll JSON extraction in their inner loop. At minimum verify the envelope leads with status + warnings + suggested_next_actions so a single read is sufficient without filtering.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
