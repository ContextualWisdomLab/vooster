---
title: export markdown vs sync confusion: local file stays stale after API mutations with no guidance to run sync
created_at: 2026-06-04T19:10:26Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# export markdown vs sync confusion: local file stays stale after API mutations with no guidance to run sync

**TL;DR.** In ai-guide and the export/sync help, state explicitly that authoring commands mutate server state and leave local markdown stale until `vspec sync`, and that `export markdown` writes only to stdout. A suggested_next_actions hint pointing to `vspec sync` after a successful create/step add would close the loop without the agent guessing.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: NT.
Root-cause area: `docs/07-cli-spec.md, docs/08-file-format.md, apps/api/src/application/ai-guide.ts`. Routing: codex.

## Evidence

After creating POCKET-002 via the API, the agent found the local markdown stale and tried `vspec export markdown POCKET-002` (digest line 46), then narrated across three turns: "the local markdown file is stale" (line 101), "The local file is still stale (export only printed to stdout). Let me sync" (line 103), before finally running `vspec sync` (line 48). Extra turns 24-26 were spent discovering that export is stdout-only and sync is what refreshes working files.

## Recommendation

In ai-guide and the export/sync help, state explicitly that authoring commands mutate server state and leave local markdown stale until `vspec sync`, and that `export markdown` writes only to stdout. A suggested_next_actions hint pointing to `vspec sync` after a successful create/step add would close the loop without the agent guessing.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
