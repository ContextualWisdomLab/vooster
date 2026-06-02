# Dogfood Loop 설계 노트

이 문서는 vspec **제품 자체**를 에이전트 관점에서 무한 반복 dogfooding 하는
하네스의 설계다. `docs/goal-design.md`의 build harness가 "스펙대로 제품을
짓는" 안쪽 루프라면, dogfood loop는 "지어진 제품을 ICP 에이전트처럼 써보고
마찰/품질 결함을 찾아 build harness에 새 goal로 먹이는" **바깥쪽 루프**다.

> **두 루프의 관계 한 줄 요약**: build loop는 `goals/` 스택을 green으로
> 만든다. dogfood loop는 제품을 실사용해 `goals/` 스택에 **새 goal을
> 만들어 넣는다**. 둘의 공통 실행기는 codex다. dogfood loop는 build
> 스택의 goal #N이 아니라 **독립된 codex goal**이다 (build 진행도와 무관하게
> 기동된다). 다만 자신이 뱉은 개선 goal은 기존 build harness가 구현한다.

## 왜 별도 루프인가

build harness의 gate는 **floor**(스펙대로 동작하는가)를 검증한다. dogfood
loop가 잡으려는 것은 gate로 표현되지 않는 **ceiling**이다:

- `vspec`을 처음 쓰는 에이전트가 `--help`를 몇 번이나 두드려야 첫 use case를
  만드는가 (iNtellectual load).
- 4xx 응답이 다음 행동을 가르치는가, 아니면 zod 내부 에러가 새는가 (Quality).
- 생성된 spec 문서가 Cockburn 충실도(stakeholder/interest/extension)를 갖추는가.
- API/CLI/web/local-sync의 어휘가 일치하는가 (drift = product bug).

이건 단위 테스트로 못 잡는다. **실제 에이전트 세션 전사(transcript)와 산출물
스펙 문서**를 증거로 봐야만 보인다. `.claude/skills/analyze-session`이 이미
이 분석을 사람이 호출하는 형태로 한다 — dogfood loop는 그걸 **자동 루프**로
승격시킨다.

## 한 cycle의 흐름

codex가 `scripts/dogfood/dogfood-cycle.sh`를 반복 호출한다. 한 번의 호출 =
한 cycle. 멱등/재진입 가능하게 설계한다 (`.state/dogfood/`의 phase를 보고
다음 단계를 수행).

```
dogfood-cycle.sh
├─ 0. PROVISION   로컬 vspec 빌드 → dogfood repo를 pristine baseline으로 reset
│                 → 로컬 빌드 link/install → API 스택 부팅 + 인증 시드
├─ 1. RUN         각 dogfood/cases/<id>.md 의 Task 프롬프트를 claude -p 로 실행
│                 (cwd = dogfood repo). 세션 jsonl + 생성된 spec 스냅샷을
│                 dogfood/runs/<cycle>/<id>/ 에 수집
├─ 2. ANALYZE     각 run 을 analyze-session 로직으로 분석 (헤드리스 claude -p,
│                 --json-schema 로 findings 구조 강제) → findings.json
├─ 3. TRIAGE      전 케이스 findings 집계. P0+P1 == 0 ?
│        ├─ yes → clean-pass 마커 기록, exit 0   ← 루프 종료 (codex goal 충족)
│        └─ no  → 계속
├─ 4. FINDINGS    P0/P1 클러스터마다 docs/findings/<ts>-dogfood-<slug>.md 작성
├─ 5. GOALIFY     findings → goal trio(.md/.gates.sh/.next-task.sh) 를 goals/ 에
│                 추가 (라우팅: presentation→claude-owned, 그 외→codex TDD)
└─ 6. exit 2 (work pending) → codex가 build loop를 ALL_DONE까지 돌린 뒤
              dogfood-cycle.sh 재호출 → 1번부터 반복
```

### 종료 조건 (step 3)

**한 full pass에서 P0+P1 finding이 0건이면 종료.** P2는 `docs/findings/`
debt 큐에 적재하되 루프를 계속 돌리지는 않는다. 추가로 무한 루프 방지용
hard cap (`VSPEC_DOGFOOD_MAX_CYCLES`, 누적 예산 `VSPEC_DOGFOOD_BUDGET_USD`)을
둔다 — 초과 시 blocker 기록 후 exit 3.

## 디렉토리 역할

