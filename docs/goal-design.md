# Goal 시스템 설계 노트

이 레포는 codex / Claude 같은 루핑 에이전트가 자율적으로 vspec MVP를
빌드하도록 설계된 **autonomous build harness**다. 사람이 직접 빌드하기
보다 에이전트가 매 iteration마다 동일한 루프를 돌리도록 디렉토리가
구조화돼 있다.

> **에이전트 작업 프로토콜**: 이 문서는 harness의 **설계**를 설명한다.
> 한 iteration 안에서 무엇을 어떤 순서로 실행하는지 (Orient → Read
> Spec → Test Plan → TDD → Verify → Record → Commit), `docs/state/*`를
> 어떻게 다루는지, gate를 어떻게 설계하는지 같은 **운영 매뉴얼**은
> `guidelines/goal-iteration.md`에 있다. goal 루프로 작업하는 에이전트는
> 그 파일을 먼저 읽어야 한다.

## 핵심 아이디어

- 미션은 `goals/` 아래의 **버전드 goal 스택**으로 표현된다.
- 각 goal은 머신이 검증 가능한 **gate들**의 집합이다.
- 가장 낮은 번호의 실패 goal이 **active goal**이 된다. 그 한 파일이
  모든 도구(`diagnose`, `next-task`)의 라우팅 신호다.
- 에이전트는 active goal의 `next-task.sh` 출력에 따라 TDD를 진행하고,
  `completion-check.sh`가 다시 평가한다.

## 디렉토리 역할

### `goals/` — 미션 스택

각 goal은 **세 파일 한 세트**:

| 파일                      | 역할                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `<n>-<name>.md`           | 미션 선언. "완료" 조건들을 자연어로 기술 (universal claim 사용)                                           |
| `<n>-<name>.gates.sh`     | 그 조건들을 기계적으로 검증. **goal text가 "every X"면 gate는 X를 source-of-truth에서 enumerate 해야 함** |
| `<n>-<name>.next-task.sh` | 워크플로우 state (파일 존재, 단계 진행도) 를 보고 다음 액션 hint 출력 (advisory — 강제 아님)              |

현재 stack:

- `0-init` — 35개 UC를 TDD로 모두 채우기 (E2E + 커버리지 + bypass 없음 + dogfood)
- `1-runnable` — 실제로 부팅 / Prisma 영속화 / oclif CLI / 레이어드 아키
- `2-shippable` — 배포 가능 (Docker 자산 + 영속화 매트릭스 + 실 OAuth)
- `3-managed-db` — Postgres로 통일 (테스트 + 프로덕션 + CI)

### `scripts/` — goal-agnostic 하네스

| 파일                  | 역할                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `diagnose.sh`         | 매 iteration 첫 단계. git 상태, active goal, scaffolding, 테스트, UC progress를 한 번에 출력                              |
| `completion-check.sh` | goal들을 번호순으로 돌면서 각 `<n>-*.gates.sh`를 실행. **첫 번째 실패한 goal을 `.state/active-goal`에 기록**              |
| `next-task.sh`        | `.state/active-goal` 읽고 해당 goal의 `next-task.sh`로 dispatch                                                           |
| `update-state.sh`     | `docs/state/progress.md`, `next-task.md`를 git + 테스트 결과로 재생성                                                     |
| `check-*.sh`          | gate들이 호출하는 building block (bootable, persistence, cli, layers, bypass, db-consistency, deployable, gate-rigor, ci) |
| `verify-tdd.sh`       | RED → GREEN 커밋 패턴 검증                                                                                                |

### `.state/` — 하네스의 휘발성 상태

- `active-goal` — 첫 실패 goal 경로, 또는 `ALL_DONE`
- `passing_tests.txt`, `dogfood.log` — 회귀 감지용

### `docs/state/` — 에이전트의 스크래치패드

