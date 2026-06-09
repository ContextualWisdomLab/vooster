---
title: Local working copy goes stale after server-side mutations; manual pull required
created_at: 2026-06-04T23:03:54Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T224051Z
related:
  - docs/dogfood-loop.md
---

# Local working copy goes stale after server-side mutations; manual pull required

**TL;DR.** Make all mutating CLI subcommands either rewrite the affected specs/<KEY>.md from the post-mutation server state or, at minimum, emit a suggested_next_action 'vspec pull' / a 'working copy now stale' warning. Inconsistent behavior (create writes locally, adds do not) silently risks committing a stale spec; align the file-format/sync contract in docs/08-file-format.md so the working copy is always reconciled after a write.

Surfaced by the dogfood loop (cycle `20260604T224051Z`). QUANTS: QAS.
Root-cause area: `apps/cli/src/commands/scenario.ts, step.ts, stakeholder.ts (and sync-files.ts) — mutating subcommands do not refresh the local specs/<KEY>.md the way `usecase create` writes one`. Routing: codex.

## Evidence

Narration line 88: 'The local `POCKET-002.md` file is stale — it only reflects the initial creation snapshot, while the server has the full content. I need to pull to sync the working copy.' `vspec usecase create` wrote a snapshot to specs/POCKET-002.md (line 31), but the subsequent add-stakeholder / scenario add / step add / extension calls (lines 33-41) never updated the local file, so the agent had to run `vspec pull` (line 44) before the working copy matched the server.

## Recommendation

Make all mutating CLI subcommands either rewrite the affected specs/<KEY>.md from the post-mutation server state or, at minimum, emit a suggested_next_action 'vspec pull' / a 'working copy now stale' warning. Inconsistent behavior (create writes locally, adds do not) silently risks committing a stale spec; align the file-format/sync contract in docs/08-file-format.md so the working copy is always reconciled after a write.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

The shared mutation runner already reconciles local specs by materializing
`affected_files` when project context is available, or by returning a
deterministic `vspec pull` stale-warning when auto-export cannot run. The
`working-copy-reconcile` regression suite now locks that contract for
`usecase add-stakeholder`, `scenario add`, and `step add`.
