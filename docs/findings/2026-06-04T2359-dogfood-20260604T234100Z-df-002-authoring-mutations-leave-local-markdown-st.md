---
title: Authoring mutations leave local markdown stale until a manual `vspec sync`
created_at: 2026-06-04T23:59:45Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T234100Z
related:
  - docs/dogfood-loop.md
---

# Authoring mutations leave local markdown stale until a manual `vspec sync`

**TL;DR.** Either auto-sync the affected local spec file after authoring mutations (or print a `suggested_next_actions` sync hint on each mutation), and make ai-guide/help state explicitly that local markdown is stale until `vspec sync`. The agent recovered only because it independently noticed staleness; a less careful agent would leave the working tree out of sync with the server.

Surfaced by the dogfood loop (cycle `20260604T234100Z`). QUANTS: ATS.
Root-cause area: `apps/cli/src/commands (usecase/scenario/step mutations + sync.ts), docs/08-file-format.md`. Routing: codex.

## Evidence

Narration line 88: "The server state is correct (verify passes), but the local markdown file is stale. Let me sync." followed by `vspec sync` at command 29 (digest line 46). The full authoring sequence (usecase create, add-stakeholder, scenario add x3, step add x7) wrote only server state; the local `specs/POCKET-002.md` was not materialized until the explicit final sync.

## Recommendation

Either auto-sync the affected local spec file after authoring mutations (or print a `suggested_next_actions` sync hint on each mutation), and make ai-guide/help state explicitly that local markdown is stale until `vspec sync`. The agent recovered only because it independently noticed staleness; a less careful agent would leave the working tree out of sync with the server.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
