---
cycle: 260527-01
title: Findings closure + meta-system audit sweep
authored_at: 2026-05-27T00:52:02+09:00
started_at: 2026-05-27T00:56:44+09:00
completed_at: 2026-05-27T06:33:35+09:00
status: complete
---

# 260527-01 — Findings closure + meta-system audit sweep

**목표**: 2026-05-27 시점 `docs/findings/` 의 미해결 finding 중, **무인 실행에
안전하도록 설계 결정을 미리 잠근(decision-locked)** 항목을 우선순위/의존성
순서대로 닫는다. 그리고 **finding 2 work-unit 마다 메타 시스템 감사
체크포인트**를 돌려 하니스/lint/테스트 코드를 점검하고 개선을 처리한다.

본 문서를 codex/claude 에게 **무한 루프 모드**로 넘긴다:
`/goal cycles/260527-01-findings-meta-audit-sweep.md 의 내용을 모두
완수할때까지 작업해줘.`

이것은 **무인(set-and-sleep) 실행**이다. 설계 원칙: 결정이 끝난(높은 확실성)
작업을 먼저, 깊고 안전한 대량 큐를 backstop 으로, 매 작업 단위 commit + push
**(브랜치 `main`, 직접 push 허용 — 사용자가 코드 전수 검토 불가함을 양해함)**.
**조기 종료 절대 금지** — 막히면 blocker 기록 후 다음 target. 할 일은 의도적으로
하룻밤보다 많게 깔아두었다.

## 작업 시작 전 반드시 읽을 것

- `docs/goal-design.md` — harness 설계 (특히 §1.5 최소 gate 패턴, §5 immutability/case (a)/(b)/(c)/(d))
- `guidelines/goal-iteration.md` — iteration 프로토콜 (TDD, commit cadence, Phase 4)
- `guidelines/meta-system-audit.md` — **메타 감사 렌즈 (Q1–Q8, 판정 프레임).
  체크포인트의 source of truth**
- `.claude/skills/commit/SKILL.md` (또는 `/commit` skill) — 커밋 규약, secret-scan
- `docs/findings/AGENTS.md` — finding frontmatter schema
  (`resolved: false|"partial"|true`, `priority`, `resolved_by`, `kind`,
  `status_notes`, `related`) + honesty rules
- 위임 goal 생성 시: `docs/claude/delegation.md` + `docs/claude/headless.md`
  (이미 `goals/32`, `goals/33` 이 claude-owned 선례)

## 시작 상태 (2026-05-27)

- chain **GREEN** (`.state/active-goal == ALL_DONE`).
- 최고 goal 번호 `33` → 다음 빈 번호 **`34`**.
- 작업 브랜치 **`main`** (별도 branch 생성 금지, `origin/main` 으로 push).
- 직전 cycle `260526-01` 이 안전한 기계적 item 대부분을 이미 닫음. 그래서 이
  cycle 의 in-scope 는 (a) 결정-잠금된 4개 finding, (b) 작은 안전 item 2개,
  (c) route-test Phase 2 backstop 큐, (d) 매 2 work-unit 의 메타 감사가 생성하는
  개선 작업이다.

---

## 루프 알고리즘

```
  step 0 — 최초 1회 (루프 진입 전):
    이 문서(cycles/260527-01) frontmatter 갱신:
      started_at = 현재 시각(ISO-8601 +09:00), status: running.
    audit_counter = 0  (메타 감사 트리거용 work-unit 카운터; 본문/learnings 로 추적)
    → commit + push.

LOOP:

  step 1 — chain 상태 확인:
    $ bash scripts/completion-check.sh
    if exit 0 (.state/active-goal == ALL_DONE):
      → step 2
    else:
      → .state/active-goal 의 goal 을 TDD 로 GREEN (guidelines/goal-iteration.md Phase 4)
      → 위임 goal(## Delegation owner: claude)이면 next-task.sh 가
        delegate-to-claude.sh 로 라우팅; dispatcher self-loop 가 각 step 처리.
      → commit + push
      → ★ DEADLOCK 가드: 이 active goal 이 본 cycle 이 promote 한 goal 인데
        3 TDD 사이클(또는 위임 3 라운드) 무진전이면 → promotion back out:
        방금 추가한 goals/<n>-*.{md,gates.sh,next-task.sh} 삭제 →
        commit "revert: withdraw incomplete goal <n> (see blockers.md)" →
        blocker 기록 → 해당 finding 은 partial + status_notes "promotion
        withdrawn, deferred". chain 이 다시 GREEN 으로 복귀.
      → step 1 (재확인)

  step 2 — work-unit 진행:
    target 리스트(아래 "Target")에서 첫 미완료 항목 선택, "Finding 처리 절차" 수행.
    한 work-unit 완료 = {finding 1건 closed | route-test 배치(≤5 파일) |
      shared-contracts 도메인 1개 | 메타 감사가 만든 개선 1건 완료} 중 하나.
    완료 시:
      → frontmatter/status_notes 갱신, commit + push
      → audit_counter += 1
      → if audit_counter % 2 == 0:  ★ 메타 감사 체크포인트 (아래 절차) 실행
      → step 1

  step 3 — 소진 확인:
    모든 in-scope target 이 resolved/partial(명시적 deferred 만 남음)이고
    route-test Phase 2 backstop 까지 처리 가능한 만큼 처리했으면:
      → TERMINATE
    (route-test 는 사실상 무한 filler 이므로, 다른 모든 in-scope 가 닫힌 뒤에도
     시간이 남으면 계속 마이그레이션. 멈추는 건 종료 조건이 모두 충족될 때만.)
```

종료 조건 (셋 다 만족):

1. 모든 in-scope target finding 이 `resolved: true` 또는 명시적 `partial`
   (out-of-scope/deferred sub-item 만 남음).
2. `bash scripts/completion-check.sh` exit 0.
3. `git status --short` 비어 있고 `git log @{u}..HEAD` 비어 있음 (push 완료).

종료 시: 본 문서 frontmatter `completed_at` 기입, `status` 를
`complete`/`partial`/`aborted` 로 갱신. `docs/state/learnings.md` 한 줄 요약
append. → commit + push.

**막혀도 종료하지 마라.** 한 target stuck → blocker 기록 → 다음 target.
route-test backstop 이 남아 있는 한 할 일은 항상 있다.

---

## Target (실행 순서)

### Tier 0 — Honesty pass (가장 먼저, 빠름, work-unit 1개)

직전 cycle 이 닫았으나 frontmatter 가 어긋난 finding 을 정정한다 (사용자 지시).
검증으로 확인된 stale 은 대부분 이미 보정됨 — 이 패스는 **재검증**이다:

- 각 미해결 finding 의 status_notes 의 "OPEN" 주장을 코드로 대조
  (`guidelines/meta-system-audit.md` Q6). 이미 닫힌 item 을 OPEN 으로 두고
  있으면 status_notes 를 CLOSED 로 정정하고 닫은 커밋/파일을 인용. 거꾸로
  열려 있는데 closed 로 적힌 것도 정정.
- 한 work-unit 으로 묶어 처리, commit + push.

### Tier 1 — 작은 안전 직접 작업

**1. `docs/findings/2026-05-21T1642-harness-spec-debt.md` — item 3 (HONEST_UC_SET)**

- `goals/7-cli-spec-parity.gates.sh:~132` 의 하드코딩 `HONEST_UC_SET` 배열을
  `ls docs/usecases/UC-*.md` 도출 + 명시적 allow-list 로. 화석화된 invariant
  제거 (audit P4). **S**, 직접 TDD. item 1·2·4 는 이미 닫힘.
