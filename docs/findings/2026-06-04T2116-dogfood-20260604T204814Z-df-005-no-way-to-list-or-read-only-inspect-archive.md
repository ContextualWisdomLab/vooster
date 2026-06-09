---
title: No way to list or read-only inspect archived use cases; agent guessed nonexistent flags and mutated state to investigate
created_at: 2026-06-04T21:16:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# No way to list or read-only inspect archived use cases; agent guessed nonexistent flags and mutated state to investigate

**TL;DR.** Add an archived/all filter to `usecase list` and allow `usecase show <KEY>` to render archived use cases read-only, so inspecting an archived spec never requires a `restore` round-trip. Also fix the confusing dual `Nonexistent flag` + `Command usecase not found` error on unknown flags.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: ANT.
Root-cause area: `apps/cli/src/commands (usecase list lacks an archived filter; usecase show cannot read archived) + apps/api/src/http`. Routing: codex.

## Evidence

To find/inspect the archived POCKET-006 the agent guessed `vspec usecase list --all` and `--archived`, both rejected: lines 84-89 `Error: Nonexistent flag: --all` / `--archived` plus a misleading `Error: Command usecase not found.` (lines 86/89). With no read path, it ran `vspec usecase restore POCKET-006` (command 19/22) — mutating synced state — purely to read it, then re-archived (narration line 144: "I briefly restored it during investigation to read it, then re-archived it").

## Recommendation

Add an archived/all filter to `usecase list` and allow `usecase show <KEY>` to render archived use cases read-only, so inspecting an archived spec never requires a `restore` round-trip. Also fix the confusing dual `Nonexistent flag` + `Command usecase not found` error on unknown flags.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution evidence

- `vspec usecase list --archived` lists only archived entries, `--all` includes
  active and archived entries, and human output marks archived rows.
- `vspec usecase show <KEY>` renders archived specs read-only with `Archived at`.
- Unknown usecase flags now print one `Error: Nonexistent flag: <flag>` line
  without `Command usecase not found`.
- `pnpm exec vitest run apps/api/tests/e2e/UC-014.test.ts apps/api/tests/e2e/UC-034.test.ts apps/cli/tests/e2e-cli/UC-015.test.ts`
  passes.
- `pnpm exec tsc -p tsconfig.json --noEmit` and
  `pnpm exec eslint . --max-warnings 0` pass.
