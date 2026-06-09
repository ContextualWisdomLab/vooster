---
title: `usecase set` help text is vague, forcing empirical flag probing
created_at: 2026-06-04T21:16:57Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# `usecase set` help text is vague, forcing empirical flag probing

**TL;DR.** Enrich `usecase set --help` to list supported `--field` values, the value enums per field, and the positional `<key>` selector up front, so the agent does not have to provoke errors to learn the contract.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: NT.
Root-cause area: `apps/cli/src/commands/usecase.ts, docs/07-cli-spec.md`. Routing: codex.

## Evidence

Narration line 194: 'The usecase set help is vague. Let me probe its actual flags.' Agent then ran bare `usecase set` and got `Error: Missing --field.` plus a values list only on failure (digest lines 333, 338: 'Supported --field values: title, level, priority, format, status'). It also tried non-existent `--key`/`--usecase` selector flags (lines 58-60) before finding the positional form.

## Recommendation

Enrich `usecase set --help` to list supported `--field` values, the value enums per field, and the positional `<key>` selector up front, so the agent does not have to provoke errors to learn the contract.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
