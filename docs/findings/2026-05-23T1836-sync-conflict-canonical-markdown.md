---
title: "Sync conflict path emits stripped markdown — silent data-loss risk"
created_at: 2026-05-23T18:36:00Z
priority: P0
resolved: true
resolved_by:
  - a98671e
  - 400ccc4
  - 8313db3
related:
  - docs/findings/2026-05-23T1750-dogfood-roundtrip.md
  - goals/31-sync-conflict-canonical-markdown.md
  - apps/api/src/application/sync-files.ts
  - apps/api/src/http/sync-result-support.ts
  - apps/api/src/application/markdown-renderer.ts
---

# Findings — sync conflict path still uses stripped `usecaseMarkdown`

## TL;DR

`pullSyncFiles` was migrated to emit canonical rich-body markdown via
`renderMarkdown` (commit `2d2681c`), but the **conflict** branch was
left behind. Both `apps/api/src/application/sync-files.ts:252` and
`apps/api/src/http/sync-result-support.ts:58` still embed
`usecaseMarkdown(usecase)` — a frontmatter+title stub — as the
"remote" half of `conflict_content`. Users resolving a `vspec push`
conflict therefore see a remote body that is _far thinner_ than what
they actually pulled minutes earlier, biasing them to "keep local" and
**silently overwriting real remote content**.

This is a data-integrity bug, not a cosmetic one: the round-trip
finding (B1) closed without closing the conflict half.

## Reproducer

1. `apps/api/src/application/sync-files.ts:251-258`:

```ts
function staleFileConflict(usecase: StoredUseCase, file: SyncFileInput): SyncResult {
  return {
    conflict_content: conflictContent(file.content, usecaseMarkdown(usecase), usecase),
    ...
  };
}
```

`usecaseMarkdown` is defined at `apps/api/src/application/sync-files.ts:291-293`:

```ts
function usecaseMarkdown(usecase: StoredUseCase) {
  return `---\nvspec_format: 1\ntype: usecase\n...\n---\n\n# ${usecase.title}\n`;
}
```

Returns frontmatter + a single `# Title` line. No scenarios, no steps,
no stakeholder interests.

2. `apps/api/src/http/sync-result-support.ts:53-64` (HTTP-layer helper)
   mirrors the bug — imports `usecaseMarkdown` from
   `./sync-markdown.js` and feeds it into the same conflict envelope.

3. Contrast with `pullSyncFiles`
   (`apps/api/src/application/sync-files.ts:77-83`) which already calls
   `renderMarkdown(deps, projectId, usecase)` — the canonical
   scenarios/steps/interests renderer.

## Why P0 — concrete corruption scenario

A user runs `vspec pull` and gets rich markdown for `UC-014` containing
preconditions, 6 main-success steps, 2 extensions, 3 stakeholder
interests. They edit one step locally. Meanwhile a teammate pushed an
unrelated change to the same use case. The user runs `vspec push`:

- Server returns `conflict_content` with **local** = full body the user
  edited, **remote** = `---\n...title only\n---\n\n# Title`.
- The diff in the user's editor shows the "remote" deleted everything.
- The natural resolve is "remote is stale / corrupted, keep local".
- After the resolve commit, the teammate's push is wiped — silently.

The user never sees that the "remote" they were shown was a server-side
rendering bug, not the actual remote.

## Proposed fix

Two valid paths. Recommendation: **(A)**.

### (A) Unify on `renderMarkdown` (recommended)

- Make `staleFileConflict` async and take the deps it needs
  (`actorStore`, `scenarioStore`, `stakeholderInterestStore`,
  `stakeholderStore`, `stepStore`, `useCaseStore`).
- Call `renderMarkdown(deps, projectId, usecase)` to build the remote
  half of `conflict_content`.
- Delete the local `usecaseMarkdown` helper at
  `apps/api/src/application/sync-files.ts:291` and the duplicate at
  `apps/api/src/application/sync-markdown.ts` (or the matching export)
  once no caller remains.
- Propagate the async signature up through `previewFile` / `pushFile`
  callers (already in an async context).

### (B) Inline the renderer at the HTTP layer

- Keep the application helper sync; let the route assemble the rich
  body just before sending. Worse because the conflict shape would
  diverge between application and HTTP layers.

## Acceptance signal

Closure is real when **all** of the following flip:

1. **Integration test** under `apps/api/tests/integration/` (or `e2e/`):
   create a use case with ≥1 scenario + ≥1 step + ≥1 stakeholder
   interest, push a stale base*revision, assert the returned
   `conflict_content` contains the rendered section headings (`## Main
Success Scenario`, `## Stakeholder Interests`) — \_not* just title.
2. **Negative grep**: `rg 'usecaseMarkdown\s*\(' apps/api/src | wc -l`
   returns **0** (or `1` if the symbol's definition is kept for a
   distinct reason documented in a comment).
3. `pnpm exec vitest run apps/api/tests` green after the change.
4. `bash scripts/completion-check.sh` exit 0.

## Goal promotion judgment

**Promote**. Single negative-universal invariant ("no `conflict_content`
producer emits stripped markdown") is gate-able as a one-line grep, and
the fix involves multi-step RED→GREEN (test → application → HTTP
support → cleanup). Suggested goal slot: next free goal number after 30.

## Migration plan

1. RED — write the integration test described in Acceptance signal #1.
   Confirm it fails against current `main`.
2. GREEN — make `staleFileConflict` async + `renderMarkdown`-backed in
   `sync-files.ts`. Propagate signature through `previewFile`,
   `pushFile`. Update tests for the changed signature.
3. GREEN — mirror the change in `sync-result-support.ts`. Verify the
   HTTP layer threads the needed deps.
4. REFACTOR — delete the now-orphan `usecaseMarkdown` helper(s). Add
   the negative-grep gate to the new goal's `.gates.sh`.
5. Verify chain: `bash scripts/completion-check.sh`.

## Resolution

Closed on 2026-05-24 by Goal 31.

- `a98671e` added `goals/31-sync-conflict-canonical-markdown.*` and the
  UC-029 stale sync conflict e2e assertion. The RED signal was
  `pnpm exec vitest run apps/api/tests/e2e/UC-029.test.ts`, failing
  because the remote half only contained frontmatter plus `# Title`.
- `400ccc4` changed `apps/api/src/application/sync-files.ts` so stale
  dry-run and push conflicts render the remote half with `renderMarkdown`.
  It also removed the duplicate HTTP `usecaseMarkdown` path.
- `8313db3` removed the stale e2e import that surfaced in the `_meta`
  eslint gate.

Acceptance signals:

- `pnpm exec vitest run apps/api/tests` passed: 174 files / 704 tests.
- `bash goals/31-sync-conflict-canonical-markdown.gates.sh` passed; its
  negative grep found no `usecaseMarkdown(` references under
  `apps/api/src`.
- `bash scripts/completion-check.sh` passed with active goal `ALL_DONE`.
