---
title: No discoverable command to regenerate a stale local spec file
created_at: 2026-06-04T21:16:57Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# No discoverable command to regenerate a stale local spec file

**TL;DR.** Add an explicit 'after authoring, run vspec pull to refresh local markdown' step to the ai-guide authoring walkthrough and the CLI spec, so the agent does not probe export/help to find the regeneration path.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: NT.
Root-cause area: `apps/api/src/application/ai-guide.ts (no pull/refresh step in the authoring walkthrough); docs/07-cli-spec.md`. Routing: codex.

## Evidence

Cmd 20 (digest line 41): `vspec export markdown POCKET-002 2>&1 | head -5; echo "=== EXIT $? ==="; vspec help export 2>&1 | head -40` — the agent guessed at `export markdown` and immediately checked `help export`, before discovering `vspec pull` (cmd 22) was the actual way to refresh the on-disk file. ai-guide never names the command for refreshing local files.

## Recommendation

Add an explicit 'after authoring, run vspec pull to refresh local markdown' step to the ai-guide authoring walkthrough and the CLI spec, so the agent does not probe export/help to find the regeneration path.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