- `progress.md`, `next-task.md` — `update-state.sh`가 자동 생성 (손대지 말 것)
- `blockers.md`, `learnings.md` — append-only

## 한 iteration의 흐름

회귀 감지를 세 단계로 나눈 구조다. iteration 중엔 활성 goal 만 빠르게 검사
(~5–30 s), 커밋할 때는 staged 파일의 impact set 만 검사(P50 <2 s,
P95 <5 s 목표), 푸시/CI/명시적 verify 에서 전체 chain 풀 sweep(~1–3 분)을
돌린다.

```
bash scripts/diagnose.sh              # cheap: .state/active-goal 만 읽고 표시
   └─ next-task.sh
        └─ .state/active-goal 읽음
        └─ goals/<active>.next-task.sh exec → "다음 할 일" 출력

# 에이전트가 출력대로 RED 테스트 → 커밋 → GREEN 코드 → 커밋 (AGENTS.md의 TDD 룰)

bash scripts/verify-tdd.sh            # TDD 프로토콜 위반 검사
bash scripts/update-state.sh          # docs/state/* 갱신
bash scripts/active-check.sh          # 활성 goal 만 검사 + rigor sweep
   └─ rigor 실패 → exit 1 (의미 drift)
   └─ 활성 goal 아직 fail → exit 1, .state/active-goal 유지
   └─ 활성 goal pass → 자동으로 completion-check.sh 로 exec
        └─ 다음 active goal 결정 + 모든 prior goal 회귀 점검

# 커밋 경계 (.git/hooks/pre-commit 설치된 상태)
git commit
   └─ pre-commit hook → bash scripts/commit-check.sh
        └─ staged hygiene + impacted tests/gates 만 통과해야 commit 성공
        └─ broad/unknown impact 는 full sweep 필요 메시지 출력
        └─ 실패 시 commit 거부 (--no-verify 로 우회 가능)

# 푸시/verify 경계
git push
   └─ optional pre-push hook → bash scripts/completion-check.sh
pnpm verify
   └─ bash scripts/completion-check.sh
```

비용 모델:

| 명령                  | 범위                      | 비용                         | 호출 시점          |
| --------------------- | ------------------------- | ---------------------------- | ------------------ |
| `diagnose.sh`         | state 표시만              | sub-sec                      | 매 iter 시작       |
| `active-check.sh`     | active goal + rigor sweep | ~5–30 s                      | 매 iter 끝         |
| `commit-check.sh`     | staged impact + hygiene   | P50 <2 s, P95 <5 s           | commit             |
| `completion-check.sh` | 모든 goal                 | ~1–3 분 (캐시 hit 비율 의존) | pre-push, CI, 수동 |

설계 의도: 풀 sweep 이 매 iter 마다 돌면 1:36 × N 으로 누적되어 100 goals
시점엔 사실상 불가능. 그러나 prior goal 회귀 감지는 포기할 수 없는
자산. 그래서 **자주 일어나는 사건(edit/commit)** 에서는 가벼운 검사를 하고,
**공유/병합 경계(push/CI)** 에서 무거운 검사를 한다.

## 핵심 설계 원칙

### 1. Universal claim ↔ Universal gate

goal 텍스트가 "every entity is persisted"라고 쓰면 gate 스크립트는
`prisma/schema.prisma`에서 모든 모델을 `grep`으로 뽑아 루프를 돌려야
한다. 한 예시만 통과시키는 cheat 방지. `scripts/check-gate-rigor.sh`가
이걸 메타-검증한다 (`AGENTS.md:252-281`).

Sources of truth와 그 iteration 명령:

| 대상       | 명령                                                      |
| ---------- | --------------------------------------------------------- |
| 엔티티     | `grep '^model ' prisma/schema.prisma \| awk '{print $2}'` |
| 유스케이스 | `find docs/usecases -name 'UC-*.md'`                      |
| 라우트     | `find src/http -name '*-routes.ts'`                       |
| CLI 명령   | `grep -oE '"vspec [^"]+"' src/http`                       |

