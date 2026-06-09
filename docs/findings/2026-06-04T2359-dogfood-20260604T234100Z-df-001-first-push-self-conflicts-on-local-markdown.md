---
title: First push self-conflicts on local markdown the agent never hand-edited
created_at: 2026-06-04T23:59:45Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T234100Z
related:
  - docs/dogfood-loop.md
---

# First push self-conflicts on local markdown the agent never hand-edited

**TL;DR.** Sync/file-format fix: CLI authoring commands (usecase/scenario/step writes) should update the local specs/<UC>.md cache to the resulting server revision, OR push should recognize that the local lineage descends from the same authoring session and fast-forward instead of conflicting. A pure-CLI authoring flow must not self-conflict on first push.

Surfaced by the dogfood loop (cycle `20260604T234100Z`). QUANTS: ATSN.
Root-cause area: `apps/cli/src (push/sync reconciliation + local markdown cache not regenerated after CLI write commands)`. Routing: codex.

## Evidence

Narration lines 108-110: "Push reports a conflict on the local markdown file ... The server already holds my latest revision (113902c9); the local markdown cache is stale. Let me pull to reconcile." The agent authored POCKET-001 entirely through CLI write commands (usecase create / scenario add / step add — commands 10,12,14-20) which mutate server state, made zero direct spec edits (digest §'Direct edits to synced spec state' = none), yet command 24 `vspec push` still flagged a conflict, requiring command 29 `vspec pull --format=agent` then command 30 `vspec push` to reconcile.

## Recommendation

Sync/file-format fix: CLI authoring commands (usecase/scenario/step writes) should update the local specs/<UC>.md cache to the resulting server revision, OR push should recognize that the local lineage descends from the same authoring session and fast-forward instead of conflicting. A pure-CLI authoring flow must not self-conflict on first push.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
