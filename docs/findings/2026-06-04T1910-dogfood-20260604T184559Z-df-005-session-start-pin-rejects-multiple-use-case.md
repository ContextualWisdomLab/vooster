---
title: session start --pin rejects multiple use cases in one call
created_at: 2026-06-04T19:10:26Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# session start --pin rejects multiple use cases in one call

**TL;DR.** Either make --pin a repeatable flag (oclif `multiple: true`) so an agent can pin several use cases in one session, or accept a comma-separated list; if the single-pin constraint is intentional, the error must teach the supported alternative in its message / suggested_next_actions rather than just rejecting.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: ANT.
Root-cause area: `apps/cli/src/commands (session start flag definition)`. Routing: codex.

## Evidence

Command 8 (digest line 34): `vspec session start --intent "Run doctor quality checks" --pin POCKET-001 --pin POCKET-002 --pin POCKET-003 --pin POCKET-004 --pin POCKET-005 --format=agent` failed with `Exit code 2` (line 836) and `Error: Flag --pin can only be specified once` (line 846). The agent had to retry (command 9, line 35) pinning only POCKET-001, then fell back to running `vspec doctor --usecase` per case instead.

## Recommendation

Either make --pin a repeatable flag (oclif `multiple: true`) so an agent can pin several use cases in one session, or accept a comma-separated list; if the single-pin constraint is intentional, the error must teach the supported alternative in its message / suggested_next_actions rather than just rejecting.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