### 1.5 Gates 가 _하지 말아야_ 할 것

§1 은 "universal claim 이면 enumerate 하라" 는 positive rule 이다.
그 반대도 똑같이 중요하다 — **다른 도구가 더 정확하게 잡는 invariant
를 gates.sh 가 grep 으로 흉내내지 마라.** 이 trap 에 빠지면 gates 가
구현 형태/심볼 이름에 강결합되어 200~400 줄로 부풀어오르고, benign
refactor 에서 spurious fail 하며, 정작 보장은 약하다.

gates.sh 가 검사해서는 안 되는 것:

| 안 좋은 gate 패턴                            | 더 적절한 도구           |
| -------------------------------------------- | ------------------------ |
| 함수 본문이 특정 심볼/헬퍼를 호출하는지      | **테스트** (행위 검증)   |
| 타입 선언에 특정 필드가 있는지               | **typecheck**            |
| 테스트 파일에 특정 토큰/제목 문자열이 있는지 | **테스트 실행 (runner)** |
| 특정 경로에 테스트 파일이 존재하는지         | **coverage threshold**   |
| 마크다운 문서에 특정 헤딩/문장이 있는지      | **코드 리뷰**            |
| findings 파일에서 특정 bullet 이 제거됐는지  | **커밋 메시지 / PR**     |

gates.sh 가 _유일하게_ 책임지는 건 세 종류만 남는다:

1. **Rigor 메커니즘** — §1 의 universal claim ↔ enumeration 메타
   체크 (`check-gate-rigor.sh`).
2. **Negative universal invariant** — "codebase 어디에도 패턴 X 가
   없다" 같은 single grep. 행위 테스트는 한 경로만 검증하므로 이건
   못 잡음.
3. **구조 앵커** — 후속 goal 이 routing 신호로 쓰는 문서/파일의
   존재 (예: deferred work 를 큐잉한 findings 파일).

회의적 휴리스틱: **"이 invariant 가 깨지면 어떤 테스트가 빨갛게
되는가?"** 답이 있으면 gates 에서 빼라. 답이 없을 때만 gate 가
적절하다.

참조 구현 패턴 (63 줄 / 2 gate 의 minimal gates.sh):
`docs/findings/2026-05-23T1700-gates-over-coupling.md` § "What good
looks like" 에 인라인 인용. 배경 분석과 기존 goal 7-29 의 trim
migration plan 도 같은 문서.

### 2. 첫 실패 goal = 작업 대상

`completion-check.sh`가 goal들을 번호순으로 돌면서 첫 실패만
`.state/active-goal`에 쓰고, 이후 모든 도구가 그 한 파일을 신호로 사용.
새 goal을 추가하면 자동으로 흐름이 거기로 흘러간다.

### 3. Tranche D = 자체 검사 (회귀는 orchestrator 가 담당)

각 goal의 Tranche D 는 이제 그 goal의 **자체 메타 체크**만 한다 —
`check-gate-rigor.sh` (markdown enumeration), goal 4의 경우는 추가로
`check-honest-gates.sh`. 이전 goal에 대한 회귀 검사는 `*.gates.sh`
밖으로 빠지고 `scripts/completion-check.sh` 가 단독으로 책임진다.

즉:

- `bash goals/3-managed-db.gates.sh` 를 단독 실행하면 goal 3의 A/B/C/D
  만 검사한다. goal 0/1/2 가 깨졌는지는 모름.
- "전체 체인 green" 을 보려면 `bash scripts/completion-check.sh` 를
  돌려야 한다. 이게 모든 goal 의 gate 를 병렬로 (기본 동시성 2) 띄우고
  하나라도 fail 이면 첫 실패 goal 을 `.state/active-goal` 에 기록.

이 분리의 이유:

