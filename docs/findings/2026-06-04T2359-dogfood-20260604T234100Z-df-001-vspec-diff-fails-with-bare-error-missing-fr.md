---
title: `vspec diff` fails with bare "Error: Missing from-revision." — no envelope, code, or next action
created_at: 2026-06-04T23:59:45Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T234100Z
related:
  - docs/dogfood-loop.md
---

# `vspec diff` fails with bare "Error: Missing from-revision." — no envelope, code, or next action

**TL;DR.** Error/CLI fix: route `vspec diff`'s missing-revision case through the documented envelope with a stable code and a suggested_next_action telling the agent how to pass --from-revision (or default it to the last synced revision so plain `vspec diff` just works).

Surfaced by the dogfood loop (cycle `20260604T234100Z`). QUANTS: NSA.
Root-cause area: `apps/cli/src (diff command) / apps/api/src/http (Problem Details envelope)`. Routing: codex.

## Evidence

Error/failure sample line 90: "Error: Missing from-revision." emitted by command 27 `vspec diff` (run during conflict recovery to inspect the stale local file). The message is a bare string with no stable `code`, no `details`, and no `suggested_next_actions` explaining how to supply the revision — contrary to the self-teaching error contract (digest shows 10 suggested_next_actions elsewhere, so the envelope exists but diff bypasses it).

## Recommendation

Error/CLI fix: route `vspec diff`'s missing-revision case through the documented envelope with a stable code and a suggested_next_action telling the agent how to pass --from-revision (or default it to the last synced revision so plain `vspec diff` just works).

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
