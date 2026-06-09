# Goal 53: Dogfood Finding Follow-Up

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

Resolve the dogfood finding **`usecase add-stakeholder` duplicate returns a raw `ApiError: API request failed with 409.` with no structured code under `--format=agent`**.

Source finding: `docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-004-usecase-add-stakeholder-duplicate-returns-r.md`

Root-cause area: `apps/cli/src (HTTP error handling / envelope.ts) and apps/api/src/http (Problem Details for 409 conflict)`

## Completion

A. The source finding is marked `resolved: true` after the implementation
addresses the recommendation below.

B. The implementation has been verified with the smallest relevant test or
dogfood rerun, and the finding document records that evidence.

## Recommendation

CLI/API fix: map the 409 conflict from `usecase add-stakeholder` to the agent
envelope with a stable machine `code` (e.g. `STAKEHOLDER_ALREADY_ATTACHED`), a
human `message`, and `suggested_next_actions` ("already present — no action
needed" or "use … to update"). Under `--format=agent` no raw
`ApiError: API request failed with N` string should ever reach the agent — the
agent-format error path for this command must emit the documented envelope
instead of a leaked thrown error. Per rubric principle 2, errors must be
self-teaching (`docs/06-api-contract.md`).