1. **N² → N**. 예전엔 goal 5 D1 이 goal 0..4 를 재귀 호출했고, 각각이
   다시 자기 D 트랜치를 돌리면서 nested 호출이 폭발했다. 캐시가 데워
   있으면 O(N) 이지만 cold 일 땐 O(N²). orchestrator 가 단일 진입점이면
   goal 당 정확히 1번 실행.
2. **병렬화 가능**. 각 goal 이 standalone 이므로 의존성 없이 동시에
   실행할 수 있다. CPU/디스크 자원 충돌이 우려되면
   `VSPEC_GATES_CONCURRENCY=1` 로 시리얼로 회귀.
3. **standalone 의미가 정직해진다**. "이 게이트가 통과하면 이 goal 이
   되는가" 만 검사. "그리고 전체 chain 이 healthy 한가" 는 별개 질문이
   고 별개 도구가 답한다.

### 4. Orchestrator 가 rigor sweep 도 책임진다

`completion-check.sh` 는 parallel goal 워커를 띄우기 _전에_
`bash scripts/check-gate-rigor.sh --all` 을 한 번 돌린다. 이유:

- goal 0/1 은 자기 `.md` 를 자기 `GATE_INPUTS` 에 안 넣어둔 상태였고
  Tranche D 에 rigor 도 없었다 → `.md` 본문에 새 universal claim
  ("every X must Y")을 추가하면 캐시가 hit 한 채로 통과해버린다.
- goal 2~5 는 자기 Tranche D 에서 자기 `.md` 만 rigor 한다. 다른 goal
  의 `.md` 가 직접 수정돼도 보지 못한다.
- orchestrator 에서 한 번 전부 훑으면 위 두 leak 이 동시에 닫힌다.
  비용은 `O(goals)` 의 grep 한 번이라 사실상 공짜.

이 sweep 이 실패하면 orchestrator 는 첫 실패한 `.md` 를
`.state/active-goal` 에 쓰고, parallel 워커를 띄우긴 하지만 전체
`OVERALL_PASS` 는 false 로 굳는다 — 게이트 워커는 진단 정보를 위해 계속
출력된다.

한계: rigor 가 잡는 건 "universal claim 이 있는데 iteration 이 아예
없음" 이다. `for` 루프 안에 `continue` 를 끼워 enumeration 을 우회하는
류의 미세 weakening 은 못 잡는다. 그런 케이스는 코드 리뷰 / `.md` ↔
gate 같은 커밋 정책으로 막아야 한다.

### 5. 이전 goal 의 게이트는 immutable 이 기본값

새 goal 이 기존 goal 의 invariant 를 깨뜨릴 수 있다 (기획 변경,
아키텍처 교체, 기능 제거). 무작정 약화시키거나 삭제하는 건 금지. 다음
네 케이스만 허용:

| 케이스                                                                                               | 예                                                                                | 허용된 조치                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) Retarget** — invariant 그대로, 경로/도구만 변경                                                | monorepo 이동 (`src/` → `apps/api/src/`)                                          | 같은 goal 작업 안에서 prior `*.gates.sh` 경로 수정. prior `.md` 는 손대지 않음. 커밋: `fix(<scope>): retarget <goal> gate`                                                                |
| **(b) Loosen invariant** — 검사 로직 자체가 바뀌어야 함                                              | "한 파일에 모든 모델" → "여러 파일 중 하나에 등장"                                | 별도 scoped 커밋. prior `.md` 본문도 같은 커밋에서 수정해 universal claim 과 gate 를 다시 일치시킴. retarget 같은 다른 의도와 conflate 금지                                               |
| **(c) Supersede** — invariant 가 새 아키텍처에서 의미 상실                                           | Fastify → Hono 교체 시 goal-1 Fastify 부팅 게이트                                 | 새 goal `.md` 에 **`## Supersedes`** 섹션을 만들어 "goal N 의 gate X.Y 를 대체한다" 를 명시. prior gate 는 새 invariant 로 교체하거나 삭제 — 단, 새 goal `.md` 의 명시적 선언 없이는 불가 |
| **(d) Documentation lag** — invariant 는 유지되지만 prior goal 의 prose 가 superseded design 을 설명 | prior Tranche D prose 가 orchestrator-owned regression 을 직접 gate 실행처럼 설명 | gate 는 건드리지 않고 prior `.md` prose 만 scoped 문서 커밋으로 현재 enforcement 위치에 맞춘다. invariant 는 unchanged 로 기록                                                            |

