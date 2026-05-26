# Claude 위임 — claude-owned goals

> **목적**: codex(루핑 에이전트)가 goal 루프를 돌다가 **presentation layer
> 작업**(UI/UX, 카피라이팅, 디자인)을 만나면 그 goal을 Claude Code에
> headless로 위임한다. 이 문서는 그 계약과 메커니즘을 정의한다. headless
> 호출 플래그의 레퍼런스는 자매 문서 `docs/claude/headless.md`.

## 한 줄 요약

`## Delegation` 마커가 달린 goal은 codex가 TDD로 짓지 않고
`scripts/delegate-to-claude.sh`가 Claude를 **한 step씩** 호출해 짓는다.
작업지시서는 별도 포맷이 아니라 **goal trio 자체**(`goal.md` 계약 +
`next-task.sh` 현재 단계)다. 완료 기준은 `goals/<n>.gates.sh` exit 0.

## 왜 위임하나

codex(범용 코딩 에이전트)가 잘하는 것과 Claude가 잘하는 것이 다르다.
기획·디자인·카피라이팅처럼 **UI/UX가 관여되는 presentation 작업**은
Claude의 판단을 빌리는 편이 낫다. goal의 게이트는 _바닥(floor)_ —
빌드 통과, E2E 여정 작동, 금지 패턴 없음 — 만 기계검증할 수 있고,
_천장(ceiling)_ — 카피가 설득력 있나, 디자인이 좋은가 — 은 검증 불가다.
그 천장이 위임의 이유다.

## 위임 대상 판정 — `## Delegation` 마커

goal의 `.md`가 다음 섹션을 선언하면 그 goal은 **claude-owned**다:

```markdown
## Delegation

- owner: claude
- cwd: apps/app
- model: opus
```

| 필드    | 의미                                                            |
| ------- | --------------------------------------------------------------- |
| `owner` | `claude` 면 위임 대상. (이 필드 없으면 일반 TDD goal)           |
| `cwd`   | Claude가 실행될 앱 디렉토리. **이것이 유일한 안전 경계**(아래). |
| `model` | `opus` / `sonnet` / `haiku`. 생략 시 `opus`.                    |

이 섹션은 universal-claim rigor와 무관한 메타데이터다
(`check-gate-rigor.sh`에 안 걸린다). 마커가 하니스 계약의 일부라는
선언은 `docs/goal-design.md`에 있다.

## 핸드오프 패킷 = goal trio (새 포맷 없음)

이 하니스는 "완료"를 이미 `goals/<n>.gates.sh`라는 기계검증 계약으로
표현한다. 그래서 위임에 별도 작업지시 문서가 필요 없다:

- **goal.md** — 미션 + 완료 조건(계약/전체 그림). Claude 프롬프트에 인라인.
- **goals/<n>.next-task.sh 출력** — "지금 어디까지 했고 다음 한 step은
  무엇인가". 디스크 상태에서 매번 재계산되는 진행도 detector.

이 둘을 합쳐 Claude에게 준다. "진행도 추적 장치"를 따로 만들지 않는다 —
`next-task.sh`가 이미 그 역할을 한다.

## 호출 레시피

`scripts/delegate-to-claude.sh`가 매 라운드 실행하는 호출:

```bash
cd <cwd> && claude --dangerously-skip-permissions \
  --model <model> \
  --append-system-prompt "<계약 프레이밍 + 경계 제약>" \
  --output-format json \
  --max-budget-usd <per-call cap> \
  -p "<goal.md> + <next-task.sh 출력>"
```

플래그 선택의 근거:

- **`--dangerously-skip-permissions`**: headless에서 도구 호출이 권한
  프롬프트에 막히면 무한 대기한다(`headless.md §16.1`). 신뢰하는 로컬
  루프이므로 프롬프트를 끈다.
