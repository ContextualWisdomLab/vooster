#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "`session complete` without id fails with misleading NOT_FOUND \"Session not found\" instead of resolving the active session".

1. Read docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-003-session-complete-without-id-fails-with-misl.md.
2. Add a failing test that captures the finding's user-visible failure: bare `session complete --format=agent` with a single active pinned session does NOT auto-resolve it, and when no id is supplied it surfaces a misleading NOT_FOUND "Session not found" instead of a self-teaching MISSING_SESSION_ID envelope.
3. Implement the smallest fix in the stated root-cause area:
   - apps/cli/src/commands/session.ts — when no session-id is given, resolve the active pinned session from the local session store before calling the API;
   - if none can be resolved, return a self-teaching error (stable code e.g. MISSING_SESSION_ID, human message, suggested_next_action `session complete <id>` listing active sessions) instead of NOT_FOUND / "Session not found".
4. Run the targeted test and `bash goals/58-dogfood-session-complete-without-id-fails-with-misleading-.gates.sh`.
5. Update the finding doc with verification evidence (the test name / dogfood rerun) and set resolved: true.
TASK
