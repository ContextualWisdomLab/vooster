---
title: `session complete` without id fails with misleading NOT_FOUND "Session not found" instead of resolving the active session
created_at: 2026-06-04T21:16:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# `session complete` without id fails with misleading NOT_FOUND "Session not found" instead of resolving the active session

**TL;DR.** Resolve the active pinned session from the local session store when `session complete` is called with no id; if none can be resolved, return a self-teaching error (e.g. code MISSING_SESSION_ID with a suggested_next_action showing `session complete <id>` and listing active sessions) rather than NOT_FOUND "Session not found".

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: ANS.
Root-cause area: `apps/cli/src/commands/session.ts (no current/active-session resolution when id omitted) and the API problem response for session lookup (apps/api/src/http/*)`. Routing: codex.

## Evidence

Error sample (digest lines 75-76): `"code": "NOT_FOUND", "message": "Session not found"`. Command order: turn 17 `vspec session complete --format=agent` failed; turn 18 `vspec session complete e22238d3-f841-453f-a8ae-0591fc5efb35 --format=agent` succeeded. Narration line 94: "session complete needs the session id explicitly." A session was started and pinned in turn 5 (active, single session), so "Session not found" misdescribes the real condition (no id supplied / active session not auto-resolved).

## Recommendation

Resolve the active pinned session from the local session store when `session complete` is called with no id; if none can be resolved, return a self-teaching error (e.g. code MISSING_SESSION_ID with a suggested_next_action showing `session complete <id>` and listing active sessions) rather than NOT_FOUND "Session not found".

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution Evidence

- Added coverage in `apps/cli/tests/unit/session-agent-format.test.ts` for
  `session complete --format=agent` without a positional id and without a
  local active session file.
- Verified the CLI resolves `.vspec/session.json` for bare
  `session complete --format=agent` and returns `MISSING_SESSION_ID` with
  `vspec session complete <id>` plus `vspec session list` suggestions when no
  active session can be resolved.
- Verification: `pnpm exec vitest run apps/cli/tests/unit/session-agent-format.test.ts`.