금지:

- 커밋 메시지는 retarget 인데 enumeration 로직이 함께 약화되는 것
- prior `.md` 본문은 그대로 두고 gate 만 느슨하게 만드는 것
  (gate 가 더 이상 `.md` 의 universal claim 을 enforce 하지 않게 됨 —
  orchestrator rigor sweep 이 일부는 잡지만 미세 weakening 은 못 잡음)
- 새 goal `.md` 의 명시적 선언 없이 prior gate 파일을 삭제하는 것

선례: `docs/findings-test-perf-debt.md` 가 케이스 (b) 를 어떻게
큐잉했는지 참고 — Goal 5 의 path retarget (케이스 a) 과 분리해 별도 PR
로 미뤘다. 두 의도를 한 커밋에 섞으면 리뷰어가 "이게 단순 이동인지
invariant 약화인지" 구분할 수 없게 된다.

#### 케이스 (b) 의 특수형: "Enforcement 이전"

§1.5 에 따라 기존 goal 의 gate 가 검사하던 항목이 사실은 테스트 /
typecheck / coverage 가 더 정확하게 잡고 있는 것으로 판명될 때 — 즉
gate 의 grep 을 제거해도 동일 invariant 가 다른 도구로 여전히
enforce 될 때 — 이건 형식상 케이스 (b) 지만 실질적으로는 **invariant
약화가 아니라 enforcement 이전 (enforcement transfer)** 이다.

규칙:

- PR 설명 / 커밋 메시지에 어떤 도구가 동일 invariant 를 enforce
  하는지 명시. 예: `refactor(goals/22): move comment-format token
greps to unit-test assertions — invariant unchanged, tests cover`.
- prior `.md` 본문도 같은 커밋에서 손대 universal phrasing 을
  정리해 `check-gate-rigor.sh` 가 일관되게 통과하도록 한다.
- 다른 goal 의 gate trim 과 한 커밋에 섞지 마라. goal 당 1 PR 이
  원칙. 리뷰어가 "이 trim 으로 정말 invariant 가 약화되지 않았는지"
  를 goal 단위로 확인할 수 있어야 한다.

배경과 migration plan: `docs/findings/2026-05-23T1700-gates-over-coupling.md`.

## Gate 실행 최적화

`scripts/completion-check.sh` 는 goal 당 정확히 1번 실행한다. 이 위에
다음 메커니즘이 얹혀 있다.

### 1. Per-goal cache

각 goal의 gate 스크립트는 `scripts/_gate-cache.sh`를 source 한다.

- 각 gate 스크립트는 상단에 `GATE_INPUTS=(...)` 배열을 선언한다 — 그
  goal의 게이트가 실제로 의존하는 파일/디렉터리/글롭 목록이다.
- 캐시 key = `GATE_INPUTS`로 결정되는 **파일 내용의 sha256 fingerprint**.
  디렉터리는 재귀적으로 해시 (단 `node_modules`, `dist`, `.git`, `.state`,
  `.next`, `.turbo`, `coverage`, `.astro` 는 prune). git 상태는 보지 않는다.
- 캐시 hit이면 gate 스크립트 즉시 `exit 0` (메시지:
  `[cache hit] goal … inputs unchanged`).
- gate suite가 성공하면 현재 fingerprint를 `.state/gate-cache/<goal-name>`
  에 저장한다.
