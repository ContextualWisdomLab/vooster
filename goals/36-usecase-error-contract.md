# Goal 36 — Use case self-teaching error contract

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Mission

Use-case authoring errors must be typed and self-teaching: validation failures
name the offending field and allowed values, and the CLI derives `error.code`
from the API error source instead of matching human problem titles.

## Why This Goal Exists

This promotes L2 from
`docs/findings/2026-06-02T1827-spec-mvp-lessons-for-main.md`. The existing API
collapsed zod failures to `Invalid use case request`, which told an agent that
the request failed but not which field was wrong or how to recover. The CLI also
classified some domain errors by literal problem-title strings, so message
copy or Korean localization could silently change the structured error code.

## Completion Conditions

1. An invalid usecase create payload returns a coded problem with `code`,
   `field`, and `allowed_values` when the field has an enum domain.
2. Usecase authoring domain failures emit source error codes such as
   `TITLE_NOT_VERB_PHRASE` and `PRIMARY_ACTOR_NOT_AVAILABLE`.
3. CLI error classification prefers the typed API `code` field over HTTP status
   and problem-title text.
4. `apps/cli/src/domain/error-codes.ts` has no problem-title literals for
   usecase authoring classification.

## Sources Of Truth

- `docs/findings/2026-06-02T1827-spec-mvp-lessons-for-main.md`
- `packages/contracts/src/common.ts`
- `apps/api/src/http/usecase-routes.ts`
- `apps/api/src/http/usecase-results.ts`
- `apps/api/src/http/usecase-validation-problem.ts`
- `apps/api/tests/integration/http/usecase-route.test.ts`
- `apps/api/tests/unit/http/usecase-results.test.ts`
- `apps/cli/src/domain/error-codes.ts`
- `apps/cli/tests/unit/error-codes.test.ts`

## Verification

```
pnpm --filter @vooster/contracts build
pnpm exec vitest run apps/api/tests/integration/http/usecase-route.test.ts apps/api/tests/unit/http/usecase-results.test.ts apps/cli/tests/unit/error-codes.test.ts
bash goals/36-usecase-error-contract.gates.sh
bash scripts/completion-check.sh
```
