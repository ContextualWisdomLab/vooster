# Goal 58: Dogfood Finding Follow-Up

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

Resolve the dogfood finding **`session complete` without id fails with misleading NOT_FOUND "Session not found" instead of resolving the active session**.

Source finding: `docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-003-session-complete-without-id-fails-with-misl.md`

Root-cause area: `apps/cli/src/commands/session.ts (no current/active-session resolution when id omitted) and the API problem response for session lookup (apps/api/src/http/*)`.

## Completion

A. The source finding is marked `resolved: true` after the implementation
addresses the recommendation below.

B. The implementation has been verified with the smallest relevant test or
dogfood rerun, and the finding document records that evidence.

## Recommendation

CLI/API fix: (1) when no session-id is supplied to `session complete`, resolve
the active pinned session from the local session store instead of calling the
API with a missing id; (2) if no active session can be resolved, return a
self-teaching error — a stable code such as `MISSING_SESSION_ID`, a human
`message`, and a `suggested_next_action` showing `session complete <id>` plus
the list of active sessions — rather than the misleading `NOT_FOUND` /
"Session not found". A session was started and pinned earlier in the run, so
"Session not found" misdescribes the real condition (no id supplied / active
session not auto-resolved) and breaks the self-teaching error contract
(`docs/06-api-contract.md`).