- gate suite가 **실패하면 캐시를 저장하지 않는다** — 다음 실행에서 반드시
  재실행된다. `VSPEC_GATES_SKIP_DEEP=1`은 이미 실패한 goal의 재실행 비용을
  줄이지 않는다.
- `.state/`는 `.gitignore`에 들어있어 커밋되지 않음.

이 설계의 핵심은 **병렬 작업 안전성**이다. 한 에이전트가 `apps/www/`를
편집하는 동안 다른 에이전트가 goal-0 gate를 돌릴 때, goal-0의
`GATE_INPUTS`가 `apps/www/`를 포함하지 않으므로 fingerprint가 동일하고
캐시가 그대로 hit한다. in-scope 파일이 바뀌면 (committed든 아니든)
fingerprint가 달라져 자동으로 invalidate.

수동 무효화:

```
rm -rf .state/gate-cache              # 전체 캐시 버스트
rm    .state/gate-cache/0-init        # 한 goal만
VSPEC_GATES_NO_CACHE=1 bash goals/0-init.gates.sh   # 일회성 우회
```

### 2. Deep/world gate split

`completion-check.sh` 는 기본으로 `VSPEC_GATES_SKIP_DEEP=1` 을 설정한다.
반복 개발 체인은 working tree 내부의 deterministic code contract만 다룬다.
Docker/Vercel 같은 외부 world-state gate는 `scripts/world-check.sh` 와
`.github/workflows/world-health.yml` 이 별도 cadence로 실행한다.

- 스킵된 run은 **캐시를 저장하지 않는다** — partial run은 authoritative
  가 아니므로 다음 full run을 강제한다.
- `completion-check.sh` 가 worker 에게 env 를 전파하므로 모든 goal 에
  동시에 적용된다.

빠른 iteration:

```
bash scripts/completion-check.sh
```

world-state 수동 검증:

```
bash scripts/world-check.sh
```

병렬도 조정:

```
VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh   # 시리얼
VSPEC_GATES_CONCURRENCY=4 bash scripts/completion-check.sh   # 자원 여유 있을 때
```

### 3. Gate 0.2 = Tests + Coverage (병합됨)

`vitest run --coverage`가 일반 `vitest run`을 strict하게 포함하므로
(테스트 실패 또는 커버리지 threshold 미달 둘 다 exit non-zero), 별도의
"테스트만" gate를 두지 않는다. 그래서 goal-0은 5 gate.

### 4. `diagnose.sh` / `update-state.sh`의 UC 매트릭스

이전엔 UC 35개 각각에 `npx vitest run <file>`을 cold-start 했다 (35×
vitest 부팅). 지금은 `scripts/_uc-status.mjs`가 vitest를 **한 번** 호출해
json reporter 출력을 파일별 PASS/FAIL로 변환하고, bash가 그 결과를
`grep`으로 lookup한다.

## 새 goal 추가하기

`.state/active-goal`이 `ALL_DONE`이면 모든 gate가 통과한 상태.
새 작업이 필요하면 세 파일 세트를 추가한다:

```
goals/4-<name>.md            # 미션
goals/4-<name>.gates.sh      # 머신 검증 (chmod +x)
goals/4-<name>.next-task.sh  # 다음 액션 hint (chmod +x)
```

다음 `completion-check.sh` 실행이 이걸 active로 잡는다.

### `.md` 본문 컨벤션

새 goal `.md` 의 맨 위(제목 바로 아래)에 한 줄 포인터를 둔다:

```
> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.
```

이유: active goal 파일은 종종 에이전트가 세션에서 처음 읽는 mission 텍
스트다. 거기서 운영 매뉴얼로 한 hop 안에 도달하지 못하면 에이전트가
TDD 단계, state 파일 규칙, gate 설계 원칙을 모른 채 작업을 시작한다.

### 작성 전 self-audit