```
dogfood/
  README.md
  cases/<DF-NNN>-<slug>.md        # ICP 플로우 테스트케이스 (claude -p 입력)
  rubric.md                        # 분석기가 채점하는 공통 품질 루브릭
  schema/findings.schema.json      # 분석기 structured-output 스키마
  runs/                            # gitignored — cycle별 산출물
    <cycle-ts>/<DF-NNN>/
    session.jsonl                  # 캡처된 에이전트 세션
    specs-snapshot/                # 생성된 spec 파일 스냅샷 (git diff + new files)
    result.json                    # cost, num_turns, duration, is_error
    findings.json                  # 분석기 출력
scripts/dogfood/                   # 구현됨 — 전부 VSPEC_DOGFOOD_DRY_RUN 지원
  _dogfood-lib.sh                  # 공유 헬퍼 (env, cycle/state, case 파싱, reset, ledger) + --self-test
  dogfood-init-repo.sh             # 별도 dogfood repo 스캐폴딩 (baseline 브랜치 생성)
  dogfood-serve-api.sh             # stub-enabled in-memory API 기동 (멱등; --restart/--stop)
  dogfood-seed-auth.sh             # stub OAuth로 세션 발급 → .vspec/config.json
  dogfood-cycle.sh                 # 오케스트레이터 (codex goal 엔트리포인트) + --self-test
  dogfood-provision.sh             # 빌드 + 글로벌 link + baseline ref 검증 + API 기동 + auth seed
  dogfood-run.sh                   # 케이스 1개 claude -p 실행 + 캡처
  dogfood-analyze.sh               # digest → 분석기 claude -p → findings.json
  dogfood-triage.sh                # 집계 + 종료 판정 + exit code
  dogfood-goalify.sh               # findings 문서화 + goal trio 작성 (adopt|draft)
.state/dogfood/                    # gitignored (.state/ 는 이미 .gitignore)
  cycle                            # 현재 cycle id + phase
  spawned-goals                    # 이번 cycle이 추가한 goal 목록 (build 대기)
  ledger.tsv                       # cycle별 cost/finding/pass 기록
dogfood/DOGFOOD-GOAL.md            # 이 루프의 codex goal 계약 (build 스택 밖)
```

`dogfood/runs/` 와 `.state/dogfood/` 는 git-ignore (`.state/` 는 기존에 이미
ignore; `dogfood/runs/` 는 신규로 추가). cycle 산출물은 휘발성 — 증거가 finding으로 승격되면
finding 문서가 영속 기록이다.

## dogfood 코드베이스 (별도 repo)

답변에 따라:

1. **별도 git repo**. 이 모노레포 **밖**에 있어야 한다 (gate-cache/`.state`
   오염 방지, 그리고 vspec이 보는 working tree가 모노레포가 아니어야 ICP
   상황을 재현). 경로는 `VSPEC_DOGFOOD_REPO` env로 주입.
2. **per-case clean reset**. 케이스마다 baseline이 다르므로(`empty` /
   `seeded-small` / `seeded-rough`), reset은 cycle 단위가 아니라 **케이스
   단위**로 `dogfood-run.sh`가 수행한다. 컨벤션: 케이스 `baseline: X` →
   git ref `baseline/X`. reset =
   `git reset --hard baseline/X && git clean -fd -e .vspec -e node_modules`
   (글로벌 링크된 CLI와 시드된 `.vspec` 인증은 보존). baseline ref들은
   `scripts/dogfood/dogfood-init-repo.sh`가 만든다.
3. **로컬 빌드 link (글로벌)**. PROVISION이 `pnpm -r build` 후 로컬 CLI를
   **글로벌로** 설치한다 — repo의 `node_modules`에 넣으면 per-case
   `git clean`에 지워지기 때문. 두 방식:
   - `npm install -g <pack tarball>` — distribution 경로까지 검증 (권장 기본).
     analyze-session friction signal 중 "binary/setup confusion"을 잡으려면
     이 경로가 정직하다.
   - `pnpm link --global` — 빠름. `VSPEC_DOGFOOD_LINK=link` 로 선택.

### 프로비저닝 전제: 풀 스택 부팅

vspec은 REST API를 가진 SaaS다. dogfood repo의 CLI가 `--api-url`로 가리킬
**실행 중인 API + 인증 컨텍스트**가 있어야 한다. PROVISION은:

- 로컬 API를 부팅하되 **`VSPEC_AUTH_STUB=1`** 로 띄운다 (`apps/api/src/index.ts`가
  이 env를 읽어 OAuth stub을 켠다). 또는 stub이 켜진 전용 staging URL.
- 인증을 시드한다. GitHub OAuth device flow는 헤드리스에서 막히므로,
  `scripts/dogfood/dogfood-seed-auth.sh`가 stub을 이용한다: stub은 OAuth
  `code`를 그대로 GitHub 신원으로 취급하므로(`signup-support.ts`의
  `githubId: code`), 유니크한 code로 `/v1/auth/github/start` →
  `/v1/auth/github/callback`을 호출해 `vspec_session`을 받아 dogfood repo의
  `.vspec/config.json`(`{api_url, session_token}` — CLI가 실제로 읽는 형식,
  `config-store.ts`)에 기록한다.
- PROVISION은 `VSPEC_DOGFOOD_API_URL`만 있으면 이 seed를 자동 호출한다
  (직접 토큰을 줄 거면 `VSPEC_DOGFOOD_SESSION_COOKIE`, API 부팅까지
  커스텀하려면 `VSPEC_DOGFOOD_PROVISION_HOOK`).
- claude가 받는 dogfood repo에는 **얇은 CLAUDE.md만** 둔다 ("이 repo에는
  vspec이 설치돼 있다. spec 관리는 vspec으로 한다") — 상세 사용법은 넣지
  않는다. 발견가능성/`ai-guide` 품질을 테스트해야 하기 때문.

## 테스트케이스 (ICP 플로우)

한 케이스 = ICP가 vspec을 쓰며 겪는 **에이전트 작업 프롬프트** 하나. claude는
vspec CLI를 도구로 써서 작업을 수행하고, 우리는 그 세션 + 산출물을 평가한다.

케이스는 `dogfood/cases/<DF-NNN>-<slug>.md`. frontmatter + Task 프롬프트 +
성공 기준 + 주시할 품질 차원. 초기 세트(6종)는 ICP가 제품 수명주기에서
겪는 순서를 따른다:

| ID     | 플로우               | 무엇을 노출시키나                                             |
| ------ | -------------------- | ------------------------------------------------------------- |
| DF-001 | greenfield init      | 첫 설치/`init`/첫 use case 작성의 cold-start 마찰             |
| DF-002 | add feature spec     | 기존 spec set에 새 use case 추가, 어휘/구조 일관성            |
| DF-003 | refine use case      | extension/error flow 추가, step 편집, 재sync                  |
| DF-004 | multi-UC scenario    | actor/scenario 교차 작성, Cockburn 충실도                     |
| DF-005 | doctor → fix loop    | doctor 진단의 정확도·언어 인지·복구 가능성                    |
| DF-006 | cold-start discovery | 지시 없이 `ai-guide`/help만으로 워크플로 발견 (self-teaching) |

케이스는 시간이 지나며 늘린다 — analyze-session이 실제 외부 세션에서 잡은
마찰 패턴을 새 케이스로 역류시킨다.

## 분석 (step 2) — analyze-session의 자동화

`.claude/skills/analyze-session`의 로직을 헤드리스로 돌린다:

1. `extract.sh <session.jsonl>` 로 digest 생성 (raw jsonl 직접 안 읽음).
2. `claude -p` 분석기 호출: digest + `dogfood/rubric.md` + 제품 원칙을
   입력하고 `--json-schema dogfood/schema/findings.schema.json` 으로 출력을
   강제 → 기계가독 findings 배열.
3. 각 finding: `{case_id, title, severity, quants[], evidence, root_cause_area,
recommendation, routing}`.

분석기는 analyze-session SKILL의 §3 friction catalog / §4 QUANTS / §5 finding
형식을 system prompt로 받는다 (skill 본문을 그대로 인라인).

## Goalify (step 5) — 가장 섬세한 단계

finding을 goal trio로 바꾸는 것은 자동화의 위험 지점이다. gate는
`docs/goal-design.md` §1(universal claim ↔ enumeration)과 §1.5(gate가 하지
말아야 할 것) 규칙을 지켜야 한다. 따라서:

- `dogfood-goalify.sh`는 `claude -p`로 goal trio를 **초안 작성**시키되,
  goal-design.md의 작성 규칙 + 기존 minimal goal 예시를 system prompt로 준다.
- 초안을 받은 뒤 **기존 메타 체크로 게이트한다**:
  `scripts/check-gate-rigor.sh`가 통과해야 goal이 채택된다. 실패 시 재시도.
- 라우팅(답변 5 = 기존 규칙):
  - root_cause_area가 `apps/app`/`apps/www` (presentation) → goal `.md`에
    `## Delegation`(owner: claude) 마커를 넣어 claude-owned로.
  - 그 외(api/cli/contracts/docs) → 일반 codex TDD goal.
- 새 goal 번호 = 현재 최대 + 1. 다음 `completion-check.sh`가 active로 잡는다.

## build loop와의 핸드오프

dogfood loop는 codex TDD를 **직접 수행할 수 없다** (TDD는 build loop의
codex 자신이 하는 일). 그래서 모델은 **alternation**이다:

- dogfood-cycle.sh가 goal을 spawn하면 `.state/dogfood/spawned-goals`에 기록하고
  `exit 2` (work pending).
- codex 오케스트레이션이 build loop를 `ALL_DONE`까지 돌린다 (기존 메커니즘 그대로).
- ALL_DONE이 되면 codex가 dogfood-cycle.sh를 재호출 → 같은 케이스를 **개선된
  제품**에 대해 다시 RUN.

independence(답변 3=b)는 "dogfood loop가 build 스택의 goal #N이 아니라 별도
codex goal"이라는 의미로 보존된다. 실제 building은 codex 공통 실행기가 한다.

### codex goal 계약

dogfood loop의 codex goal은 `dogfood/DOGFOOD-GOAL.md`로 표현한다 (build
스택 밖이라 `goals/`에 두지 않음). 엔트리포인트 = `dogfood-cycle.sh`. exit code:

| code | 의미                                            | codex 행동                |
| ---- | ----------------------------------------------- | ------------------------- |
| 0    | clean pass (P0/P1 == 0)                         | 루프 종료                 |
| 2    | findings 작성 + goal spawn, build 대기          | build loop 돌린 뒤 재호출 |
| 1    | hard error (provision 실패, claude is_error 등) | 중단 + blocker            |
| 3    | 예산/cycle cap 초과                             | blocker 기록 후 중단      |

## 예산/제어 env (delegate-to-claude 네이밍 미러)

| env                             | 기본값   | 역할                                   |
| ------------------------------- | -------- | -------------------------------------- |
| `VSPEC_DOGFOOD_REPO`            | (필수)   | dogfood 코드베이스 경로                |
| `VSPEC_DOGFOOD_LINK`            | `pack`   | `pack`(tarball) \| `link`(pnpm link)   |
| `VSPEC_DOGFOOD_CASE_BUDGET_USD` | `2.00`   | 케이스당 claude -p `--max-budget-usd`  |
| `VSPEC_DOGFOOD_BUDGET_USD`      | `20.00`  | cycle 누적 cap (run + analyze 포함)    |
| `VSPEC_DOGFOOD_MAX_CYCLES`      | `10`     | 무한 루프 hard cap                     |
| `VSPEC_DOGFOOD_MODEL`           | `opus`   | run/analyze 모델                       |
| `VSPEC_DOGFOOD_DRY_RUN`         | (unset)  | provision+compose만, claude 호출 안 함 |
| `VSPEC_DOGFOOD_CASES`           | (전체)   | 쉼표구분 케이스 id 필터                |
| `VSPEC_DOGFOOD_API_URL`         | (필수\*) | stub-enabled vspec API URL (seed 자동) |
| `VSPEC_DOGFOOD_SESSION_COOKIE`  | (옵션)   | 직접 줄 세션 토큰 (없으면 seed가 발급) |
| `VSPEC_DOGFOOD_PROVISION_HOOK`  | (옵션)   | API 부팅+인증 커스텀 (위 둘 대체)      |
| `VSPEC_DOGFOOD_GOALIFY`         | `adopt`  | `adopt`(goals/ 직접) \| `draft`(초안)  |

## 스크립트 (구현됨)

전부 `scripts/dogfood/` 아래 있고 `VSPEC_DOGFOOD_DRY_RUN=1`을 지원한다 —
별도 repo / claude 호출 / API 없이도 배선을 끝까지 검증할 수 있다.
`bash scripts/dogfood/dogfood-cycle.sh --self-test`가 dry-run으로 전체
파이프라인(provision → run → analyze → triage)을 한 바퀴 돌린다.

아래는 핵심 흐름의 골격이다 (실제 구현은 위 파일들 참조).

### dogfood-cycle.sh (오케스트레이터)

```bash
#!/usr/bin/env bash
# 한 dogfood cycle. 멱등/재진입. exit: 0=clean, 2=work pending, 1=err, 3=cap.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
source scripts/dogfood/_dogfood-lib.sh   # env 파싱, cycle id, ledger 헬퍼

cycle_guard_or_exit3          # MAX_CYCLES / BUDGET 초과 검사
bash scripts/dogfood/dogfood-provision.sh || exit 1

CYCLE=$(new_cycle_id)
for case in $(select_cases); do
  bash scripts/dogfood/dogfood-run.sh "$CYCLE" "$case"     || exit 1
  bash scripts/dogfood/dogfood-analyze.sh "$CYCLE" "$case" || exit 1
done

bash scripts/dogfood/dogfood-triage.sh "$CYCLE"
case $? in
  0) record_clean_pass "$CYCLE"; exit 0 ;;   # P0/P1 == 0
  10) ;;                                      # findings 있음 → 계속
  *) exit 1 ;;
esac

# FINDINGS + GOALIFY
write_findings_docs "$CYCLE"
bash scripts/dogfood/dogfood-goalify.sh "$CYCLE" || exit 1
record_spawned_goals "$CYCLE"
exit 2     # work pending — codex가 build loop 후 재호출
```

### dogfood-run.sh (케이스 1개 실행)

```bash
# claude -p 로 케이스 실행, 세션/스냅샷 캡처
RUN_DIR="dogfood/runs/$CYCLE/$CASE"; mkdir -p "$RUN_DIR"
PROMPT=$(case_task_prompt "dogfood/cases/$CASE".*.md)
out=$(cd "$VSPEC_DOGFOOD_REPO" && claude --dangerously-skip-permissions \
        --model "$VSPEC_DOGFOOD_MODEL" --output-format json \
        --max-budget-usd "$VSPEC_DOGFOOD_CASE_BUDGET_USD" -p "$PROMPT")
echo "$out" | jq '{total_cost_usd,num_turns,duration_ms,is_error,session_id}' \
        > "$RUN_DIR/result.json"
sid=$(echo "$out" | jq -r .session_id)
cp "$(locate_session_jsonl "$VSPEC_DOGFOOD_REPO" "$sid")" "$RUN_DIR/session.jsonl"
snapshot_specs "$VSPEC_DOGFOOD_REPO" "$RUN_DIR/specs-snapshot"   # git diff + new files
```

### dogfood-analyze.sh / dogfood-triage.sh / dogfood-goalify.sh

- **analyze**: `extract.sh session.jsonl` → digest → `claude -p --json-schema
findings.schema.json` (system prompt = analyze-session SKILL 본문 + rubric) →
  `findings.json`.
- **triage**: 전 케이스 `findings.json` 병합 → P0+P1 카운트. 0이면 exit 0,
  아니면 exit 10. 누적 cost를 ledger에 기록하고 BUDGET 초과 시 exit 3.
- **goalify**: P0/P1 클러스터별 `claude -p`로 goal trio 초안 →
  `check-gate-rigor.sh` 통과할 때까지 (≤N회) → `goals/` 에 기록.

## 미해결/후속 결정 (열려 있음)

- **PROVISION의 API 부팅 구체화**: 로컬 Postgres + Fastify를 매 cycle 띄울지,
  장수하는 전용 staging을 쓸지. 인증 시드 방식(테스트 세션 쿠키 발급 경로)이
  제품에 없으면 그 자체가 첫 finding이 될 수 있다.
- **goalify 자동화 신뢰도**: 초안 goal의 gate가 rigor는 통과해도 의미가
  엉성할 수 있다. 초기엔 goalify를 "finding + goal **초안**까지만, 사람/별도
  리뷰가 채택" 으로 보수적으로 운영하고, 신뢰가 쌓이면 자동 채택으로 승격.
- **seeded baseline 채우기**: `dogfood-init-repo.sh`가 `baseline/empty`는
  완성하지만 `baseline/seeded-small`/`seeded-rough`는 placeholder로 만든다.
  실제 spec 형식대로 vspec을 한 번 돌려 채운 뒤 해당 브랜치에 recommit해야
  DF-002~005가 진짜 시드 상태에서 시작한다.

```

```
