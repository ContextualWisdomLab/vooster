# Goal 35 — Korean-aware verb phrase validation

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Mission

The API must accept Korean-first use-case titles that are valid verb phrases,
while keeping the existing English verb-phrase behavior and exposing a
`spec_language` concept that defaults to Korean.

## Why This Goal Exists

This promotes L1 from
`docs/findings/2026-06-02T1827-spec-mvp-lessons-for-main.md`. The product is
Korean-first, but `apps/api/src/application/verb-phrases.ts` previously matched
only ASCII-leading English words. A Korean title such as `주문을 생성한다` therefore
failed the core authoring path even though it is the expected local product
language.

## Completion Conditions

1. Korean verb-phrase titles such as `주문을 생성한다` pass the application
   heuristic and use-case authoring.
2. Existing English verb-phrase titles continue to pass.
3. Non-action Korean noun titles still fail without `force`.
4. Doctor diagnostics do not false-flag a complete Korean use case.
5. `apps/` contains a `spec_language` concept with default Korean selection.

## Sources Of Truth

- `docs/findings/2026-06-02T1827-spec-mvp-lessons-for-main.md`
- `apps/api/src/application/verb-phrases.ts`
- `apps/api/src/application/usecases.ts`
- `apps/api/src/application/doctor.ts`
- `apps/api/tests/unit/application/verb-phrases.test.ts`
- `apps/api/tests/unit/application/usecases.test.ts`
- `apps/api/tests/unit/application/doctor.test.ts`
- `apps/api/tests/e2e/UC-009.test.ts`

## Verification

```
pnpm exec vitest run apps/api/tests/unit/application/verb-phrases.test.ts apps/api/tests/unit/application/usecases.test.ts apps/api/tests/unit/application/doctor.test.ts apps/api/tests/e2e/UC-009.test.ts
bash goals/35-korean-verb-phrase.gates.sh
bash scripts/completion-check.sh
```
