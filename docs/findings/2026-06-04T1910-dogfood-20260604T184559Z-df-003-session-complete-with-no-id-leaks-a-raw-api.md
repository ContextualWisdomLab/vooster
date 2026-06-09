---
title: `session complete` with no id leaks a raw `ApiError: 404` instead of the agent envelope and does not resolve the active session
created_at: 2026-06-04T19:10:26Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# `session complete` with no id leaks a raw `ApiError: 404` instead of the agent envelope and does not resolve the active session

**TL;DR.** CLI/API fix: (1) when no session-id is supplied, resolve the current pinned/active session instead of calling the API with a missing id; (2) ensure every agent-format error path emits the documented envelope (stable `code` like SESSION_NOT_FOUND/MISSING_SESSION, human message, and `suggested_next_actions`) rather than a raw `ApiError: ... 404` with `Exit code 1`. A leaked thrown error under `--format=agent` breaks the self-teaching error contract (docs/06-api-contract.md).

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: QAS.
Root-cause area: `apps/cli/src/commands/session (complete) and apps/api/src/http — error path not wrapped in the agent envelope; missing active-session resolution`. Routing: codex.

## Evidence

Digest cmd 15 `vspec session complete --format=agent 2>&1` produced `Exit code 1` / `    ApiError: API request failed with 404.` (digest lines 683-684). Even with `--format=agent` the output was a bare thrown ApiError, not a JSON envelope with `code`/`message`/`suggested_next_actions`. The agent had a single active/pinned session (started at cmd 4, session_id abf6bcb8 visible in earlier envelopes at digest line 152) yet bare `session complete` did not resolve it and 404'd. It only succeeded at cmd 17 when the explicit id was passed: `vspec session complete abf6bcb8-... --format=agent` returned the proper envelope (digest lines 693-700).

## Recommendation

CLI/API fix: (1) when no session-id is supplied, resolve the current pinned/active session instead of calling the API with a missing id; (2) ensure every agent-format error path emits the documented envelope (stable `code` like SESSION_NOT_FOUND/MISSING_SESSION, human message, and `suggested_next_actions`) rather than a raw `ApiError: ... 404` with `Exit code 1`. A leaked thrown error under `--format=agent` breaks the self-teaching error contract (docs/06-api-contract.md).

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

`session complete` now resolves the active local `.vspec/session.json` session
when no id is supplied. Agent-format missing-session and API-error paths render
structured error envelopes instead of leaking raw `ApiError` strings.

Verified with:

- `pnpm exec vitest run apps/cli/tests/unit/session-agent-format.test.ts`
- `pnpm --filter @vooster/cli typecheck`
