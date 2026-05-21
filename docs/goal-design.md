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

## Gate 실행 최적화

`*.gates.sh`를 그대로 두면 `completion-check.sh` 한 번 호출로
`goal-0` gate suite가 6번 돈다 (Tranche D에서 lower goal을 재귀적으로
호출). 이를 줄이기 위해 다음 메커니즘이 들어가 있다.

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

### 2. Deep-gate skip flag

`VSPEC_GATES_SKIP_DEEP=1`을 export 하면 무거운 외부-시스템 gate를
스킵한다 (현재는 goal-2.B3의 `docker compose build / up`).

- 스킵된 run은 **캐시를 저장하지 않는다** — partial run은 authoritative가
  아니므로 다음 full run을 강제한다.
- Tranche D 회귀 호출에도 env가 전파되므로, goal-3에서 goal-2를 호출할
  때도 skip이 유효하다. 이때도 goal-3 자체 캐시는 저장되지 않는다.

빠른 iteration:

```
VSPEC_GATES_SKIP_DEEP=1 bash scripts/completion-check.sh
```

배포 직전 풀 검증:

```
bash scripts/completion-check.sh
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