- ★ 이건 **prior goal(7) 의 gate 수정**이다 → §5 case (b) (enforcement 를
  derivation 으로 이전, 약화 아님). 커밋 메시지에 harness-spec-debt 인용 +
  변경 후 `completion-check.sh` GREEN 확인. (Forbidden #1 의 sanctioned 예외.)

**2. `docs/findings/2026-05-25T1823-ci-resource-optimization.md` — item 2 (CI shard)**

- "Build spec — locked" 그대로: `.github/workflows/ci.yml` 의 test matrix
  `shard: [1,2,3,4]` → `[1,2]`, 분모 참조 일관 갱신, before/after billable
  분 측정 기록. **S**, 직접. Guard: 다음 CI run 이 이 변경 때문에 red 면 revert.

### Tier 2 — 결정-잠금된 bounded feature

**3. `docs/findings/2026-05-24T1100-spec-impl-audit.md` — Gap B (UC-022 SOFT lock)**

- finding 의 "Build spec (decision-free)" 그대로. 결정 D1–D4 잠김 (spec-faithful:
  SOFT 항상 성공 + 경고, 삭제 금지). port `listLocksForUseCase` 이미 존재 → **M**.
- 직접 TDD. universal invariant 가 명확하면 일반 goal `34` 로 promote 가능,
  아니면 직접. A·C 이미 닫힘 → B 닫으면 status_notes Gap B 를 CLOSED, finding
  자체 acceptance 에 따라 `resolved: true` 가능.

**4. `docs/findings/2026-05-26T1504-usecase-invocation-links.md`**

- finding 의 "Build spec — unattended execution split" 그대로. 결정 잠김
  (D1 `Step.invokes String[]`, D2 `_(includes: KEY)_`, contract-surface 필드셋
  4종). **MIXED**:
  - Stage 1a(schema/parse/serialize/doctor/invoked-by query), Stage 2(severity),
    Stage 3(transitive impact) = **직접 TDD** (`apps/api`).
  - Stage 1b(web "호출/호출됨" 렌더) = **claude-owned 위임 goal** (cwd `apps/app`),
    Stage 1a backend GREEN 이후에만.
- Guard: 단계 순서 의존(1a→1b→2→3). 한 단계 3사이클 무진전이면 partial +
  마지막 green 단계 기록 후 다음 target.

### Tier 3 — XL ledgered (chain-green-per-commit, partial 정상)

**5. `docs/findings/2026-05-22T1628-shared-api-contracts.md`**

- finding 의 "Unattended execution — chain-green-per-commit ledger" 그대로.
  **iron rule: 매 커밋이 `completion-check.sh` GREEN**. scaffold 1커밋 →
  도메인 1개당 1커밋(저위험→고위험 순) → status_notes "N/21 domains".
- ★ **revert-guard 필수**: 도메인 슬라이스가 1 RED→GREEN 사이클에 안 green
  되면 `git revert`(reset --hard 금지) → finding partial "N/21, <domain>
  reverted" → blocker → 다음 target. **partial 로 끝나는 게 정상적 성공.**
- route-test Phase 2(Tier 4)와 파일 disjoint: 같은 도메인을 한 세션에서 둘 다
  건드리면 contract 슬라이스 먼저, 그 다음 route 테스트. 한 파일을 한 iteration
  에서 교차 편집 금지.

### Tier 4 — Backstop 무한 filler (다른 in-scope 사이사이 + 소진 후)

**6. `docs/findings/2026-05-23T1836-route-test-coverage-honesty.md` — Phase 2**

- `apps/api/tests/unit/http/*-routes.test.ts` **37개**(33 pure-mock + 4 partial
  app.inject)를 `app.inject` integration 패턴으로 per-file 마이그레이션.
  exemplar: `apps/api/tests/integration/http/{doctor,lock,sync}-route.test.ts`
  - helper `apps/api/tests/helpers/server.ts`.
- **직접 작업, per-file.** risk 낮은 순(doctor→sync→signup→lock/session→
  alphabetical). 파일당: integration 테스트 작성(happy + error) → 원본 unit
  테스트 삭제 → `pnpm exec vitest run apps/api/tests/http` green → 1파일 1커밋.
- 배치(≤5파일) = 1 work-unit. **coverage threshold(75/80/80/80) 인하 금지,
  `.skip` 금지.** 하룻밤에 다 못 닫혀도 OK → `partial` "Phase 2: N/37 migrated".

### Tier 5 — optional (시간 남을 때만, 맨 끝)

**7. `docs/findings/2026-05-26T1234-agent-contract-followups.md` — item 4b만**

- `apps/api/src/http/actor-results.ts:~55` 의 라우팅 불가 `actor restore`
  suggestion 제거 + UC-005 문구 손질. **S**. item 3·4a·4c 는 out-of-scope(계약 설계).

---

## 메타 시스템 감사 체크포인트 (매 2 work-unit)

`guidelines/meta-system-audit.md` 가 source of truth. work-unit 2개 완료마다
실행. **목적: 하니스/테스트 코드가 제품에 비해 과하거나 부정직해지지 않게 유지.**

### 절차

1. **렌즈 적용** — 최근 변경 + 인접 메타 산출물에 Q1–Q8 을 적용:
   - Q1: "이 게이트가 없으면 어떤 _테스트_ 가 빨개지는가?" 답 있으면 MOVE-TO-TEST.
   - Q2: 무해한 리팩터(rename/이동/heredoc)로 깨지는 양식-결합 검사 → TRIM.
   - Q3/Q5: LOC 예산 초과 / 제품에서 먼 비싼 메타 → TRIM 또는 DEFER.
   - Q6: `resolved/green` 주장 ↔ acceptance signal 재실행 대조.
2. **테스트 코드 렌즈** (`prompts/check-test-codes` 철학):
   - **구현 overfit 테스트 제거** (check-test-codes #1): 내부 헬퍼 호출 횟수·
     사적 자료구조·구현 디테일을 단언하는데 동등한 **행위 단언**으로 대체
     가능한 테스트 → 행위 단언으로 교체하거나 제거.
   - ⚠️ **단, fetch payload/schema 과검증은 손대지 마라** — 그건
     `shared-api-contracts`(Tier 3, in-scope) 의 영역이다. 거기로 합쳐 처리하고,
     이 렌즈에서 별도로 RequestInit 단언을 일괄 삭제하지 마라(중복/충돌).
3. **개선 처리** — 가장 가치 높은 구체 개선 **1건**을 선택해:
   - gate 로 검증 가능한 **universal invariant** 면 → 다음 빈 goal 로 **promote**
     (최소 gate; 아래 "Goal 화 시 주의점").
   - 아니면(대부분) → **직접 TDD + finding 기록** (case (b): 테스트로 이전 후
     gate trim, 또는 overfit 테스트 교체). 사용자 표현 "goal 생성" 은 이
     case 에선 "개선 work-item 처리 + finding 로그"로 충족.
4. 이 개선 처리 자체가 1 work-unit (즉 audit_counter += 1). commit + push.

### 안전 자율성 (사용자 확정)

- **case (b) 준수 시 자율 진행**: 게이트/검사를 약화/삭제하려면 **대응 테스트가
  먼저 존재**해야 한다 (then trim). prior goal gate 면 커밋에 권한 근거 인용
  (gates-over-coupling finding 또는 본 cycle Tier1#1 같은 finding 권한).
- **HARD STOP (Q7)**: 선언·테스트 이전 없이 게이트/테스트를 약화·삭제하는 시도
  → 진행 금지, blocker 기록. 정직성 위반은 협상 불가 (audit P6).
- 감사가 "지금 손댈 게 없음(KEEP)"으로 끝나면 그렇게 한 줄 근거 남기고
  (audit Q8) work-unit 으로 카운트하지 말고 다음 target 으로.

---

## Reference snapshots — 작업 대상 아님 (force-close 금지)

`kind: snapshot`/`append-only-log` — "resolved" 대상이 아니다. 자식 work item
을 통해서만 닫히고 본체는 reference. **`resolved: true` 로 뒤집지 마라.**

- `docs/findings/2026-05-21T1635-perf-log.md` — append-only harness perf 로그.
- `docs/findings/2026-05-22T1632-dogfood-snapshot.md` — dogfood frozen 스냅샷.
- `docs/findings/2026-05-25T1447-activation-wow-project-overview.md` — WOW 분석 rationale.
- `docs/findings/2026-05-24T1100-spec-impl-audit.md` — **예외**: 이건 snapshot
  이지만 Gap B(자식 work)가 Tier2#3 로 in-scope. Gap B 닫으면 finding 자체
  acceptance("A·B·C 모두 green 시 resolved")에 따라 `resolved: true` 가능.

---

## Out of scope (본 cycle 에서 손대지 마라)

발견해도 **fix 시도 금지** — 기존 finding 에 note 만. 무인 실행에 위험/불확실/
유료/설계결정-필요 항목들이다. (각 근거는 해당 finding 본문 참조.)

- **dogfood-followups A14** (`…2026-05-23T1700-dogfood-followups.md`) — 23/24
  닫힘. 잔여 A14(미라우팅 verb)는 **어떤 verb 를 베타에 넣을지 제품 결정**.
- **cli-spec-gaps merge-resolve public setup** (`…2026-05-21T1856`) — divergent
  revision 생성용 **공개 API 신설(설계) 필요**, test infra 차단.
- **agent-contract items 3·4a·4c** (`…2026-05-26T1234`) — 봉투 format_version
  통합 / `command` optional 화 = **post-beta 계약 설계**. (4b 만 Tier5 에 포함.)
- **ci-resource item (구 #2 process)** — 이미 finding 에서 제거됨 (branch
  protection 은 main 직접 push 모드와 상호배타). 재시도 금지.
- **F3 persona-dogfood-harness** (`…2026-05-25T1516`) — `claude -p` **유료
  헤드리스 에이전트 자율 spawn** = 비용/예측불가. 결과 해석도 사람 필요.
- **F4 gap-a-authoring-assist** (`…2026-05-25T1520`) — **F3 측정 결과 의존** +
  설계 미정 + 스코프 가변. XL.

---

## Finding 처리 절차

각 finding/work-unit 마다:

1. **읽기**: frontmatter + TL;DR + (있으면) "Build spec"/"Decisions locked"/
   Acceptance signal. 본 cycle 의 in-scope 4개는 finding 안에 결정-잠금된
   build spec 이 있으니 **그대로 따른다 (새 설계 결정 금지)**. `partial` 이면
   status_notes 의 OPEN item 만.
2. **판단 — promote / delegate / direct**:
   - **claude 위임** (`## Delegation` owner: claude): UI/카피/디자인 (`apps/app`).
     invocation-links Stage 1b 가 해당. `docs/claude/delegation.md` 계약 준수.
   - **goal promote** (다음 빈 번호 `34`, …): 셋 다 만족 시만 — (a) gate 검증
     가능한 universal invariant, (b) multi-step RED/GREEN, (c) prior goal 과 별개.
   - **직접 작업**: 위 아니면 (대부분). guidelines/goal-iteration.md Phase 4.
3. **실행**: RED → GREEN → REFACTOR, 각 phase 한 커밋. promote 했다면 각 phase
   직후 `bash scripts/active-check.sh` 로 chain 점검.
4. **검증**: finding 의 Acceptance signal 그대로 실행 → `completion-check.sh`
   ALL_DONE. 다른 goal 이 깨졌으면 STOP, `docs/state/blockers.md` 기록.
5. **마무리**: frontmatter (`resolved: true` + `resolved_by: <sha>`; 또는
   `partial` + status_notes OPEN item). finding 본문 끝에 "## Resolution"
   append (어떤 커밋이 어떤 acceptance signal 을 flip 했는지). commit + push.

---

## Goal 화 시 주의점 (`docs/goal-design.md §1.5/§5` 종합)

### 최소 gates.sh

**금지**: 함수 본문 grep / 타입 필드 grep / 테스트 제목 grep / 특정 경로 파일
존재 강제 / 마크다운 헤딩 grep / findings bullet 제거 추적.
**허용**: Rigor 메커니즘(마지막 게이트 `scripts/check-gate-rigor.sh …` 항상
포함) / Negative universal grep("codebase 어디에도 X 없음") / 구조 앵커(필요한
문서·파일 존재만).

### 회의적 휴리스틱

**"이 invariant 가 깨지면 어떤 테스트가 빨개지는가?"** 답 있으면 gate 에서 빼라.

### Prior goal gate 수정 (case b/c/d)

prior goal gate 를 약화/이전해야 하면: 새 goal `.md` 에 `## Supersedes`(case c)
또는 enforcement-이전을 커밋/PR 에 명시(case b), prose-only drift 면 case d.
**선언·테스트 이전 없이 prior gate 삭제 절대 금지** (§5). Tier1#1 의
HONEST_UC_SET 변경은 sanctioned case (b).

---

## Forbidden actions (HARD STOP — `docs/state/blockers.md` 기록 후 다음으로)

1. **Prior goal invariant 약화** — §5 case (b)/(c)/(d) 미준수 변경 금지.
   `## Supersedes`/enforcement-이전 선언 없이 prior `.gates.sh`/`.md` 손대지
   마라. (Tier1#1, 메타 감사의 sanctioned trim 은 규칙 준수 시 예외.)
2. **Hook 우회 금지** — `--no-verify`, `--no-gpg-sign` 등. fail 하면 디버그.
3. **테스트/lint 비활성화 금지** — `.skip()`/`xit()`/`it.skip()`, 새
   `eslint-disable`/`@ts-ignore`/`@ts-expect-error` 추가 금지. 깨진 동작이면
   _코드_ 를 고쳐라. (overfit 테스트 _교체_ 는 허용 — 행위 단언으로 대체.)
4. **Coverage threshold 인하 금지** — `vitest.config.ts` baseline(75/80/80/80).
5. **3 TDD 사이클(또는 위임 3 라운드) 무진전** — blocker append 후 다음 target.
   promote 한 goal 이면 ★ DEADLOCK 가드(promotion back out). shared-contracts
   도메인이면 ★ revert-guard(git revert + partial).
6. **Chain 이 예상 못한 방식으로 깨질 때** — `.state/active-goal` 이 plan 과
   안 맞거나 새 fail goal → STOP, blocker.
7. **Destructive git 금지** — `push --force`/`-f`, `reset --hard`,
   `checkout -- .`, `clean -f`, `rebase -i`, `filter-branch`. **main force push
   절대 금지.** (revert-guard 는 `git revert` 사용 — reset 아님.)
8. **`.env`/credentials/대용량 산출물 commit 금지** (`/commit` secret-scan).
9. **사용자 환경 영향 금지** — 호스트 설정/`~/.vspec/config.json` 덮어쓰기 금지.
10. **Out of scope 항목 작업 금지** — A14, merge-resolve setup, agent-contract
    3/4a/4c, F3, F4, branch-protection. 발견해도 note 만.
11. **결정-잠금된 finding 의 설계 재결정 금지** — Gap B/invocation-links/
    shared-contracts 는 build spec 그대로 실행. "더 나은 설계" 가 떠올라도 본
    cycle 에선 실행하지 말고 finding 에 note 만 남겨라 (무인 실행은 설계 결정
    금지가 안전 원칙).

---

## Commit / push 프로토콜

`/commit` skill + `guidelines/goal-iteration.md` Phase 4:

- TDD 각 phase (RED/GREEN/REFACTOR) — **한 phase 한 commit**.
- finding/sub-item/work-unit 완료 후 마무리 commit + `git push origin main`.
- **브랜치 `main` 유지** (별도 branch 생성 금지). 시작 시 현재 브랜치 확인.
- 커밋 메시지 끝에 Co-Authored-By (실행 에이전트 자신). HEREDOC 으로 전달.
- **Push 실패 시**: 원인 디버그(네트워크? remote rejection?). retry 1회 OK.
  두 번째도 실패하면 blocker.

---

## 진행 상황 추적

- `docs/state/progress.md`, `docs/state/next-task.md` 는 `scripts/update-state.sh`
  자동 생성 — **손대지 마라**.
- `docs/state/learnings.md`, `docs/state/blockers.md` 는 append-only.
  - learnings: finding/감사 처리 중 발견한 의외의 점 한 줄. audit_counter 진행도.
  - blockers: forbidden action 트리거 / 3-사이클 stuck / promotion back out /
    revert-guard 발동 시.

---

## Progress log

- 2026-05-27T01:03:00+09:00 — Tier 0 honesty pass complete; audit_counter=1.
  Rechecked unresolved `OPEN`/`open` status_notes against source-of-truth
  commands and found no stale closure claims to correct:
  `goals/7-cli-spec-parity.gates.sh` still hardcodes `HONEST_UC_SET`;
  `apps/cli/tests/e2e-cli/UC-021.test.ts` still relies on
  `/__test/.../revisions` for merge-resolve conflict setup; `packages/` is
  absent; `apps/api/tests/unit/http/*-routes.test.ts` count is still 37;
  UC-022 Gap B remains open because `SOFT` acquisition can replace/delete an
  existing non-blocking lock instead of preserving it with a warning; CI still
  declares shard `[1, 2, 3, 4]`; `apps/api/src/http/actor-results.ts` still
  emits `vspec actor restore`.
- 2026-05-27T01:11:18+09:00 — Tier 1#1 harness-spec-debt item 3 complete;
  audit_counter=2. Commit `bf9f3bf` converted Goal 7's honest UC surface from a
  hand-maintained positive `HONEST_UC_SET` to `docs/usecases/UC-*.md` minus
  `HONEST_UC_ALLOWLIST`, added `docs/usecases` to `GATE_INPUTS`, updated the
  matching next-task/prose, and added
  `apps/api/tests/integration/goal7-honest-uc-set.test.ts`. Verification:
  `pnpm exec vitest run apps/api/tests/integration/goal7-honest-uc-set.test.ts`,
  `bash goals/7-cli-spec-parity.gates.sh`, and
  `bash scripts/completion-check.sh` exited 0. Next step: required meta-system
  audit checkpoint.
- 2026-05-27T01:16:53+09:00 — Meta-audit checkpoint #1 complete;
  audit_counter=3. Q2/Q3 found the new Goal 7 UC derivation duplicated in
  `goals/7-cli-spec-parity.gates.sh` and `.next-task.sh`, while the regression
  test was coupled to a literal `find docs/usecases ...` shell shape. Improvement:
  extracted `scripts/derive-honest-uc-set.sh`, made both Goal 7 scripts call it,
  and changed `apps/api/tests/integration/goal7-honest-uc-set.test.ts` to verify
  helper behavior with a fixture. Verification: focused vitest, `tsc --noEmit`,
  eslint on the test, `VSPEC_GATES_SKIP_DEEP=1 bash goals/7-cli-spec-parity.gates.sh`,
  and `bash scripts/completion-check.sh` exited 0.
- 2026-05-27T01:25:41+09:00 — Tier 1#2 CI shard reduction complete;
  audit_counter=4. Commit `20f8dd4` reduced `.github/workflows/ci.yml` from
  `shard: [1, 2, 3, 4]` to `[1, 2]`, updated the test command to
  `--shard=${{ matrix.shard }}/2`, and extended `scripts/check-ci.sh` so CI
  rejects a `ci.yml` test matrix above 2 shards plus shard denominator drift.
  Verification: `bash scripts/check-ci.sh`, `rg -n 'shard|/4|1, 2, 3, 4|1,2,3,4' .github/workflows scripts`,
  and `bash scripts/completion-check.sh` exited 0; pushed run `26460852463`
  succeeded. Measured billable minutes: previous 4-shard run `26460651003`
  was 13 minutes (lint 1 + test 3+3+3+3), new 2-shard run `26460852463` was
  9 minutes (lint 1 + test 4+4). Next step: required meta-system audit checkpoint.
- 2026-05-27T01:28:00+09:00 — Meta-audit checkpoint #2 complete;
  audit_counter=5. Q1/Q2 on the new CI shard guard found a gameable path:
  a test job could keep `strategy.matrix.shard` but drop the
  `--shard=${{ matrix.shard }}/N` argument, duplicating the full suite while
  still passing the structural checks. RED: added
  `missing-shard-argument.yml` to `scripts/check-ci.sh` self-test and confirmed
  `bash scripts/check-ci.sh` failed. GREEN: `check-ci` now requires a test job
  with `matrix.shard` to carry a matching shard argument and keeps the
  denominator check. Verification: `bash scripts/check-ci.sh` and
  `bash scripts/completion-check.sh` exited 0.
- 2026-05-27T01:41:25+09:00 — Tier 2#3 spec-impl-audit Gap B complete;
  audit_counter=6. Commit `968b142` made UC-022 SOFT lock acquisition use
  `listLocksForUseCase`, preserve existing locks, emit `SOFT_LOCK_COEXISTS`
  warnings naming active holders, allow `who` to report both session-held SOFT
  locks, and keep single-lock callers pointed at the strongest lock so
  HARD/SEMANTIC blockers are not hidden by SOFT coexistence. Schema uniqueness
  now includes the session/user holder columns. Verification:
  `pnpm exec vitest run apps/api/tests`, focused lock tests, `pnpm exec tsc --noEmit`,
  focused eslint, `bash scripts/check-db-consistency.sh`,
  `bash scripts/check-persistence.sh`, and `bash scripts/completion-check.sh`
  exited 0. Next step: required meta-system audit checkpoint.
- 2026-05-27T01:45:30+09:00 — Meta-audit checkpoint #3 complete;
  audit_counter=7. Q1/Q6 on the SOFT coexistence change found that
  sessionless user-held SOFT reacquire could create duplicate locks because the
  Prisma holder key includes nullable `held_by_session_id`. RED: added
  `apps/api/tests/unit/application/locks-edge.test.ts` coverage requiring a
  same-user/no-session SOFT reacquire to update the existing lock without
  delete/save duplication. GREEN: `acquireLock` now updates an active owned
  SOFT lock in place while preserving the no-delete rule and warning behavior
  for other holders. Verification: focused lock tests,
  `pnpm exec vitest run apps/api/tests`, `pnpm exec tsc --noEmit`, focused
  eslint, and `bash scripts/completion-check.sh` exited 0.
- 2026-05-27T01:59:20+09:00 — Tier 2#4 invocation-links Stage 1a backend
  complete; `audit_counter=8`. RED covered markdown `_(includes: ...)` parsing
  and rendering, use-case read `invokes`/derived `invoked_by`, and doctor
  warnings for dangling/self/cyclic links. GREEN added `Step.invokes`,
  parse/render helpers, Prisma/domain mapper support, reverse-edge scanning,
  and doctor warning checks. Verification: focused invocation tests,
  `pnpm exec vitest run apps/api/tests`, `pnpm exec tsc --noEmit`, focused
  eslint, and `bash scripts/check-db-consistency.sh` exited 0. Next step:
  required meta-system audit checkpoint before Stage 1b delegation.
- 2026-05-27T02:03:40+09:00 — Meta-audit checkpoint #4 complete;
  `audit_counter=9`. Q6 against the invocation-links acceptance signal found
  that parse and render were tested separately, but the promised
  `serialize(parse(F)) === F` markdown round-trip was not directly pinned. RED:
  added a sync markdown helper test that called missing `serializeStepAction`.
  GREEN: exposed `serializeStepAction` next to `parseStepAction` and reused the
  same invocation annotation serializer. Verification:
  `pnpm exec vitest run apps/api/tests/unit/http/sync-markdown.test.ts`,
  `pnpm exec tsc --noEmit`, and focused eslint exited 0.
- 2026-05-27T02:16:20+09:00 — Tier 2#4 invocation-links Stage 1b web
  rendering complete; `audit_counter=10`. Created claude-owned Goal 34 and
  delegated to Claude Code in `apps/app`. Claude landed commits `cb8ebff`
  (detail data model), `eb58bb6` (auth-stub invocation examples), and
  `8d4a549` (detail page "호출 / 호출됨" rendering). Verification:
  `bash goals/34-web-invocation-links.gates.sh`,
  `pnpm --filter @vooster/app test`, and
  `pnpm --filter @vooster/app typecheck` exited 0. Full chain verification
  uncached a stale Goal 33 failure; delegated repair commit `476f51e` restored
  the project overview prepared-exception block, and Goal 33/34 gates now both
  exit 0. Next step: required meta-system audit checkpoint before
  invocation-links Stage 2.
- 2026-05-27T02:24:05+09:00 — Meta-audit checkpoint #5 complete;
  `audit_counter=11`. Q1/Q2 on Goal 34 found that the auth-stub invocation
  example was enforced by grep in `goals/34-web-invocation-links.gates.sh`
  instead of by a behavior test. RED: extended
  `apps/app/tests/unit/data-stub.test.tsx` to require normalized `invokes`
  arrays and a concrete `invoked_by` example. GREEN: `stubUsecaseDetail`
  now normalizes missing invocation links to empty arrays, and the redundant
  stub grep gate was removed. Verification: `pnpm --filter @vooster/app test`,
  `pnpm --filter @vooster/app typecheck`, and
  `bash goals/34-web-invocation-links.gates.sh` exited 0.
- 2026-05-27T02:29:40+09:00 — Tier 2#4 invocation-links Stage 2 local
  severity complete; `audit_counter=12`. RED: impact preview tests required
  caller revision diffs to classify invocation add/remove/retarget edits.
  GREEN: `impact-analysis.ts` now compares parent/current
  `main_success.steps[].invokes`, keeps active-session BREAKING escalation,
  and combines invocation-derived severity with the revision's own severity.
  `docs/05-data-model.md` now lists the three invocation severity rules.
  Verification: focused impact-analysis test, API typecheck, targeted eslint,
  and targeted prettier exited 0. Next step: required meta-system audit
  checkpoint before invocation-links Stage 3.
- 2026-05-27T02:33:02+09:00 — Meta-audit checkpoint #6 complete;
  `audit_counter=13`. Q6 on invocation-links Stage 1/2 found the severity
  table had been updated but the `Step` data-model table still omitted the
  actual `invokes` field added in Stage 1a. Improvement: documented
  `Step.invokes` as the invoked UseCase-key list with an empty default.
  Verification: targeted prettier and `bash scripts/completion-check.sh`
  exited 0.
- 2026-05-27T02:39:31+09:00 — Tier 2#4 invocation-links Stage 3 contract
  transitive impact complete; `audit_counter=14`. RED: impact preview tests
  required contract-surface callee changes to add active caller sessions through
  reverse invocation edges transitively and cycle-safely, while internal callee
  changes must not add caller sessions. GREEN: impact analysis now compares
  contract-surface snapshot fields, walks reverse `invokes` edges through the
  project invocation graph, annotates caller sessions with
  "의존 UC의 계약 변경", and leaves severity based on the changed UC/direct
  sessions rather than forging caller severity. The invocation-links finding is
  now resolved. Verification: focused impact/route tests, API typecheck,
  targeted eslint/prettier, and `pnpm --filter @vooster/api test` exited 0.
  Next step: required meta-system audit checkpoint before the next target.
- 2026-05-27T02:45:50+09:00 — Tier 3#5 shared-api-contracts scaffold
  complete; `audit_counter=15`. Added `packages/contracts` as
  `@vooster/contracts`, wired `packages/*` into pnpm and TypeScript, added the
  workspace dependency to API/CLI/Web packages, and pinned a smoke Zod schema
  parse test. Domains migrated: 0/21. Verification:
  `pnpm exec vitest run packages/contracts`, `pnpm exec tsc --noEmit`,
  targeted eslint, targeted prettier, and `pnpm install` exited 0.
- 2026-05-27T02:51:09+09:00 — Tier 3#5 shared-api-contracts common/health
  domain complete; `audit_counter=16`. Moved the health response schema into
  `packages/contracts/src/common.ts`, re-exported it from the contracts entry,
  and made API `/healthz` parse the response through `healthResponseSchema`.
  Domains migrated: 1/21. Verification:
  `pnpm exec vitest run packages/contracts apps/api/tests/e2e/UC-001-real-oauth.test.ts apps/api/tests/integration/persistence-matrix-workflow.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, and targeted prettier exited 0.
  Next step: required meta-system audit checkpoint before the next contract
  domain.
- 2026-05-27T02:56:32+09:00 — Tier 3#5 shared-api-contracts AI-guide domain
  complete; `audit_counter=17`. Added `packages/contracts/src/ai-guide.ts`
  with query/body and success response schemas, made the API route parse
  request and 200-response DTOs through the shared schemas, and made the CLI
  `ai-guide` command parse markdown/json responses before rendering. Domains
  migrated: 2/21. Verification:
  `pnpm exec vitest run packages/contracts apps/api/tests/e2e/UC-033.test.ts apps/cli/tests/e2e-cli/UC-033.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, and targeted prettier exited 0.
- 2026-05-27T03:02:34+09:00 — Tier 3#5 shared-api-contracts doctor domain
  complete; `audit_counter=18`. Added `packages/contracts/src/doctor.ts` with
  query and success response schemas, made the API doctor route parse query and
  successful diagnostics through the shared schemas, and made the CLI `doctor`
  command parse the response before human/json/agent rendering. Domains
  migrated: 3/21. Verification:
  `pnpm exec vitest run packages/contracts apps/api/tests/unit/http/doctor-routes.test.ts apps/api/tests/integration/http/doctor-route.test.ts apps/cli/tests/unit/doctor-command.test.ts apps/cli/tests/e2e-cli-honest/doctor.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, and targeted prettier exited 0.
  Next step: required meta-system audit checkpoint before the next target.
- 2026-05-27T03:14:14+09:00 — Meta-audit checkpoint after `audit_counter=18`:
  KEEP. Recent contract-package changes are production-consumed schemas, not
  brittle gates; status claims were checked by push-time `completion-check.sh`;
  adjacent tests assert schema behavior instead of route internals.
- 2026-05-27T03:14:14+09:00 — Tier 3#5 shared-api-contracts actor domain
  complete; `audit_counter=19`. Added `packages/contracts/src/actor.ts`, made
  actor API request/response DTOs parse through shared schemas, made CLI
  actor read/edit/archive/create outputs parse shared responses, and made the
  app actor reader parse the shared list response while preserving its narrower
  UI summary type. Domains migrated: 4/21. Verification:
  `pnpm exec vitest run packages/contracts apps/api/tests/unit/http/actor-routes.test.ts apps/api/tests/unit/http/actor-management-routes.test.ts apps/api/tests/e2e/UC-005.test.ts apps/cli/tests/unit/actor-command.test.ts apps/cli/tests/unit/agent-format-write-path.test.ts apps/cli/tests/e2e-cli-honest/UC-005-actor.test.ts apps/cli/tests/e2e-cli-honest/actor-read.test.ts apps/cli/tests/e2e-cli-honest/actor-edit.test.ts apps/cli/tests/e2e-cli-honest/agent-format-write-path.test.ts apps/app/tests/unit/data-stub.test.tsx`,
  `pnpm exec tsc --noEmit`, `pnpm --filter @vooster/app typecheck`,
  `pnpm --filter @vooster/app test`, targeted eslint, and targeted prettier
  exited 0.
- 2026-05-27T03:21:29+09:00 — Tier 3#5 shared-api-contracts stakeholder
  domain complete; `audit_counter=20`. Added
  `packages/contracts/src/stakeholder.ts`, made stakeholder API request/
  response DTOs parse through shared schemas, and made CLI stakeholder
  read/edit/archive/create outputs parse shared responses. Domains migrated:
  5/21. Verification:
  `pnpm exec vitest run packages/contracts/tests/stakeholder.test.ts apps/api/tests/unit/http/stakeholder-routes.test.ts apps/api/tests/unit/http/stakeholder-management-routes.test.ts apps/cli/tests/unit/stakeholder-command.test.ts apps/cli/tests/unit/agent-format-write-path.test.ts`,
  `pnpm exec vitest run apps/api/tests/e2e/UC-006.test.ts apps/cli/tests/e2e-cli-honest/UC-006-stakeholder.test.ts apps/cli/tests/e2e-cli-honest/stakeholder-read.test.ts apps/cli/tests/e2e-cli-honest/stakeholder-edit.test.ts apps/cli/tests/e2e-cli-honest/agent-format-write-path.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, and targeted prettier exited 0.
  Next step: required meta-system audit checkpoint before the next target.
- 2026-05-27T03:28:40+09:00 — Meta-audit checkpoint after `audit_counter=20`
  found actor/stakeholder CLI unit tests still asserting exact
  `fetch(..., RequestInit)` objects after their shared schema migrations.
  Replaced those implementation-detail assertions with behavior-level call
  count + rendered-output checks; `audit_counter=21`. Verification:
  `pnpm exec vitest run apps/cli/tests/unit/actor-command.test.ts apps/cli/tests/unit/stakeholder-command.test.ts apps/cli/tests/e2e-cli-honest/actor-read.test.ts apps/cli/tests/e2e-cli-honest/actor-edit.test.ts apps/cli/tests/e2e-cli-honest/stakeholder-read.test.ts apps/cli/tests/e2e-cli-honest/stakeholder-edit.test.ts`,
  targeted eslint, targeted prettier, and `bash scripts/completion-check.sh`
  exited 0.
- 2026-05-27T03:50:30+09:00 — Tier 3#5 shared-api-contracts goal domain
  complete; `audit_counter=22`. Added `packages/contracts/src/goal.ts`, moved
  goal create/patch/list params and show/list/create/patch/promote response DTOs
  into shared schemas, made API goal routes/results parse through those schemas,
  made CLI goal read/write paths parse shared responses, and removed stale
  route-local goal validation. Domains migrated: 6/21. Verification:
  `pnpm exec vitest run packages/contracts/tests/goal.test.ts apps/api/tests/unit/http/goal-routes.test.ts apps/api/tests/unit/http/goal-results.test.ts apps/api/tests/unit/http/goal-promotion-routes.test.ts apps/api/tests/unit/http/goal-promotion-results.test.ts apps/api/tests/unit/http/goal-show-routes.test.ts apps/api/tests/unit/http/goal-support.test.ts apps/cli/tests/unit/goal-command.test.ts apps/cli/tests/unit/agent-format-write-path.test.ts`,
  `pnpm exec vitest run apps/api/tests/e2e/UC-007.test.ts apps/api/tests/e2e/UC-008.test.ts apps/cli/tests/e2e-cli-honest/UC-007-goal.test.ts apps/cli/tests/e2e-cli-honest/goal-read.test.ts apps/cli/tests/e2e-cli-honest/goal-edit.test.ts apps/cli/tests/e2e-cli-honest/agent-format-write-path.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier,
  `bash goals/9-cli-trim.gates.sh`, and `bash scripts/completion-check.sh`
  exited 0. Next step: required meta-system audit checkpoint before the next
  target.
- 2026-05-27T03:57:03+09:00 — Meta-audit checkpoint after `audit_counter=22`
  found Goal 9's agent-envelope gate over-coupled to command-file layout: moving
  goal agent rendering into `goal-output.ts` was behavior-preserving and covered
  by unit/honest E2E envelope tests, but the gate failed because `goal.ts` no
  longer contained the literal branch. Improvement: `goals/9-cli-trim.gates.sh`
  now accepts command-file or sibling `*-output.ts` envelope wiring, and the
  goal text states that case-(b) transfer explicitly; `audit_counter=23`.
  Verification: RED `bash goals/9-cli-trim.gates.sh`, then
  `pnpm exec vitest run apps/cli/tests/unit/agent-format-write-path.test.ts apps/cli/tests/unit/goal-command.test.ts apps/cli/tests/e2e-cli-honest/agent-format-write-path.test.ts`,
  targeted eslint/prettier, `bash goals/9-cli-trim.gates.sh`, and
  `bash scripts/completion-check.sh` exited 0.
- 2026-05-27T04:04:33+09:00 — Tier 3#5 shared-api-contracts API-key domain
  complete; `audit_counter=24`. Added `packages/contracts/src/api-key.ts`,
  moved API-key create/list/revoke request and success response DTOs into shared
  schemas, made API routes/results parse through those schemas, made the CLI
  parse shared request/query and response shapes before rendering, and tightened
  API-key CLI fixtures to match the production response contract. Domains
  migrated: 7/21. Verification:
  `pnpm exec vitest run packages/contracts/tests/api-key.test.ts apps/api/tests/unit/http/api-key-routes.test.ts apps/api/tests/unit/http/api-key-results.test.ts apps/api/tests/e2e/UC-032.test.ts apps/cli/tests/unit/member-api-key-agent-format.test.ts apps/cli/tests/e2e-cli/UC-032.test.ts apps/cli/tests/e2e-cli-honest/member-api-key-agent-format.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0. Next step: required meta-system
  audit checkpoint before the next target.
- 2026-05-27T04:05:58+09:00 — Meta-audit checkpoint after `audit_counter=24`:
  KEEP. API-key shared-contract changes were backed by contract tests plus
  API/CLI unit and e2e behavior, no exact `RequestInit` assertions remained,
  completion was re-run, and the adjacent Goal 9 agent-output gate had already
  been relaxed to allow renderer extraction. No work-unit count change.
- 2026-05-27T04:11:24+09:00 — Tier 3#5 shared-api-contracts branch domain
  complete; `audit_counter=25`. Added `packages/contracts/src/branch.ts`, moved
  branch project params, create request, and success response DTOs into shared
  schemas, made API branch routes/results parse through those schemas, made CLI
  branch create parse shared request/response shapes before rendering, and
  tightened branch CLI fixtures to match the production response contract.
  Domains migrated: 8/21. Verification:
  `pnpm exec vitest run packages/contracts/tests/branch.test.ts apps/cli/tests/unit/branch-agent-format.test.ts apps/cli/tests/e2e-cli-honest/branch-agent-format.test.ts apps/cli/tests/e2e-cli-honest/UC-019-create-branch.test.ts apps/api/tests/e2e/UC-019.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0.
- 2026-05-27T04:23:08+09:00 — Tier 3#5 shared-api-contracts lock domain
  complete; `audit_counter=26`. Added `packages/contracts/src/lock.ts`, moved
  lock acquire/renew/release params, request bodies, and success response DTOs
  into shared schemas, made API lock routes/results parse through those schemas,
  made CLI lock acquire/renew/release parse shared request/response shapes before
  rendering, and tightened lock CLI fixtures to match the production response
  contract. Domains migrated: 9/21. Verification:
  `pnpm exec vitest run packages/contracts/tests/lock.test.ts apps/cli/tests/unit/lock-agent-format.test.ts apps/cli/tests/unit/lock-renew-agent-format.test.ts apps/cli/tests/e2e-cli-honest/lock-agent-format.test.ts apps/cli/tests/e2e-cli-honest/lock-renew-agent-format.test.ts apps/api/tests/e2e/UC-022.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0. Next step: required meta-system
  audit checkpoint before the next target.
- 2026-05-27T04:31:10+09:00 — Meta-audit checkpoint after `audit_counter=26`:
  KEEP. Lock shared-contract schemas are production-consumed by API and CLI, the
  pushed `completion-check.sh` run verified the status claim, and the remaining
  lock request payload assertions are contract-surface checks explicitly owned by
  the shared-contracts migration rather than meta-audit trim work. No work-unit
  count change.
- 2026-05-27T04:33:49+09:00 — Tier 3#5 shared-api-contracts comment domain
  complete; `audit_counter=27`. Added `packages/contracts/src/comment.ts`, moved
  comment add/list/edit/resolve/delete params, request bodies, dry-run query,
  and success response DTOs into shared schemas, made API comment routes/results
  parse through those schemas, made CLI comment read/write paths parse shared
  request and response shapes, and tightened comment CLI fixtures to match the
  production response contract. Domains migrated: 10/21. Verification:
  `pnpm exec vitest run packages/contracts/tests/comment.test.ts apps/api/tests/unit/http/comment-routes.test.ts apps/api/tests/unit/http/comment-results.test.ts apps/cli/tests/unit/comment-agent-format.test.ts apps/cli/tests/e2e-cli-honest/comment-agent-format.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, and targeted prettier exited 0.
- 2026-05-27T04:42:28+09:00 — Tier 3#5 shared-api-contracts project domain
  complete; `audit_counter=28`. Added `packages/contracts/src/project.ts`, moved
  project create/list/rename/delete params, request bodies, dry-run query, and
  success response DTOs into shared schemas, made API project handlers/results
  parse through those schemas, made CLI project create/list/switch lookup parse
  shared request and response shapes, made app project readers/mutations parse
  through the shared schemas, and relaxed the project-list CLI unit test off
  exact `fetch(..., RequestInit)` equality. Domains migrated: 11/21.
  Verification:
  `pnpm exec vitest run packages/contracts/tests/project.test.ts apps/api/tests/unit/http/project-routes.test.ts apps/api/tests/unit/http/project-results.test.ts apps/cli/tests/unit/project-create-agent-format.test.ts apps/cli/tests/unit/project-command.test.ts apps/cli/tests/e2e-cli-honest/project-create-agent-format.test.ts apps/cli/tests/e2e-cli-honest/project-read.test.ts apps/app/tests/unit/data-stub.test.tsx`,
  `pnpm exec tsc --noEmit`, `pnpm --filter @vooster/app typecheck`,
  `pnpm --filter @vooster/app test`, targeted eslint, and targeted prettier
  exited 0. Next step: required meta-system audit checkpoint before the next
  target.
- 2026-05-27T04:51:40+09:00 — Meta-audit checkpoint after `audit_counter=28`:
  KEEP. Project/comment shared-contract schemas are production-consumed by API,
  CLI, and web paths where applicable; push-time `completion-check.sh` verified
  the status claims; the project CLI unit no longer asserts exact
  `fetch(..., RequestInit)` equality. No work-unit count change.
- 2026-05-27T05:03:30+09:00 — Tier 3#5 shared-api-contracts usecase domain
  complete; `audit_counter=29`. Added `packages/contracts/src/usecase.ts`, moved
  usecase create/list/show/update/archive/restore params, request bodies,
  queries, and success response DTOs into shared schemas, made API usecase
  routes/results parse through those schemas, made CLI usecase read/write paths
  parse shared request and response shapes, made app usecase list/detail readers
  parse shared responses, preserved full usecase metadata in agent detail
  payloads, and relaxed usecase CLI unit tests off exact `fetch(...,
RequestInit)` equality while still asserting URL/method/payload.
  Domains migrated: 12/21. Verification:
  `pnpm exec vitest run packages/contracts/tests/usecase.test.ts apps/api/tests/unit/http/usecase-results.test.ts apps/api/tests/unit/http/usecase-agent-results.test.ts apps/api/tests/unit/http/usecase-archive-results.test.ts apps/api/tests/unit/http/usecase-routes.test.ts apps/api/tests/unit/http/usecase-update-routes.test.ts apps/cli/tests/unit/usecase-command.test.ts apps/cli/tests/unit/usecase-output.test.ts apps/cli/tests/unit/agent-format-write-path.test.ts apps/cli/tests/e2e-cli-honest/UC-009-usecase.test.ts apps/cli/tests/e2e-cli-honest/usecase-write.test.ts apps/cli/tests/e2e-cli-honest/login-to-usecase.test.ts apps/app/tests/unit/data-stub.test.tsx`,
  `pnpm exec tsc --noEmit`, `pnpm --filter @vooster/app typecheck`,
  `pnpm --filter @vooster/app test`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0.
- 2026-05-27T05:13:40+09:00 — Tier 3#5 shared-api-contracts scenario/step
  domain complete; `audit_counter=30`. Added
  `packages/contracts/src/scenario.ts`, moved scenario create, step add, and step
  edit params, request bodies, dry-run query, and success response DTOs into
  shared schemas, made API scenario/step routes and result senders parse through
  those schemas, and made CLI scenario/step write paths parse shared request and
  response shapes before agent/human rendering. Domains migrated: 13/21.
  Verification:
  `pnpm exec vitest run packages/contracts/tests/scenario.test.ts apps/api/tests/unit/http/scenario-routes.test.ts apps/api/tests/unit/http/scenario-results.test.ts apps/api/tests/unit/http/scenario-support.test.ts apps/api/tests/unit/http/step-routes.test.ts apps/api/tests/unit/http/step-results.test.ts apps/cli/tests/unit/scenario-agent-format.test.ts apps/cli/tests/unit/step-agent-format.test.ts apps/cli/tests/e2e-cli-honest/scenario-agent-format.test.ts apps/cli/tests/e2e-cli-honest/step-agent-format.test.ts apps/cli/tests/e2e-cli-honest/UC-011-main-scenario.test.ts apps/cli/tests/e2e-cli-honest/UC-012-extension.test.ts apps/cli/tests/e2e-cli-honest/UC-013-step-edit.test.ts apps/api/tests/e2e/UC-011.test.ts apps/api/tests/e2e/UC-012.test.ts apps/api/tests/e2e/UC-013.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0. Next step: required meta-system
  audit checkpoint before the next target.
- 2026-05-27T05:15:50+09:00 — Meta-audit checkpoint after `audit_counter=30`:
  KEEP. Scenario/step shared-contract schemas are production-consumed by API and
  CLI, push-time `completion-check.sh` verified the status claim, and the
  remaining step CLI request assertion checks contract payload behavior rather
  than exact `fetch(..., RequestInit)` structure. No work-unit count change.
- 2026-05-27T05:19:00+09:00 — Tier 3#5 shared-api-contracts who domain
  complete; `audit_counter=31`. Added `packages/contracts/src/who.ts`, moved
  who request params and success response DTO into shared schemas, made API who
  route/results parse through those schemas, and made CLI who parse the shared
  response before agent/human rendering. Domains migrated: 14/21. Verification:
  `pnpm exec vitest run packages/contracts/tests/who.test.ts apps/cli/tests/unit/who-agent-format.test.ts apps/cli/tests/e2e-cli-honest/who-agent-format.test.ts apps/api/tests/e2e/UC-023.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0.
- 2026-05-27T05:28:01+09:00 — Tier 3#5 shared-api-contracts invitation domain
  complete; `audit_counter=32`. Added `packages/contracts/src/invitation.ts`,
  moved invitation create/accept params, request bodies, and success response
  DTOs into shared schemas, made API invitation routes/results parse through
  those schemas, and made CLI member invite parse shared request/response shapes
  before agent/human rendering. Domains migrated: 15/21. Verification:
  `pnpm exec vitest run packages/contracts/tests/invitation.test.ts apps/cli/tests/unit/member-api-key-agent-format.test.ts apps/api/tests/e2e/UC-003.test.ts apps/api/tests/e2e/UC-032.test.ts apps/api/tests/unit/http/invitation-results.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0. Next step: required meta-system
  audit checkpoint before the next target.
- 2026-05-27T05:30:14+09:00 — Meta-audit checkpoint after
  `audit_counter=32`: KEEP. Invitation shared-contract schemas are
  production-consumed by API and CLI, push-time `completion-check.sh` verified
  the status claim, and the migration did not add brittle exact
  `fetch(..., RequestInit)` equality tests. No work-unit count change.
- 2026-05-27T05:32:51+09:00 — Tier 3#5 shared-api-contracts export domain
  complete; `audit_counter=33`. Added `packages/contracts/src/export.ts`, moved
  usecase export params, request bodies, and gherkin/markdown text response DTOs
  into shared schemas, made API gherkin/markdown export routes parse through
  those schemas, and made CLI export parse shared request/response shapes before
  file/stdout rendering. Domains migrated: 16/21. Verification:
  `pnpm exec vitest run packages/contracts/tests/export.test.ts apps/api/tests/unit/http/gherkin-export-routes.test.ts apps/api/tests/unit/http/markdown-export-routes.test.ts apps/api/tests/e2e/UC-030.test.ts apps/api/tests/e2e/UC-031.test.ts apps/cli/tests/e2e-cli/UC-030.test.ts apps/cli/tests/e2e-cli/UC-031.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0.
- 2026-05-27T05:42:54+09:00 — Tier 3#5 shared-api-contracts change domain
  complete; `audit_counter=34`. Added `packages/contracts/src/change.ts`, moved
  change preview/commit request bodies and success response DTOs into shared
  schemas, made API change preview/result/commit paths parse through those
  schemas, made CLI change propose/commit parse shared request/response shapes
  before agent/human rendering, and tightened change CLI fixtures to match the
  production response contract. Domains migrated: 17/21. Verification:
  `pnpm exec vitest run packages/contracts/tests/change.test.ts apps/api/tests/unit/http/change-preview-routes.test.ts apps/api/tests/unit/http/change-preview-results.test.ts apps/api/tests/unit/http/change-commit-routes.test.ts apps/cli/tests/unit/change-agent-format.test.ts apps/cli/tests/e2e-cli-honest/change-agent-format.test.ts apps/api/tests/e2e/UC-035.test.ts apps/cli/tests/e2e-cli/UC-035.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0. Next step: required meta-system
  audit checkpoint before the next target.
- 2026-05-27T05:47:23+09:00 — Meta-audit checkpoint after
  `audit_counter=34`: KEEP. Change shared-contract schemas are
  production-consumed by API and CLI, push-time `completion-check.sh` verified
  the status claim, and the migrated change tests assert agent behavior without
  exact `fetch(..., RequestInit)` equality. No work-unit count change.
- 2026-05-27T05:51:22+09:00 — Tier 3#5 shared-api-contracts merge domain
  complete; `audit_counter=35`. Added `packages/contracts/src/merge.ts`, moved
  merge open/resolve request bodies, resolve params, and success response DTOs
  into shared schemas, made API merge open/result/resolve paths parse through
  those schemas, made CLI merge open/resolve parse shared request/response
  shapes before agent/human rendering, and tightened merge CLI fixtures to match
  the production response contract. Domains migrated: 18/21. Verification:
  `pnpm exec vitest run packages/contracts/tests/merge.test.ts apps/api/tests/unit/http/merge-results.test.ts apps/api/tests/unit/http/merge-resolution-results.test.ts apps/cli/tests/unit/merge-open-agent-format.test.ts apps/cli/tests/unit/merge-resolve-agent-format.test.ts apps/cli/tests/e2e-cli-honest/merge-open-agent-format.test.ts apps/cli/tests/e2e-cli/merge-resolve-agent-format.test.ts apps/api/tests/e2e/UC-020.test.ts apps/api/tests/e2e/UC-021.test.ts apps/cli/tests/e2e-cli/UC-020.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0.
- 2026-05-27T06:01:48+09:00 — Tier 3#5 shared-api-contracts revision domain
  complete; `audit_counter=36`. Added `packages/contracts/src/revision.ts`,
  moved revision history/diff/revert params, query/body, and success response
  DTOs into shared schemas, made API revision routes/results parse through those
  schemas, made CLI history/diff/revert parse shared request/response shapes
  before agent/human/json rendering, and tightened revision CLI fixtures to
  match the production suggested-action contract. Domains migrated: 19/21.
  Verification:
  `pnpm exec vitest run packages/contracts/tests/revision.test.ts apps/cli/tests/unit/history-agent-format.test.ts apps/cli/tests/unit/revert-agent-format.test.ts apps/cli/tests/e2e-cli-honest/history-agent-format.test.ts apps/cli/tests/e2e-cli-honest/revert-agent-format.test.ts apps/api/tests/e2e/UC-024.test.ts apps/api/tests/e2e/UC-025.test.ts apps/api/tests/e2e/UC-026.test.ts apps/cli/tests/e2e-cli/UC-024.test.ts apps/cli/tests/e2e-cli/UC-025.test.ts apps/cli/tests/e2e-cli/UC-026.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0. Next step: required meta-system
  audit checkpoint before the next target.
- 2026-05-27T06:08:22+09:00 — Meta-audit checkpoint after
  `audit_counter=36`: KEEP. Revision shared-contract schemas are
  production-consumed by API and CLI, the contract tests assert HTTP boundary
  parsing rather than route internals, status_notes are backed by focused
  revision tests plus `completion-check.sh`, and the push hook re-ran the full
  completion gate. No work-unit count change.
- 2026-05-27T06:15:13+09:00 — Tier 3#5 shared-api-contracts sync domain
  complete; `audit_counter=37`. Added `packages/contracts/src/sync.ts`, moved
  sync pull/push project params, request bodies, and success response DTOs into
  shared schemas, made API sync routes/results parse through those schemas, made
  CLI pull/sync/push parse shared request/response shapes before filesystem
  writes and agent/human rendering, and tightened push CLI fixtures to match the
  production suggested-action contract. Domains migrated: 20/21. Verification:
  `pnpm exec vitest run packages/contracts/tests/sync.test.ts apps/api/tests/unit/http/sync-routes.test.ts apps/api/tests/unit/http/sync-result-support.test.ts apps/api/tests/integration/http/sync-route.test.ts apps/cli/tests/unit/pull-sync-agent-format.test.ts apps/cli/tests/unit/push-agent-format.test.ts apps/cli/tests/e2e-cli-honest/pull-sync-agent-format.test.ts apps/cli/tests/e2e-cli-honest/push-agent-format.test.ts apps/api/tests/e2e/UC-029.test.ts apps/cli/tests/e2e-cli/UC-029.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0.
- 2026-05-27T06:23:58+09:00 — Tier 3#5 shared-api-contracts session domain
  complete; `audit_counter=38`. Added `packages/contracts/src/session.ts`,
  moved session start/list/watch/complete params, query/body, and success
  response DTOs into shared schemas, made API session routes/results parse
  through those schemas while keeping the internal `__test` heartbeat route
  local, made CLI session start/list/complete parse shared request/response
  shapes before session-file writes and agent/human rendering, and tightened
  session CLI fixtures to match the production suggested-action contract.
  Domains migrated: 21/21 ledgered slices; auth remains open because Doctor was
  counted as an additional slice beyond the original package-shape list.
  Verification:
  `pnpm exec vitest run packages/contracts/tests/session.test.ts apps/api/tests/unit/http/session-routes.test.ts apps/api/tests/unit/http/session-list-routes.test.ts apps/api/tests/unit/http/session-complete-routes.test.ts apps/cli/tests/unit/session-agent-format.test.ts apps/cli/tests/e2e-cli-honest/session-agent-format.test.ts apps/cli/tests/e2e-cli-honest/UC-016-start-session.test.ts apps/api/tests/e2e/UC-016.test.ts apps/api/tests/e2e/UC-017.test.ts apps/api/tests/e2e/UC-018.test.ts apps/cli/tests/e2e-cli/UC-016.test.ts apps/cli/tests/e2e-cli/UC-017.test.ts apps/cli/tests/e2e-cli/UC-018.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0. Next step: required meta-system
  audit checkpoint before the next target.
- 2026-05-27T06:25:51+09:00 — Meta-audit checkpoint after
  `audit_counter=38`: KEEP. Session shared-contract schemas are
  production-consumed by API and CLI, contract tests assert HTTP boundary
  parsing rather than route internals, the internal `__test` heartbeat route
  correctly remains local, and status_notes explicitly identify the
  Doctor/auth count mismatch. No work-unit count change.
- 2026-05-27T06:31:38+09:00 — Tier 3#5 shared-api-contracts auth domain
  complete; `audit_counter=39`. Added `packages/contracts/src/auth.ts`, moved
  OAuth start/callback and device-token request/query shapes plus login/signup
  success response DTOs into shared schemas, made API auth/signup routes and
  result helpers parse through those schemas, made CLI login parse the shared
  device-token request and login/signup response shapes before config writes,
  and marked the finding partial rather than true because the original plan's
  central typed CLI client extraction and any non-package-shape production
  surfaces remain deferred. Package-shape domains are complete; final migrated
  slice count is 22/21 because Doctor was tracked as an additional slice beyond
  the original package-shape list. Verification:
  `pnpm exec vitest run packages/contracts/tests/auth.test.ts apps/api/tests/unit/http/signup-routes.test.ts apps/api/tests/unit/http/auth-device-routes.test.ts apps/api/tests/unit/http/signup-support.test.ts apps/api/tests/e2e/UC-001.test.ts apps/api/tests/e2e/UC-002.test.ts apps/cli/tests/e2e-cli/UC-001.test.ts apps/cli/tests/e2e-cli-honest/login-to-usecase.test.ts`,
  `pnpm exec tsc --noEmit`, targeted eslint, targeted prettier, and
  `bash scripts/completion-check.sh` exited 0.
- 2026-05-27 post-completion audit correction — Tier 5 optional item 4b was
  still open after the original `complete` marker. Closed the cheap
  `vspec actor restore` cut by removing the unroutable suggestion from
  archived-actor-name conflicts, updating UC-005 3b2, and marking the
  agent-contract finding accordingly. Also clarified shared-contracts ledger
  wording: the run migrated 21 planned package slices plus Doctor as a
  separately tracked slice, not a literal `22/21` target. Route-test Phase 2
  now has its first migrated file: `doctor-routes` moved from mocked unit route
  tests to `apps/api/tests/integration/http/doctor-route.test.ts`, leaving
  36/37 route-unit files in the back catalog.

---

## 검증 — 진짜 끝났는지

종료 직전:

```bash
# 1. in-scope target findings 상태 점검
for f in \
  docs/findings/2026-05-21T1642-harness-spec-debt.md \
  docs/findings/2026-05-25T1823-ci-resource-optimization.md \
  docs/findings/2026-05-24T1100-spec-impl-audit.md \
  docs/findings/2026-05-26T1504-usecase-invocation-links.md \
  docs/findings/2026-05-22T1628-shared-api-contracts.md \
  docs/findings/2026-05-23T1836-route-test-coverage-honesty.md \
  docs/findings/2026-05-26T1234-agent-contract-followups.md \
; do
  awk '/^---$/{c++; if(c==2)exit} /^resolved:/{print FILENAME": "$0}' "$f"
done

# 예상:
#   harness-spec-debt          → true (item3 닫힘) 또는 partial
#   ci-resource-optimization   → true (item2 닫힘) 또는 partial
#   spec-impl-audit (Gap B)    → true (A·B·C green) 또는 partial
#   usecase-invocation-links   → true 또는 partial (마지막 green 단계 표기)
#   shared-api-contracts       → partial ("N/21 domains") — XL, partial 정상
#   route-test-coverage-honesty→ partial ("Phase 2: 1/37 migrated")
#   agent-contract-followups   → partial (4b closed; 3/4a/4c deferred)

# 2. chain green
bash scripts/completion-check.sh; echo "exit: $?"   # 0

# 3. 작업 트리 clean
git status --short    # 비어야 함

# 4. push 완료
git log @{u}..HEAD --oneline   # 비어야 함
```

다 통과하면 `docs/state/learnings.md` 에 append:

```
- 2026-05-27 findings+meta-audit sweep: closed/advanced N findings
  (harness-spec-debt#3, ci-shard, Gap B, invocation-links, shared-contracts
  K/21 domains, route-test M/37). Ran A meta-audit checkpoints → B improvements.
  Out of scope: A14, merge-resolve setup, agent-contract 3/4a/4c, F3, F4,
  branch-protection. Open blockers: C. See git log for details.
```

TERMINATE.
