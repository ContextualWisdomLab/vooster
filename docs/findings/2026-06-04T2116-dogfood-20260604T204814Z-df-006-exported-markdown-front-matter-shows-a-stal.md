---
title: Exported markdown front-matter shows a stale revision id
created_at: 2026-06-04T21:16:57Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# Exported markdown front-matter shows a stale revision id

**TL;DR.** File-format fix: export must stamp the front-matter `revision` with the revision actually rendered, so the local file's metadata matches its body and downstream sync/doctor can trust it.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: QS.
Root-cause area: `apps/api/src/http/scenario-support.ts / export rendering, packages/contracts/src/scenario.ts`. Routing: codex.

## Evidence

Narration line 110: '... I worked around it with vspec export markdown TODO-001 > specs/TODO-001.md — but ... the exported front-matter still shows the old revision id.' The rendered body was current but the `revision` field in front-matter lagged.

## Recommendation

File-format fix: export must stamp the front-matter `revision` with the revision actually rendered, so the local file's metadata matches its body and downstream sync/doctor can trust it.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
