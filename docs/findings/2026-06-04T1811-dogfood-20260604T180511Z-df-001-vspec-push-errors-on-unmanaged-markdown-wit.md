---
title: `vspec push` errors on unmanaged markdown with no filename, code, or next action
created_at: 2026-06-04T18:11:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T180511Z
related:
  - docs/dogfood-loop.md
---

# `vspec push` errors on unmanaged markdown with no filename, code, or next action

**TL;DR.** Sync/file-format fix: identify the offending file in the message, skip (don't hard-error on) markdown that is not vspec-managed, and emit a self-teaching error with a stable `code` and `suggested_next_actions` (e.g. add frontmatter / move file out of specs/) per the error contract.

Surfaced by the dogfood loop (cycle `20260604T180511Z`). QUANTS: ANS.
Root-cause area: `apps/cli push/sync (apps/cli/src) + CLI error contract; docs/08-file-format.md, docs/06-api-contract.md.`. Routing: codex.

## Evidence

Digest cmd 24 `vspec push` → "Error: Sync file is missing revision frontmatter." (digest line 387/85). The error names no file; the offending file is the pre-existing, unmanaged `specs/SEED_NOTES.md` (narration line 106/131). "Error codes seen in tool results: (none)" (digest line 75-76) — the message is a bare string with no stable `code` and no suggested_next_actions. The subsequent `sync` did process `specs/POCKET-001.md`, but the agent had to confirm server-side via `usecase list`/`show` that its spec synced despite the push error.

## Recommendation

Sync/file-format fix: identify the offending file in the message, skip (don't hard-error on) markdown that is not vspec-managed, and emit a self-teaching error with a stable `code` and `suggested_next_actions` (e.g. add frontmatter / move file out of specs/) per the error contract.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

Resolved in Goal 42. Verification:

- `pnpm exec vitest run apps/cli/tests/unit/sync-files-classification.test.ts apps/cli/tests/unit/push-agent-format.test.ts`
  passed on 2026-06-04T18:40Z.
- `bash goals/42-dogfood-vspec-push-errors-on-unmanaged-markdown-with-no-fi.gates.sh`
  passed on 2026-06-04T18:40Z.
