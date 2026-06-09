---
title: ai-guide self-contradicts on mandatory `session start --pin` vs greenfield `usecase create --force`
created_at: 2026-06-04T19:10:26Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# ai-guide self-contradicts on mandatory `session start --pin` vs greenfield `usecase create --force`

**TL;DR.** Guide fix: explicitly scope the 'mandatory session start --pin' rule to editing existing use cases, and state in the greenfield recipe that net-new creation via `usecase create --force` needs no session/pin. Remove the ambiguity so an agent does not have to guess which path applies.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: NS.
Root-cause area: `apps/api/src/application/ai-guide.ts`. Routing: codex.

## Evidence

Agent narration (line 110): "The guide's 'mandatory' session start --pin is framed for editing existing use cases; for greenfield creation it uses usecase create --force with no session, so the two sections slightly conflict — I went with the greenfield recipe since this was net-new." Guide consulted at command 2 `vspec ai-guide` (line 27).

## Recommendation

Guide fix: explicitly scope the 'mandatory session start --pin' rule to editing existing use cases, and state in the greenfield recipe that net-new creation via `usecase create --force` needs no session/pin. Remove the ambiguity so an agent does not have to guess which path applies.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
