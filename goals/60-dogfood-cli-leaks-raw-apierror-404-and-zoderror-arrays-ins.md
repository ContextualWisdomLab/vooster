---
case_id: DF-004
severity: P0
resolved: true
---

# Goal 60: Dogfood Finding Follow-Up

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

Resolve the dogfood finding **CLI leaks raw `ApiError: 404` and `ZodError`
arrays instead of the documented envelope**.

The finding is recorded inline in this file (see _Source finding_ below); the
`resolved:` flag in the frontmatter above is the structural anchor that
`60-...gates.sh` reads. Flip it to `true` only after the fix lands with test
evidence.

Root-cause area: `apps/cli/src` (envelope mapping / error boundary),
`apps/api/src/http/scenario-support.ts`, `apps/api/src/http/step-routes.ts`.

## Source finding

`usecase set --field level --value BOGUS` and an invalid `--field` produced a
raw `ZodError: [ { code: invalid_value, ... } ]` dump. `change propose` with an
incomplete patch dumped raw `ZodError` arrays exposing internal paths/messages
("Invalid input: expected object, received undefined"). `usecase set` failures
surfaced as a bare `ApiError: API request failed with 404.` These bypass the
Problem Details / agent envelope (no stable `code`, no
`suggested_next_actions`). Contrast: `actor create --type BOGUS` returned a
clean teaching message — "Actor type must be PRIMARY, SUPPORTING, or
OFFSTAGE." — proving the inconsistency.

## Completion

A. The source finding is resolved: the `resolved:` frontmatter flag in this
file is set to `true` after the implementation addresses the recommendation
below.

B. The implementation is verified with the smallest relevant test or dogfood
rerun, and this file records that evidence in a _Verification_ section.

## Recommendation

Catch zod validation failures and HTTP 404s at the CLI/API boundary and map
them to the documented agent envelope: a stable machine `code`, a human
`message`, and `suggested_next_actions`. Under `--format=agent` no raw
`ZodError` array and no bare `ApiError: API request failed with N` string
should ever reach the agent — leaked internal paths/messages are a contract
break. The bad `--field`/`--value` path should teach the valid options the way
`actor create --type BOGUS` already does. Per rubric principle 2, errors must
be self-teaching (`docs/06-api-contract.md`).

## Verification

- Added unit coverage in `apps/cli/tests/unit/usecase-command.test.ts` for
  `usecase set --format=agent` invalid field, invalid `level`, and API 404
  responses.
- Added unit coverage in `apps/cli/tests/unit/change-agent-format.test.ts` for
  `change propose --format=agent` with an incomplete patch file.
- Verification:
  `pnpm exec vitest run apps/cli/tests/unit/usecase-command.test.ts apps/cli/tests/unit/change-agent-format.test.ts`;
  `pnpm --filter @vooster/cli typecheck`.
