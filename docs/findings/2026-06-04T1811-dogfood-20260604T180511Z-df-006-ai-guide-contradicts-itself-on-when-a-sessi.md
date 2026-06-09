---
title: ai-guide contradicts itself on when a session/pin is required
created_at: 2026-06-04T18:11:57Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T180511Z
related:
  - docs/dogfood-loop.md
---

# ai-guide contradicts itself on when a session/pin is required

**TL;DR.** Guide fix: reconcile the session/pin rule with the greenfield recipe — explicitly state when a session/pin is mandatory (e.g. concurrent multi-agent writes) versus optional (single-agent greenfield), so the agent isn't left guessing whether session_id: null payloads break the documented invariant.

Surfaced by the dogfood loop (cycle `20260604T180511Z`). QUANTS: NS.
Root-cause area: `apps/api/src/application/ai-guide.ts`. Routing: codex.

## Evidence

Narration line 106: "The guide's 'never write without a session/pin' rule conflicts a bit with its own greenfield recipe, which creates the use case and scenarios with no active session (`session_id: null` in the payloads)... the boundary of when a session is truly required was left ambiguous." The agent completed the flow but was left unsure whether it was violating a stated invariant.

## Recommendation

Guide fix: reconcile the session/pin rule with the greenfield recipe — explicitly state when a session/pin is mandatory (e.g. concurrent multi-agent writes) versus optional (single-agent greenfield), so the agent isn't left guessing whether session_id: null payloads break the documented invariant.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
