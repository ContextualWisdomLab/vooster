---
title: vspec sync leaves local spec file pinned at create revision after mutations
created_at: 2026-06-04T21:16:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# vspec sync leaves local spec file pinned at create revision after mutations

**TL;DR.** Sync/file-format fix: `vspec sync` must reconcile the local file to the latest server revision, not just the revision recorded at create time. Either populate `affected_files` on scenario/step mutations so the file is rewritten incrementally, or have `sync` re-pull and re-render the current revision. There should be no need for `export > file` to keep the repo current.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: QAST.
Root-cause area: `apps/cli/src/commands/sync.ts, apps/cli/src/commands/sync-files.ts (and the API mutation responses' affected_files in apps/api/src/http/*)`. Routing: codex.

## Evidence

Narration lines 93-95, 110: 'Step/scenario mutations returned empty affected_files and didn't rewrite specs/TODO-001.md; vspec sync stayed pinned to the create revision, so the on-disk file lagged the server.' Command 21 (`vspec sync ... | tail -8`) did not bring the file current; the server (`usecase show`, cmd 19) was always correct. Agent had to fall back to `vspec export markdown TODO-001 > specs/TODO-001.md` (cmd 23) to make the repo reflect reality.

## Recommendation

Sync/file-format fix: `vspec sync` must reconcile the local file to the latest server revision, not just the revision recorded at create time. Either populate `affected_files` on scenario/step mutations so the file is rewritten incrementally, or have `sync` re-pull and re-render the current revision. There should be no need for `export > file` to keep the repo current.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

Scenario and step mutation revisions now advance the stored use case head, so
`vspec pull`/`vspec sync` re-render the current server revision instead of the
create-time revision. Regression coverage verifies sync pull after scenario
create, step add, and step edit, with unit coverage for step move as another
rendered-output-changing mutation.
