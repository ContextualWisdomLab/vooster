---
title: session complete requires explicit session-id despite an open session
created_at: 2026-06-04T19:10:26Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# session complete requires explicit session-id despite an open session

**TL;DR.** Let `session complete` default to the single active session when unambiguous, or make the error self-teaching: a stable code plus suggested_next_actions pointing at how to list/find the active session id instead of a bare `Missing session-id.`

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: ANST.
Root-cause area: `apps/cli/src/commands (session complete) / apps/api session resolution`. Routing: codex.

## Evidence

Command 15 (digest line 40): `vspec session complete` (no id) failed with `Error: Missing session-id.` (line 1322), forcing command 16 (line 41) `vspec session complete f9d59a82-aab2-4971-b3e8-bc1ed61b4de5`. The agent had just opened exactly one session in command 9 and narrated "complete the session I opened" (line 141), so it expected the active session to be resolvable.

## Recommendation

Let `session complete` default to the single active session when unambiguous, or make the error self-teaching: a stable code plus suggested_next_actions pointing at how to list/find the active session id instead of a bare `Missing session-id.`

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
