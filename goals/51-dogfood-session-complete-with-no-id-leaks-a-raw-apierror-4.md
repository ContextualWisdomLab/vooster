# Goal 51: Dogfood Finding Follow-Up

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

Resolve the dogfood finding **`session complete` with no id leaks a raw `ApiError: 404` instead of the agent envelope and does not resolve the active session**.

Source finding: `docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-003-session-complete-with-no-id-leaks-a-raw-api.md`

Root-cause area: `apps/cli/src/commands/session (complete) and apps/api/src/http — error path not wrapped in the agent envelope; missing active-session resolution`

## Completion

A. The source finding is marked `resolved: true` after the implementation
addresses the recommendation below.

B. The implementation has been verified with the smallest relevant test or
dogfood rerun, and the finding document records that evidence.

## Recommendation

CLI/API fix: (1) when no session-id is supplied to `session complete`, resolve the current pinned/active session instead of calling the API with a missing id; (2) ensure every agent-format error path emits the documented envelope (stable `code` like `SESSION_NOT_FOUND`/`MISSING_SESSION`, a human `message`, and `suggested_next_actions`) rather than a raw `ApiError: ... 404` with `Exit code 1`. A leaked thrown error under `--format=agent` breaks the self-teaching error contract (`docs/06-api-contract.md`).
