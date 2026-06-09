# Goal 59: Dogfood Finding Follow-Up

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

Resolve the dogfood finding **Use-case `level` is effectively immutable: `usecase set` 404s and `change propose` silently drops it**.

Source finding: `docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-004-use-case-level-is-effectively-immutable-use.md`

Root-cause area: `apps/api/src/http (usecase set / change-propose routes), apps/api/src/application/usecases.ts, packages/contracts/src/scenario.ts`

## Completion

A. The source finding is marked `resolved: true` after the implementation
addresses the recommendation below.

B. The implementation has been verified with the smallest relevant test or
dogfood rerun, and the finding document records that evidence.

## Recommendation

Make `level` a first-class mutable field. Either expose a working
`usecase set --field level --value <SUMMARY|USER_GOAL|SUBFUNCTION>` route, or
have `change propose` accept `level` in its patch `fields` and diff/persist it
the same way `title` is handled today. A provided, documented field must never
be silently dropped: the produced `.data.diff` must include `level` when the
caller changes it, and the persisted use case must reflect the new level.

Silently ignoring a supplied field is a correctness bug. At minimum, an
unknown or unsupported field must be rejected with a self-teaching error
(stable machine `code`, human `message`, and `suggested_next_actions`) rather
than a raw 404 or a silent no-op. Cockburn levels (`SUMMARY` / `USER_GOAL` /
`SUBFUNCTION`) are core to spec fidelity, so this is a core-workflow
capability gap. Per rubric principle 2, errors must be self-teaching
(`docs/06-api-contract.md`).
