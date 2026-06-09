---
title: usecase verify reads as a no-op stub
created_at: 2026-06-04T19:10:26Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# usecase verify reads as a no-op stub

**TL;DR.** Either implement `usecase verify` to return real per-use-case diagnostics (or alias it transparently to `doctor --usecase`), or, if it is intentionally minimal, make its output state clearly what it checks and point to `doctor --usecase` so agents don't treat it as a dead end.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: NST.
Root-cause area: `apps/cli/src/commands/usecase verify / apps/api verify application`. Routing: codex.

## Evidence

Command 4 (digest line 30) `vspec usecase verify --format=agent` and command 7 (line 33) `vspec usecase verify POCKET-001 --format=agent` / no-format both ran, and the agent narrated "`verify` seems to be a stub" (line 135), then abandoned it in favor of `doctor --usecase`. The command surface exists but produced no actionable diagnostic, wasting probing turns.

## Recommendation

Either implement `usecase verify` to return real per-use-case diagnostics (or alias it transparently to `doctor --usecase`), or, if it is intentionally minimal, make its output state clearly what it checks and point to `doctor --usecase` so agents don't treat it as a dead end.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