- **`--bare` 안 씀**: `--bare`는 CLAUDE.md 자동 로딩을 끈다
  (`headless.md §12`). 우리는 cwd의 `CLAUDE.md`/`DESIGN.md`가
  자동 로드되어야 하므로(=무상태 호출 간 공유 디자인 계약) 쓰지 않는다.
- **`--output-format json`**: `total_cost_usd` / `is_error` / `session_id`
  를 결정론적으로 파싱(예산 합산, 에러 판정, 로깅).
- **`--max-budget-usd`**: 호출 1회 비용 상한.

### cwd가 유일한 경계다 (중요)

`--dangerously-skip-permissions`는 권한 *프롬프트*만 없앤다 — *blast
radius*는 안 줄인다. 권한 경계를 끈 순간, Claude가 `apps/api`·`domain`·
`scripts/`·`goals/`를 못 건드리게 막는 건 **"어느 디렉토리에서
실행하느냐"뿐**이다. 그래서:

- 위임 호출은 **반드시 goal이 선언한 앱 디렉토리(`cwd`)에서** 돈다.
- **repo 루트에서 절대 안 돈다.**
- api/domain/ports 등을 `--add-dir`로 열어주지 않는다.
- append-system-prompt가 "이 디렉토리 밖은 손대지 말라"를 명시한다.

## 루프 — `scripts/delegate-to-claude.sh`

스크립트는 한 claude-owned goal의 **단일 결정론적 오케스트레이터**다
(`completion-check.sh`가 게이트 체인의 단일 오케스트레이터인 것과 같은
역할). codex는 이걸 **한 번** 호출하고 최종 verdict만 읽는다.

```
gate 이미 green? → exit 0
loop (최대 ROUND_MAX):
    step = goals/<n>.next-task.sh 출력      # 현재 한 step (디스크에서 재계산)
    fresh claude 호출 (위 레시피, --resume 없음)
    is_error → exit 1
    누적비용 += cost ; > 예산 → blocker + exit 3
    gate green? → exit 0
    step 변화 없음(직전과 동일)? → stall++ ; stall ≥ N → blocker + exit 3
```

- **무상태**: `--resume`을 쓰지 않는다. 진전은 세션이 아니라 **디스크 +
  게이트**에 남는다. 다음 라운드의 새 Claude는 워킹트리 상태 +
  `next-task.sh` 출력 + 자동 로드된 `CLAUDE.md`/`DESIGN.md`로 "어디까지
  했는지"를 재구성한다 — codex 자기 루프가 `diagnose.sh`로 재오리엔트하는
  것과 동일.
- **정체 차단**: `next-task.sh` 출력이 N라운드 연속 동일 = 직전 호출이
  아무 진전을 못 냄 → `docs/state/blockers.md`에 blocker 기록 후 exit 3.
- **예산 차단**: 누적 비용이 goal 예산 초과 → blocker + exit 3.

exit code: `0` green / `1` hard error / `3` stall·budget(에스컬레이션).

### 환경 변수

| Env                              | 기본값 | 효과                                       |
| -------------------------------- | ------ | ------------------------------------------ |
| `VSPEC_DELEGATE_DRY_RUN=1`       | —      | claude 호출 없이 마커 파싱·프롬프트 조립만 |
| `VSPEC_DELEGATE_MODEL`           | 마커값 | 모델 오버라이드                            |
| `VSPEC_DELEGATE_CALL_BUDGET_USD` | 2.00   | 호출 1회 `--max-budget-usd`                |
| `VSPEC_DELEGATE_BUDGET_USD`      | 10.00  | goal 전체 누적 예산                        |
| `VSPEC_DELEGATE_STALL_ROUNDS`    | 3      | 정체 차단 라운드 수                        |
| `VSPEC_DELEGATE_MAX_ROUNDS`      | 40     | 하드 라운드 캡                             |

로그: `.state/delegation/<goal>.log` (gitignore됨).

## 루프 통합 (codex 측)