새 goal `.md` 를 쓰기 전에 다음을 자문한다 (원칙 5 의 케이스 분류를
미리 적용하는 단계):

1. 이 goal 이 이전 게이트의 **경로/도구**만 바꿔도 통과 가능한가?
   → 케이스 (a). 같은 goal 작업 안에서 retarget 하면 끝.
2. 이 goal 이 이전 게이트의 **검사 로직 자체**를 바꿔야 통과 가능한가?
   → 케이스 (b). `docs/findings/*.md` 에 일단 큐잉하고 별도 PR 로
   분리한다. 이 goal 의 메인 작업과 섞지 말 것.
3. 이 goal 로 인해 이전 게이트의 **존재 이유 자체가 사라지는가**?
   → 케이스 (c). `.md` 본문 상단에 `## Supersedes` 섹션을 작성하고,
   대체되는 gate 번호를 enumerate. 이게 없으면 prior gate 수정 금지.

이 self-audit 이 누락된 채 새 goal 이 들어가면 `completion-check` 는
초록일 수 있어도 시스템의 의미가 조용히 무너진다 — gate 가 무엇을
약속하는지 아무도 더 이상 보장하지 않게 된다.

## Claude 위임 (claude-owned goals)

presentation layer 작업(UI/UX, 카피라이팅, 디자인)은 codex 대신 Claude
Code에 headless로 위임할 수 있다. goal 의 `.md` 가 `## Delegation` 섹션을
선언하면 그 goal 은 **claude-owned** 이 된다:

```markdown
## Delegation

- owner: claude
- cwd: apps/web
- model: opus
```

이때 흐름이 바뀌는 지점은 "codex 가 직접 TDD" 자리 하나뿐이다:

- `scripts/next-task.sh` 가 활성 goal 의 이 마커를 감지해
  `scripts/delegate-to-claude.sh` 로 라우팅한다 (advisory hint).
- `delegate-to-claude.sh` 가 그 goal 의 단일 결정론적 오케스트레이터로서
  Claude 를 **한 step 씩**(= 그 goal 의 `next-task.sh` 출력) 호출해 짓고,
  게이트가 green 이 되면 종료한다. 정체/예산 초과 시 blocker 후 exit 3.
- 그 뒤의 검증 경계(`completion-check.sh` 의 게이트 확인 · 포인터 전진 ·
  회귀 점검)는 **일반 goal 과 완전히 동일**하다.

핵심 불변량:

- **핸드오프 패킷은 goal trio 자체다.** 완료가 이미 `gates.sh` 라는
  기계검증 계약으로 표현되므로, 위임에 별도 작업지시 포맷이 필요 없다 —
  `goal.md`(계약) + `next-task.sh` 출력(현재 step)을 Claude 에 인라인한다.
- **`## Delegation` 은 rigor 와 무관한 메타데이터다.** universal claim ↔
  enumeration 규칙(§1)에 영향을 주지 않으며 `check-gate-rigor.sh` 에
  걸리지 않는다.
- **cwd 가 유일한 안전 경계다.** 위임 호출은 `--dangerously-skip-permissions`
  로 권한 프롬프트를 끄므로, Claude 가 다른 레이어(api/domain/ports/
  scripts/goals)를 못 건드리게 막는 건 선언된 `cwd` 디렉토리뿐이다.

위임 대상 goal 의 authoring 요건(이건 §1 의 universal-gate 규칙과 별개로
위임 품질을 좌우한다):

1. `next-task.sh` 가 sub-gate 마다 빠짐없이 detector 를 갖춘 완전한 state
   machine 일 것 ("지금 어디까지" 의 신뢰성).
2. next-task 힌트는 처방을 얇게 — "무엇" 만, "어떻게(정확한 코드/심볼명)"
   는 빼라. 처방이 두꺼우면 위임의 이유(Claude 의 디자인·카피 판단)를
   죽인다.

전체 계약과 메커니즘: `docs/claude/delegation.md`.
