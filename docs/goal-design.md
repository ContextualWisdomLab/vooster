# Goal 시스템 설계 노트

이 레포는 codex / Claude 같은 루핑 에이전트가 자율적으로 vspec MVP를
빌드하도록 설계된 **autonomous build harness**다. 사람이 직접 빌드하기
보다 에이전트가 매 iteration마다 동일한 루프를 돌리도록 디렉토리가
구조화돼 있다.

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

| 파일 | 역할 |
| --- | --- |
| `<n>-<name>.md` | 미션 선언. "완료" 조건들을 자연어로 기술 (universal claim 사용) |
| `<n>-<name>.gates.sh` | 그 조건들을 기계적으로 검증. **goal text가 "every X"면 gate는 X를 source-of-truth에서 enumerate 해야 함** |
| `<n>-<name>.next-task.sh` | 현재 어느 gate가 깨졌는지 보고 다음 RED/GREEN 액션을 출력 |

현재 stack:

- `0-init` — 35개 UC를 TDD로 모두 채우기 (E2E + 커버리지 + bypass 없음 + dogfood)
- `1-runnable` — 실제로 부팅 / Prisma 영속화 / oclif CLI / 레이어드 아키
- `2-shippable` — 배포 가능 (Docker 자산 + 영속화 매트릭스 + 실 OAuth)
- `3-managed-db` — Postgres로 통일 (테스트 + 프로덕션 + CI)

### `scripts/` — goal-agnostic 하네스

| 파일 | 역할 |
| --- | --- |
| `diagnose.sh` | 매 iteration 첫 단계. git 상태, active goal, scaffolding, 테스트, UC progress를 한 번에 출력 |
| `completion-check.sh` | goal들을 번호순으로 돌면서 각 `<n>-*.gates.sh`를 실행. **첫 번째 실패한 goal을 `.state/active-goal`에 기록** |
| `next-task.sh` | `.state/active-goal` 읽고 해당 goal의 `next-task.sh`로 dispatch |
| `update-state.sh` | `docs/state/progress.md`, `next-task.md`를 git + 테스트 결과로 재생성 |
| `check-*.sh` | gate들이 호출하는 building block (bootable, persistence, cli, layers, bypass, db-consistency, deployable, gate-rigor, ci) |
| `verify-tdd.sh` | RED → GREEN 커밋 패턴 검증 |

### `.state/` — 하네스의 휘발성 상태

- `active-goal` — 첫 실패 goal 경로, 또는 `ALL_DONE`
- `passing_tests.txt`, `dogfood.log` — 회귀 감지용

### `docs/state/` — 에이전트의 스크래치패드

- `progress.md`, `next-task.md` — `update-state.sh`가 자동 생성 (손대지 말 것)
- `blockers.md`, `learnings.md` — append-only

## 한 iteration의 흐름

```
bash scripts/diagnose.sh              # 어디까지 왔는지 출력 (내부에서 next-task.sh 호출)
   └─ next-task.sh
        └─ .state/active-goal 읽음
        └─ goals/<active>.next-task.sh exec → "다음 할 일" 출력

# 에이전트가 출력대로 RED 테스트 → 커밋 → GREEN 코드 → 커밋 (AGENTS.md의 TDD 룰)

bash scripts/verify-tdd.sh            # TDD 프로토콜 위반 검사
bash scripts/update-state.sh          # docs/state/* 갱신
bash scripts/completion-check.sh      # 모든 goal의 gate를 다시 평가
   └─ 통과한 가장 낮은 번호의 다음 goal이 active가 됨
   └─ 전부 통과면 .state/active-goal = "ALL_DONE", exit 0
```

## 핵심 설계 원칙

### 1. Universal claim ↔ Universal gate

goal 텍스트가 "every entity is persisted"라고 쓰면 gate 스크립트는
`prisma/schema.prisma`에서 모든 모델을 `grep`으로 뽑아 루프를 돌려야
한다. 한 예시만 통과시키는 cheat 방지. `scripts/check-gate-rigor.sh`가
이걸 메타-검증한다 (`AGENTS.md:252-281`).

Sources of truth와 그 iteration 명령:

| 대상 | 명령 |
| --- | --- |
| 엔티티 | `grep '^model ' prisma/schema.prisma \| awk '{print $2}'` |
| 유스케이스 | `find docs/usecases -name 'UC-*.md'` |
| 라우트 | `find src/http -name '*-routes.ts'` |
| CLI 명령 | `grep -oE '"vspec [^"]+"' src/http` |

### 2. 첫 실패 goal = 작업 대상

`completion-check.sh`가 goal들을 번호순으로 돌면서 첫 실패만
`.state/active-goal`에 쓰고, 이후 모든 도구가 그 한 파일을 신호로 사용.
새 goal을 추가하면 자동으로 흐름이 거기로 흘러간다.

### 3. Tranche D = 회귀 금지

goal 1 이후의 모든 gate suite는 마지막에 **이전 goal들의 gate를 통째로
재실행**한다 (`1.6` = goal-0, `2.D1/2.D2` = goal-0/1, `3.D1/3.D2` =
goal-0/1). 이전 단계가 깨졌으면 현재 goal도 실패로 간주.

## 새 goal 추가하기

`.state/active-goal`이 `ALL_DONE`이면 모든 gate가 통과한 상태.
새 작업이 필요하면 세 파일 세트를 추가한다:

```
goals/4-<name>.md            # 미션
goals/4-<name>.gates.sh      # 머신 검증 (chmod +x)
goals/4-<name>.next-task.sh  # 다음 액션 hint (chmod +x)
```

다음 `completion-check.sh` 실행이 이걸 active로 잡는다.
