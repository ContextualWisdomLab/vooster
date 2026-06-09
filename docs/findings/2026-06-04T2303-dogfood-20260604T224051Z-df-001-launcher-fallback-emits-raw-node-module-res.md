---
title: Launcher fallback emits raw Node module-resolution error with no recovery guidance
created_at: 2026-06-04T23:03:54Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T224051Z
related:
  - docs/dogfood-loop.md
---

# Launcher fallback emits raw Node module-resolution error with no recovery guidance

**TL;DR.** When the built dist or source fallback cannot resolve deps, fail with a stable, self-teaching message (e.g. a clear code + 'vspec install is incomplete; reinstall with <cmd>' suggested_next_action) rather than leaking Node's MODULE_NOT_FOUND trace or the internal 'Use source CLI' string.

Surfaced by the dogfood loop (cycle `20260604T224051Z`). QUANTS: NS.
Root-cause area: `apps/cli (bin launcher fallback path)`. Routing: codex.

## Evidence

Lines 80-88: the launcher leaks a raw stack trace (`Cannot find module 'tsx'`, `code: MODULE_NOT_FOUND`) and an opaque internal sentinel `new Error("Use source CLI")` / `ERR_MODULE_NOT_FOUND` instead of a self-teaching message. The agent had to reverse-engineer that the launcher "falls back to tsx (source mode) because no built dist exists" (narration line 99) from the stack trace alone.

## Recommendation

When the built dist or source fallback cannot resolve deps, fail with a stable, self-teaching message (e.g. a clear code + 'vspec install is incomplete; reinstall with <cmd>' suggested_next_action) rather than leaking Node's MODULE_NOT_FOUND trace or the internal 'Use source CLI' string.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
