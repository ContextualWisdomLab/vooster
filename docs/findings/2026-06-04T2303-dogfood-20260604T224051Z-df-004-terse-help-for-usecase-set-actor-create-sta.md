---
title: Terse help for usecase set / actor create / stakeholder create forces flag-probing via error triggering
created_at: 2026-06-04T23:03:54Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T224051Z
related:
  - docs/dogfood-loop.md
---

# Terse help for usecase set / actor create / stakeholder create forces flag-probing via error triggering

**TL;DR.** Enrich help output and the agent guide so required flags, allowed enum values (actor/stakeholder --type, usecase set --field names) are listed up front. This avoids the probe-by-error loop and lowers intellectual load for a fresh agent.

Surfaced by the dogfood loop (cycle `20260604T224051Z`). QUANTS: NT.
Root-cause area: `apps/cli/src (command help text for usecase set / actor create / stakeholder create) and docs/07-cli-spec.md`. Routing: codex.

## Evidence

Narration lines 128-129: 'The `usecase set` and `actor create` help is terse. Let me probe their real flags.' Commands 8-9 ran the commands with missing/partial flags to discover the contract, surfacing `Error: Missing --field.`, `Error: Missing --name.`, `› Error: Flag --field expects a value`, `Error: Missing usecase-id.`, `Error: Missing --type.` (digest lines 328-339). Four help/probe rounds (commands 6-9) preceded the first real authoring command.

## Recommendation

Enrich help output and the agent guide so required flags, allowed enum values (actor/stakeholder --type, usecase set --field names) are listed up front. This avoids the probe-by-error loop and lowers intellectual load for a fresh agent.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
