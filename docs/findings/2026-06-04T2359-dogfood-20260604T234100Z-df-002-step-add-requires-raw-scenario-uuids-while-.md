---
title: `step add` requires raw scenario UUIDs while scenarios are created with friendly position labels
created_at: 2026-06-04T23:59:45Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T234100Z
related:
  - docs/dogfood-loop.md
---

# `step add` requires raw scenario UUIDs while scenarios are created with friendly position labels

**TL;DR.** Accept use-case-relative scenario references for `step add` (e.g. `POCKET-002/main`, `POCKET-002/2a`) in addition to UUIDs, mirroring the friendly `--at` labels used at scenario creation. Reduces intellectual load and shell-variable threading for agents authoring multi-step scenarios.

Surfaced by the dogfood loop (cycle `20260604T234100Z`). QUANTS: NT.
Root-cause area: `apps/cli/src/commands/step.ts, packages/contracts/src, docs/07-cli-spec.md`. Routing: codex.

## Evidence

Scenario adds use friendly refs (`scenario add POCKET-002 --type EXTENSION --at 2a`, commands 19/21, lines 40-41) but `step add` needs the scenario UUID captured into shell vars `$SC`/`$EXT2A`/`$EXT3A` (commands 14-27, lines 36-44). Narration line 84: "Main scenario id is `e64597d0-0f94-4472-8bcd-1f72106bfc39`." The agent had to capture and thread UUIDs to address scenarios for step authoring.

## Recommendation

Accept use-case-relative scenario references for `step add` (e.g. `POCKET-002/main`, `POCKET-002/2a`) in addition to UUIDs, mirroring the friendly `--at` labels used at scenario creation. Reduces intellectual load and shell-variable threading for agents authoring multi-step scenarios.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
