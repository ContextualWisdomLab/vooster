---
title: `session complete --format=agent` returns an empty (data: null) envelope, forcing a re-run to confirm completion
created_at: 2026-06-04T23:03:54Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T224051Z
related:
  - docs/dogfood-loop.md
---

# `session complete --format=agent` returns an empty (data: null) envelope, forcing a re-run to confirm completion

**TL;DR.** Make `session complete --format=agent` return a populated `data` payload mirroring the human output (e.g. session_id, status: COMPLETED, ended_at, released_locks). A mutation/lifecycle command should not emit `data: null` in the structured envelope when the human format reports rich state; agent and human formats must agree on shape and information content.

Surfaced by the dogfood loop (cycle `20260604T224051Z`). QUANTS: ST.
Root-cause area: `apps/api/src/http (session-complete handler / response shape) and apps/cli/src (session complete agent envelope) — cf. docs/06-api-contract.md, docs/07-cli-spec.md`. Routing: codex.

## Evidence

Digest line 43: `vspec session complete --format=agent ... | python3 -c "... print(json.dumps(d.get('data',d), indent=2))"`. The extractor printed literally `null` (visible in the final tool results), meaning the agent envelope carried `data: null`. The agent then re-ran in human format (line 44: `vspec session complete 41b724a7-...`), which DID surface useful state: `Status COMPLETED / Ended at ... / Released locks none / Session file .vspec/session.json cleared`. So the structured (agent) format is strictly less informative than the human format for this command, and the agent only got a trustworthy confirmation by re-invoking.

## Recommendation

Make `session complete --format=agent` return a populated `data` payload mirroring the human output (e.g. session_id, status: COMPLETED, ended_at, released_locks). A mutation/lifecycle command should not emit `data: null` in the structured envelope when the human format reports rich state; agent and human formats must agree on shape and information content.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
