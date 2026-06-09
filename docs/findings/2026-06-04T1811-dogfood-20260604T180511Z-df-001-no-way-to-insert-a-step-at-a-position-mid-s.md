---
title: No way to insert a step at a position; mid-sequence rejection forces edit-then-append to fix ordering
created_at: 2026-06-04T18:11:57Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T180511Z
related:
  - docs/dogfood-loop.md
---

# No way to insert a step at a position; mid-sequence rejection forces edit-then-append to fix ordering

**TL;DR.** CLI fix: support inserting a step at an explicit position (e.g. `step add --at <n>` analogous to `scenario add --at`) so a rejected/late step can be placed without rewriting subsequent steps.

Surfaced by the dogfood loop (cycle `20260604T180511Z`). QUANTS: NT.
Root-cause area: `apps/cli step authoring (apps/cli/src/commands/step); docs/07-cli-spec.md.`. Routing: codex.

## Evidence

Narration line 99-101: after the validation `step add` was rejected, the save step had landed as step 2; the agent had to `step edit` step 2 into the validation step (cmd 16) and then `step add` a fresh save step as step 3 (cmd 17). `step add` only appends, so recovering correct ordering required an edit+re-append dance rather than an insert.

## Recommendation

CLI fix: support inserting a step at an explicit position (e.g. `step add --at <n>` analogous to `scenario add --at`) so a rejected/late step can be placed without rewriting subsequent steps.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
