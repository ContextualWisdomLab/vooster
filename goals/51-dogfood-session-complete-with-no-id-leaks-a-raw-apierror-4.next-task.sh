#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "`session complete` with no id leaks a raw `ApiError: 404` instead of the agent envelope and does not resolve the active session".

1. Read docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-003-session-complete-with-no-id-leaks-a-raw-api.md.
2. Add a failing test that captures the finding's user-visible failure (bare `session complete` under --format=agent leaks a raw ApiError instead of the documented envelope and does not resolve the active session).
3. Implement the smallest fix in the stated root-cause area: resolve the pinned/active session when no id is given, and route every agent-format error path through the documented envelope (stable code, human message, suggested_next_actions).
4. Run the targeted test and relevant gate.
5. Update docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-003-session-complete-with-no-id-leaks-a-raw-api.md with verification evidence and set resolved: true.
TASK
