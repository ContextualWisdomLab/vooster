---
title: Local spec markdown goes stale after CLI authoring; requires manual sync+pull to reconcile
created_at: 2026-06-04T21:16:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# Local spec markdown goes stale after CLI authoring; requires manual sync+pull to reconcile

**TL;DR.** Make CLI authoring mutations (scenario add / step add / add-stakeholder) actually materialize their reported `affected_files` to local markdown, or have the agent-format payload surface a clear 'run vspec pull to refresh local files' next-action. Either close the sync gap so the on-disk spec is never stale after a successful mutation, or document the pull-after-authoring step in ai-guide so the agent isn't left with a silently inconsistent local file.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: QAS.
Root-cause area: `apps/cli/src (scenario add / step add local-write + sync/pull path); apps/api/src/application/ai-guide.ts:204 (affected_files semantics); docs/08-file-format.md`. Routing: codex.

## Evidence

Cmd 18 (digest line 39): `vspec usecase verify POCKET-002 ...; cat specs/POCKET-002.md` revealed the on-disk file did not reflect the scenario/steps just added via `scenario add`/`step add`. Narration (lines 88-89): 'The local markdown file is stale. Let me fetch the current server state.' / 'Server state is complete and correct. The local POCKET-002.md file is stale — let me regenerate it so the on-disk spec matches.' The agent then ran cmd 21 `vspec sync` (line 42) and cmd 22 `vspec pull` (line 43) to materialize the file. The ai-guide (apps/api/src/application/ai-guide.ts:204) calls `affected_files` 'the local write set' but the write commands left the file unwritten/stale, and no guide step tells the agent to pull after authoring.

## Recommendation

Make CLI authoring mutations (scenario add / step add / add-stakeholder) actually materialize their reported `affected_files` to local markdown, or have the agent-format payload surface a clear 'run vspec pull to refresh local files' next-action. Either close the sync gap so the on-disk spec is never stale after a successful mutation, or document the pull-after-authoring step in ai-guide so the agent isn't left with a silently inconsistent local file.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

Successful spec mutations now go through the shared mutation runner’s
materialize-or-refresh behavior. When project context is available, auto-export
continues to write local markdown and report the `affected_files` write set.
When project context is unavailable and auto-export is skipped, successful spec
mutations include a deterministic `vspec pull` suggested next action warning that
local spec files may be stale.

Verified:

- `pnpm exec vitest run apps/cli/tests/unit/mutation-stale-local-files.test.ts`
- `pnpm --filter @vooster/cli typecheck`
- `bash goals/56-dogfood-local-spec-markdown-goes-stale-after-cli-authoring.gates.sh`
