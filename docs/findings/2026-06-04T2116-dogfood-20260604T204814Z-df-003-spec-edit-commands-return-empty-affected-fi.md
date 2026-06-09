---
title: Spec-edit commands return empty `affected_files`, not signaling that a separate `sync` is required for local consistency
created_at: 2026-06-04T21:16:57Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# Spec-edit commands return empty `affected_files`, not signaling that a separate `sync` is required for local consistency

**TL;DR.** After a server-side `step add` / `scenario add`, either populate affected_files or include a suggested_next_action telling the agent to run `vspec sync` to update local markdown; document in ai-guide that edits are server-first and local files are reconciled via sync. Keeps the local/server consistency contract self-teaching.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: NT.
Root-cause area: `apps/api/src/application/step-editing.ts / scenario-authoring.ts and apps/cli/src/commands/step.ts (response envelope: affected_files + suggested_next_actions after a server-side edit)`. Routing: codex.

## Evidence

Narration line 88: "Both edits are committed server-side, but affected_files was empty — the local markdown hasn't been rewritten yet. Let me verify the server state and reconcile local files with the server." The agent then probed help for sync/push/pull (turn 12) and ran `sync` (turn 15) to make the local `specs/POCKET-001.md` reflect the edits. The task explicitly required consistency "everywhere ... not just edited in one place," so the empty affected_files plus no explicit prompt to sync added inference cost.

## Recommendation

After a server-side `step add` / `scenario add`, either populate affected_files or include a suggested_next_action telling the agent to run `vspec sync` to update local markdown; document in ai-guide that edits are server-first and local files are reconciled via sync. Keeps the local/server consistency contract self-teaching.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
