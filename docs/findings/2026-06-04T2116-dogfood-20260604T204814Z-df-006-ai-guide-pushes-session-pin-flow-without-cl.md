---
title: ai-guide pushes session + --pin flow without clarifying it is optional for greenfield creation
created_at: 2026-06-04T21:16:57Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# ai-guide pushes session + --pin flow without clarifying it is optional for greenfield creation

**TL;DR.** Guide fix: explicitly state that sessions/--pin are only needed for concurrent edits of existing use cases, and that the greenfield create → scenario → step path needs no session, so agents don't pause to confirm.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: NT.
Root-cause area: `apps/api/src/application/ai-guide.ts`. Routing: codex.

## Evidence

Narration line 111: 'The guide pushes a session + --pin flow for edits, but for greenfield creation sessions aren't required, which took a moment to confirm.'

## Recommendation

Guide fix: explicitly state that sessions/--pin are only needed for concurrent edits of existing use cases, and that the greenfield create → scenario → step path needs no session, so agents don't pause to confirm.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