`scripts/next-task.sh`가 활성 goal의 `## Delegation`을 감지해 "RUN:
delegate-to-claude.sh"를 출력한다. codex는 이미 매 iteration `next-task.sh`
(및 `diagnose.sh` 말미)를 읽으므로 새 plumbing이 없다:

```
completion-check → active-goal
task = scripts/next-task.sh
if task == DELEGATE:
   bash scripts/delegate-to-claude.sh <goal>
   case $? in 0) ;; 3) 멈춤(blocker) ;; *) 에러처리 ;;
else:
   codex가 직접 TDD
completion-check        # 게이트 실제 green 확인 + 포인터 전진 + push
```

`completion-check.sh`가 여전히 최종 검증·전진·회귀 점검의 단일 진입점이다.
위임은 "codex가 직접 TDD" 자리를 대체할 뿐, 그 뒤의 검증 경계는 동일하다.

## 커밋 ownership

**Claude가 자기 step을 직접 커밋**한다(skip-permissions로 git 사용 가능).
step = 커밋 1개, 행위자 = 커밋터. pre-commit 훅(`commit-check.sh`)이
staged 위생을 강제한다. 커밋 컨벤션은 cwd의 `CLAUDE.md`(+ 상속되는 루트
`CLAUDE.md`의 `/commit` 스킬 포인터)가 안내한다. 스크립트는 라운드 후
워킹트리가 dirty면 "커밋 누락 가능성" 경고만 낸다.

## 위임 goal authoring 요건

위임 품질의 두 지렛대 — 위임 대상 goal을 쓸 때 반드시:

1. **`next-task.sh`가 sub-gate마다 빠짐없이 detector를 갖춘 완전한 state
   machine**일 것. "지금 어디까지"의 신뢰성이 여기서 나온다. detector가
   빠진 sub-gate는 Claude에게 "다음 할 일"로 안 떠오른다.
2. **next-task 힌트는 처방을 얇게.** "무엇(=sub-gate가 요구하는 것)"만
   주고 "어떻게(정확한 JSX·심볼명·코드 전문)"는 빼라. 처방이 두꺼우면
   위임의 이유(Claude의 디자인·카피 판단)를 죽인다. 이는
   `guidelines/goal-iteration.md`의 "Designing next-task hints" 원칙을
   위임 맥락에서 강화한 것이다.

## 일관성 — DESIGN.md가 공유 메모리

무상태 재투입에서는 독립된 두 호출이 서로 다른 디자인 결정(네이밍, 카피
톤, 간격 체계)을 내릴 수 있고, 이를 잡는 게이트가 없다. `--bare`를 안 쓰는
이유가 여기 있다: 매 호출이 cwd의 `DESIGN.md`/`CLAUDE.md`를 자동 재로딩하므로
**그 문서가 세션 연속성을 대신하는 공유 디자인 계약**이 된다. 큰 위임
goal일수록 `DESIGN.md`가 더 중요해진다.

## Open decisions (향후)

- **슬라이스-레벨 위임**: 현재는 whole-goal 위임만 구현. 혼합 goal에서
  presentation 슬라이스만 위임하는 경로는 미정.
- **claude-측 가드레일 강화**: `apps/app|www/CLAUDE.md`에 디자인 시스템
  제약·손대면 안 되는 경계를 더 두껍게 명시할지(현재는 커밋 컨벤션 +
  경계 최소분만).
- **읽기 전용 추가 디렉토리**: viewer가 `docs/06-api-contract.md` 등
  루트 문서를 읽어야 할 때 `--add-dir`을 마커로 허용할지(현재는 cwd만).
- **stall 시 자동 분해**: 현재는 blocker + 사람 에스컬레이션. codex가
  자동으로 sub-goal로 분해하는 경로는 게이트 의미 훼손 위험으로 보류.

## 참조

- `docs/claude/headless.md` — `claude -p` 플래그 레퍼런스.
- `docs/goal-design.md` — 하니스 설계, `## Delegation` 마커 계약.
- `guidelines/goal-iteration.md` — iteration 프로토콜, 위임 분기.
