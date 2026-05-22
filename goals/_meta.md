# Goal \_meta: Cross-cutting invariants

이 goal은 numeric goal 스택과 별개의 **메타 게이트 모음**이다. 모든 goal에
공통으로 적용되는 universal claim — lint / typecheck / test+coverage / build
— 을 한 곳에 모아, 각 goal-local gate가 자기 goal 고유의 universal claim에만
집중할 수 있게 한다.

> 이 goal을 active로 잡은 에이전트는 먼저 `guidelines/goal-iteration.md`를
> 읽어 iteration 프로토콜을 확인할 것.

## Why this exists

이전엔 같은 명령(`pnpm test`, `eslint .`, `tsc --noEmit`, app builds)이
0/1/2/3/4/5/8 goal에 흩어져 있었고, `.github/workflows/ci.yml` 이 그 중복 위에
또 step을 깔았다. `scripts/completion-check.sh` 한 회당 동일한 작업이 3~4번
돌면서 CI 의 10분 타임아웃에 걸렸다.

문제의 본질은 디자인이었다 — 이 명령들은 "특정 goal 의 universal claim" 이
아니라 **모든 goal 에 공통으로 적용되는 cross-cutting universal claim** 이다.
그러므로 각 goal-local gate 가 아니라 메타 레벨에 한 번만 enforce 되어야
한다.

## The Goal

다음 조건이 **모두** 성립한다:

1. **Every TypeScript source file** under `apps/*/src` and `apps/*/tests`
   passes `tsc --noEmit` against the root `tsconfig.json`.
2. **Every TypeScript / TSX source file** in the repo passes ESLint with
   zero warnings (`pnpm exec eslint . --max-warnings 0`).
3. **Every vitest test** in the suite passes, and the coverage thresholds
   declared in `vitest.config.ts` are met (`pnpm exec vitest run --coverage`).
4. **Every app under `apps/*` that declares a `build` script** (api, cli, web,
   www) builds successfully (`pnpm --filter @vooster/<app> build`).

각 condition 은 source-of-truth 로부터 enumerate 된다:

| Condition        | Source of truth                                                       | Iteration                                 |
| ---------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| typecheck        | `tsconfig.json` 의 transitive include                                 | `pnpm exec tsc --noEmit` (sweep)          |
| lint             | `eslint.config.js` 의 적용 범위                                       | `pnpm exec eslint .` (sweep)              |
| tests + coverage | `vitest.config.ts`                                                    | `pnpm exec vitest run --coverage` (sweep) |
| builds           | `find apps -maxdepth 2 -name package.json` 중 `scripts.build` 가진 것 | bash `for` loop over `pnpm --filter`      |

## Env flags

| Env                       | Effect                                                                                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VSPEC_GATES_SKIP_DEEP=1` | M.3 (vitest + coverage) 와 M.4 (app builds) 를 스킵. 빠른 iteration 용. 풀 검증은 그 env 없이.                                                                                                                                                                                                   |
| `VSPEC_GATES_SKIP_META=1` | `completion-check.sh` 가 `_meta` 전체를 sweep 에서 제외. CI 워크플로우에서만 사용 — workflow step 들이 이미 lint/typecheck/test/build 를 명시적으로 돌리고 있으므로 중복 실행을 피한다. 로컬 full sweep(`pnpm verify` 또는 pre-push hook)에서는 이 env 가 unset 이므로 `_meta` 가 정상 실행된다. |

`SKIP_DEEP` 은 numeric goal 들의 `SKIP_DEEP` 정책과 동일한 의미 — 외부
시스템 / 무거운 도구 호출을 빠른 iteration 에서만 우회.

`SKIP_META` 는 환경별 책임 분리다. **"메타 claim 은 누가 enforce 하는가"**
는 환경에 따라 다르다:

- **로컬 full sweep (`pnpm verify` 또는 pre-push hook)**: `_meta.gates.sh` 가 직접 enforce.
- **CI (GitHub Actions)**: `.github/workflows/ci.yml` 의 step 들이 분담
  enforce (각 step 이 Actions UI 에 분리되어 보이므로 디버깅이 쉽다).

어느 쪽이든 4 가지 claim 은 모두 검증된다 — 다만 실행 주체가 다를 뿐.

## Why this goal is "\_" prefixed

`_meta` 는 numeric goal 스택과 별개의 메타 단계다. `_` ASCII (0x5F) 가
숫자(0x30–0x39) 뒤에 정렬되므로 `sort -V` 기본 순서로는 마지막에 오지만,
`completion-check.sh` 는 이 파일을 인식해 **goal sweep 시작 시 가장 먼저
launch** 한다. 이렇게 하면:

- meta 가 실패할 경우 `.state/active-goal` 에 `_meta` 가 기록되어,
  next-task 가 `goals/_meta.next-task.sh` 로 dispatch 한다.
- meta 가 통과하면 cross-cutting 부분은 그 단일 호출로 책임을 다하고,
  나머지 numeric goal worker 는 자기 universal claim 에만 집중한다.

## Relation to numeric goals

| Previous location                                                                 | Now in \_meta       |
| --------------------------------------------------------------------------------- | ------------------- |
| `goals/0-init.gates.sh` — `vitest --coverage`, `tsc --noEmit`, `eslint .`         | M.1, M.2, M.3       |
| `goals/1-runnable.gates.sh` — `vitest run apps/cli/tests/e2e-cli`                 | M.3 (suite 의 일부) |
| `goals/2-shippable.gates.sh` — `vitest run` matrix files, UC-001-real-oauth       | M.3                 |
| `goals/3-managed-db.gates.sh` — `vitest run apps/cli/tests/e2e-cli`, matrix files | M.3                 |
| `goals/4-honest-boundaries.gates.sh` — `pnpm exec eslint . --max-warnings 0`      | M.2                 |
| `goals/5-monorepo.gates.sh` — `pnpm --filter @vooster/{api,cli,www} build`        | M.4                 |
| `goals/8-web-readonly-viewer.gates.sh` — `pnpm --filter @vooster/web build`, e2e  | M.4                 |

각 numeric goal 의 `.md` 본문에서 cross-cutting 부분은 "see goals/\_meta.md"
포인터로 대체되었고, 자신의 goal-specific universal claim 만 남았다.
