---
cycle: 260526-01
title: Overnight findings sweep
authored_at: 2026-05-26T01:03:39+09:00
started_at: 2026-05-26T01:49:03+09:00
completed_at:
status: running
---

# 260526-01 — Overnight findings sweep

**목표**: 2026-05-26 시점 `docs/findings/` 의 **미해결(`false`) + 부분
해결(`partial`)** finding 전부를 우선순위/의존성 순서대로 닫는다. 일부는
goal 로 promote, 일부는 claude 위임, 대부분 직접 작업. 매 작업 단위 완료
시 commit + push.

본 문서를 codex 에게 **무한 루프 모드**로 넘긴다:
`/goal cycles/260526-01-overnight-findings-sweep.md 의 내용을 모두
완수할때까지 작업해줘.`

이것은 **무인(set-and-sleep) 실행**이다. 설계 원칙: 높은 가치/낮은 위험
작업을 먼저, 깊고 안전한 대량 큐를 나중에, 설계 결정/유료 에이전트가
필요한 항목은 out-of-scope. **조기 종료 절대 금지** — 막히면 blocker
기록 후 다음 target. 할 일은 의도적으로 하룻밤보다 많게 깔아두었다.

작업 시작 전 반드시 읽을 것:

- `docs/goal-design.md` — harness 설계 (특히 §1.5, §5)
- `guidelines/goal-iteration.md` — iteration 프로토콜 (TDD, commit cadence)
- `.claude/skills/commit/SKILL.md` (또는 `/commit` skill) — 커밋 규약
- `docs/findings/AGENTS.md` — finding 문서 규약 (**이제 frontmatter
  schema 의 source of truth**: `resolved: false|"partial"|true`,
  `priority: P0|P1|P2`, `resolved_by`, `was`, `kind`, `status_notes`,
  `related`. 260524 cycle 의 drift 보정이 이미 적용됨)
- 위임 goal 을 만들 때: `docs/claude/delegation.md` + `docs/claude/headless.md`

**시작 상태 (2026-05-26)**: chain GREEN (`.state/active-goal == ALL_DONE`),
최고 goal 번호 `31` → 다음 빈 번호 **`32`**. 작업 브랜치 **`main`**
(별도 branch 생성 금지, `origin/main` 으로 push).

---

## 루프 알고리즘

```
  step 0 — 최초 1회 (루프 진입 전):
    이 문서(cycles/260526-01) frontmatter 갱신:
      started_at = 현재 시각(ISO-8601 +09:00), status: running.
    → commit + push.

LOOP:

  step 1 — chain 상태 확인:
    $ bash scripts/completion-check.sh
    if exit 0 (.state/active-goal == ALL_DONE):
      → step 2
    else:
      → .state/active-goal 의 goal 을 TDD 로 GREEN 만들기
        (guidelines/goal-iteration.md 의 Phase 4 따름)
      → 위임 goal(## Delegation owner: claude)이면:
          bash scripts/next-task.sh 가 delegate-to-claude.sh 로 라우팅.
          dispatcher 의 self-loop 가 각 step 을 처리. gate 통과까지 반복.
      → commit + push
      → ★ DEADLOCK 가드: 이 active goal 이 본 cycle 에서 promote 한
        goal 인데 3 TDD 사이클(또는 위임 3 라운드) 무진전이면 →
        promotion 을 back out 한다: 방금 추가한 goals/<n>-*.{md,gates.sh,
        next-task.sh} 삭제 → commit "revert: withdraw incomplete goal <n>
        (see blockers.md)" → blocker 기록 → 해당 finding 은 `partial` +
        status_notes 에 "promotion withdrawn, deferred". chain 이 다시
        GREEN 으로 복귀해 큐가 막히지 않는다.
      → step 1 (재확인)

  step 2 — finding 진행:
    target_findings 리스트(아래)에서 첫 unresolved/partial-with-open 선택
    if 없음:
      → step 3
    else:
      → "Finding 처리 절차" 따름
      → frontmatter resolved: true (또는 partial + status_notes)
      → commit + push
      → step 1

  step 3 — 깊은 큐 소진 확인:
    dogfood-followups / gates-over-coupling / route-test-honesty 는
    sub-item/per-file 큐다. 남은 sub-item 이 있으면 그것이 곧 다음 일.
    모든 in-scope target 의 모든 in-scope sub-item 이 닫혔으면:
      → TERMINATE
```

종료 조건 (셋 다 만족):

1. 모든 in-scope target finding 이 `resolved: true` 또는 명시적
   `partial` (out-of-scope sub-item 만 남음)
2. `bash scripts/completion-check.sh` exit 0
3. `git status --short` 비어 있고 `git log @{u}..HEAD` 비어 있음 (push 완료)

종료 시: 이 문서(cycles/260526-01) frontmatter 의 `completed_at` 을 현재
시각으로 기입하고 `status` 를 `complete`(모든 in-scope 닫힘) 또는
`partial`(deferred 남음)로 갱신. 그리고 `docs/state/learnings.md` 에 한 줄
요약 append. → commit + push.

**막혀도 종료하지 마라.** 한 target 에서 stuck → blocker 기록 → 다음
target. 모든 target 이 stuck 인 극단적 경우에만, 닫은 것까지 commit/push
하고 blocker 에 전모 기록 후 종료.

---

## Target findings (실행 순서)

### Tier 1 — Activation/WOW 프론티어 (가장 높은 가치, 먼저)

**1. `docs/findings/2026-05-25T1503-web-viewer-de-jargon.md` (F1, P1)**

- 웹 뷰어가 snake_case 코드 필드명을 헤더로 노출 + StatusPill enum 불일치.
  캐논 용어 라벨 + `?` popover 용어집으로 교체. 데이터 중립, ~1일.
- **promote → claude-owned 위임 goal `32`**. finding 의 "Gate (universal
  claim)" 4종이 그대로 `goals/32-*.gates.sh`. `## Delegation`
  (owner: claude, cwd: `apps/web`). 계약은 `docs/claude/delegation.md`.
  **이 repo 최초의 claude-owned goal** — delegation 문서를 정독하고
  marker schema 를 정확히 따를 것.
- next-task 힌트는 얇게(처방 X, "무엇"만) — Claude 의 표기 판단을 살림.

**2. `docs/findings/2026-05-25T1511-project-overview-blueprint.md` (F2, P1)**

- 평면 UC 리스트 → substance 카운트(시나리오/확장 수) + "대비된 예외
  N건" 청사진. **F1 완료 후** 진행 (의존). MEDIUM, ~1.5일.
- **MIXED**:
  - 백엔드 — `GET /v1/projects/:id/usecases` 응답에 `scenario_count`/
    `extension_count` 등 추가 = **직접 TDD** (계약 변경, e2e/contract
    테스트). universal invariant 가 명확하면 일반 goal `33` 로 promote
    가능, 아니면 직접.
  - 프론트엔드 — 개요 페이지 렌더 = **claude-owned 위임 goal**
    (presentation). 백엔드 계약이 GREEN 이 된 뒤 위임.
- finding 의 Acceptance signal 그대로 확인.

### Tier 2 — Spec/CLI 갭 (구체적, 닫기 쉬움)

**3. `docs/findings/2026-05-21T1856-cli-spec-gaps.md`**

- spec 약속했으나 미라우팅된 CLI 표면 4종: `lock release` 의
  `--format=agent`; `merge resolve` public conflict setup; `vspec --help`
  그룹핑; `vspec help <command>`. Goal 9 가 누락 verb 는 이미 채움.
- **직접 작업** (필요시 CLI goal 로 묶어 promote). 각 항목 RED/GREEN.
- `merge resolve` public conflict honest setup 은 test 인프라에 막힐 수
  있음 — 막히면 그 항목만 finding 에 "blocked on test infra" 로 남기고
  나머지 닫음 (`partial`).

### Tier 3 — 깊은 안전 큐 (하룻밤을 채우는 본체)

**4. `docs/findings/2026-05-23T1700-dogfood-followups.md` (partial, P2)**

- ~18 open item (A4–A15/B1–B6/H1–H3). finding 본문이 advisory 그룹으로
  묶어둠 (self-teaching CLI / doctor·status / project·session context /
  CLI dispatcher / API contracts / heuristics / test isolation).
- **직접 작업, 그룹 단위로** — 한 그룹 = 한 묶음의 RED/GREEN 커밋들.
  닫은 item 마다 status_notes 에 "CLOSED (commit/gate)" 추가. 그룹 사이
  사이 `resolved: partial` 유지, 전부 닫히면 `true`.
- 어떤 item 이 design/scope 결정을 요구하면 그것만 남기고 진행.

**5. `docs/findings/2026-05-23T1700-gates-over-coupling.md` (partial, P1)**

- goals 7–29 의 `.gates.sh` 를 finding 처방대로 trim (rigor enum +
  negative-codebase invariant + doc 존재만 남기고, convention check 는
  **테스트로 이전**). finding 본문의 migration 순서를 따를 것.
- ★ **특수 처리 — prior gate 수정**: 이건 prior goal 의 gate 를 약화하는
  변경이지만 **이 finding 이 권한 부여원이고, case (b)** (enforcement 를
  테스트로 이전; gate 삭제 아님). 각 trim 커밋은:
  1. gates-over-coupling finding 을 commit message 에 인용,
  2. 제거하는 convention check 에 **대응 테스트가 존재함을 먼저 확인/
     추가** (then trim),
  3. trim 후 `bash scripts/completion-check.sh` 가 여전히 GREEN.
  - 테스트 이전 없이 gate 만 지우지 마라 (그건 Forbidden action #1).

**6. `docs/findings/2026-05-23T1836-route-test-coverage-honesty.md` (partial, P2)**

- Phase 1(결정 doc + exemplar) 은 닫힘. **Phase 2** = `tests/unit/http/
*-routes.test.ts` (~80개) 를 unit-mock → integration(`app.inject` via
  server.ts) 패턴으로 마이그레이션. per-file ~1h, risk 순.
- **직접 작업, per-file.** 가장 안전한 무한 필러 — 늦은 밤 시간 채우기에
  적합. 마이그레이션한 파일 수를 status_notes 에 카운트로 갱신.
  Phase 2 전부는 multi-week 라 하룻밤에 다 못 닫혀도 OK → `partial` 유지
  - "Phase 2: N/80 migrated" 표기. **threshold/coverage 인하 금지.**

### Tier 4 — 작은 doc 작업 (마지막 마무리)

**7. `docs/findings/2026-05-21T1642-harness-spec-debt.md` (partial)**

- item 1: `docs/goal-design.md §5` taxonomy 에 case (d) "documentation
  lag" 추가. item 2: `harness-engineer.md` Step 4 에 "out-of-scope but
  concrete" tiebreaker 추가. (item 3/4 는 deferred — out of scope.)
- **직접 작업** (순수 doc). 닫은 item 만 status_notes; 3/4 는 open 유지
  → `partial`.

---

## Reference snapshots — 작업 대상 아님 (force-close 금지)

다음은 `kind: snapshot`/`append-only-log` 으로, "resolved" 대상이
아니다. 자식 work item 을 통해 닫히며, 스냅샷 자체는 reference 로 둔다.
**`resolved: true` 로 뒤집지 마라.**

- `docs/findings/2026-05-25T1447-activation-wow-project-overview.md` —
  WOW 분석/결정 rationale. 자식 = F1/F2/F3/F4. F1·F2 닫히면 status_notes
  에 진행만 기록.
- `docs/findings/2026-05-22T1632-dogfood-snapshot.md` — 2026-05-23
  dogfood frozen 스냅샷. 자식 work = dogfood-followups (#4).
- `docs/findings/2026-05-21T1635-perf-log.md` — append-only harness perf
  로그. 작업 대상 아님.

---

## Out of scope (본 cycle 에서 손대지 마라)

발견해도 **fix 시도 금지** — 별도 finding 등록 또는 기존 finding 에
note 만. 무인 실행에서 위험/불확실/유료인 항목들이다.

- **spec-impl-audit Gap B** (`docs/findings/2026-05-24T1100-spec-impl-
audit.md`) — UC-022 SOFT lock 다중성. **모델 변경 + design decision**
  필요 (lock-store port + Prisma 제약 + 모든 caller). Gap A·C 는 이미
  CLOSED. 이 finding 은 `partial` 유지, Gap B 는 OPEN. → dedicated goal
  (다음 cycle).
- **F3 persona-dogfood-harness** (`…2026-05-25T1516`) — `claude -p`
  페르소나 dogfood **관찰 rig**. 무인 실행 중 **유료 headless 에이전트를
  자율 spawn** 하는 건 비용/예측불가 → 금지. 결과 해석도 사람 필요.
- **F4 gap-a-authoring-assist** (`…2026-05-25T1520`) — 로드맵, **F3 측정
  결과에 의존** + 설계 필요. XL. 스코프 확정 불가 → 손대지 마라.
- **shared-api-contracts** (`…2026-05-22T1628`) — `packages/contracts` +
  Zod + 전 boundary 마이그레이션. **대형 구조 리팩터** — 반쯤 하다 두면
  chain 이 깨진다. 무인 실행에 부적합 → dedicated cycle.
- **route-test Phase 2 전량 완주 강박 금지** — 80개를 하룻밤에 다 닫으려
  무리하지 마라. risk 낮은 것부터, 닫은 만큼만 정직하게 카운트.

---

## Finding 처리 절차

각 finding 마다:

1. **읽기**: frontmatter (`resolved`/`priority`/`kind`/`related`/
   `status_notes`) → TL;DR + Acceptance signal + (있으면) Gate/Migration
   plan. `partial` 이면 status_notes 의 OPEN item 만. `kind: snapshot/
append-only-log` 이면 작업 대상 아님(위 Reference 섹션).

2. **판단 — promote / delegate / direct**:
   - **claude 위임** (`## Delegation` owner: claude): UI/UX·카피·디자인
     (주로 `apps/web`). F1, F2-프론트. `docs/claude/delegation.md` 계약
     준수, cwd 가 유일 경계.
   - **goal promote** (다음 빈 번호 `32`, `33`, …): 셋 다 만족 시 —
     (a) gate 검증 가능한 universal invariant, (b) multi-step RED/GREEN,
     (c) prior goal 과 별개. 최소 gate 는 아래 "Goal 화 시 주의점".
   - **직접 작업**: 위 아니면. guidelines/goal-iteration.md Phase 4 TDD.

3. **실행**: RED → GREEN → REFACTOR, 각 phase 한 커밋. promote 했다면
   각 phase commit 직후 `bash scripts/active-check.sh` 로 chain 점검.

4. **검증**: finding 의 Acceptance signal 그대로 실행 →
   `bash scripts/completion-check.sh` 가 ALL_DONE 인지. 다른 goal 이
   깨졌으면 STOP, `docs/state/blockers.md` 기록.

5. **마무리**: frontmatter 업데이트 (완료 `resolved: true` +
   `resolved_by: <sha>`; 부분 `resolved: partial` + status_notes 의 OPEN
   item). finding 본문 끝에 "## Resolution" 섹션 append (어떤 커밋이 어떤
   acceptance signal 을 flip 했는지). commit + push.

---

## Goal 화 시 주의점 (`docs/goal-design.md` §1.5 / §5 / gates-over-coupling 종합)

### 최소 gates.sh

**금지 패턴** (gates-over-coupling 표):

- 함수 본문 grep / 타입 필드 grep / 테스트 제목 grep / 특정 경로 파일
  존재 강제 / 마크다운 헤딩 grep / findings bullet 제거 추적.

**허용 패턴**:

- **Rigor 메커니즘**: 모든 goal 의 마지막 게이트로 항상 포함
  (`scripts/check-gate-rigor.sh "$ROOT/goals/<n>-<name>.md" …`).
- **Negative universal grep**: "codebase 어디에도 X 없음" (F1 의 raw
  헤더 0건 gate 가 이 케이스).
- **구조 앵커**: 후속 routing 에 필요한 문서/파일 존재만.

### 회의적 휴리스틱

**"이 invariant 가 깨지면 어떤 테스트가 빨갛게 되는가?"**
답이 있음 → gate 에서 빼라(테스트가 잡는다). 답이 없음 → gate 적절.

### Prior goal gate 수정 (case b/c)

- prior goal 의 gate 를 약화/삭제해야 하면: 새 goal `.md` 에
  `## Supersedes` 명시(case c) 또는 enforcement 이전임을 PR 메시지에
  명시(case b). **선언 없이 prior gate 삭제 절대 금지** (§5).
- 본 cycle 의 #5 gates-over-coupling 은 case (b) (테스트로 이전) — 위
  Tier 3 #5 특수 처리 규칙을 따른다.

---

## Forbidden actions (HARD STOP — `docs/state/blockers.md` 기록 후 다음으로)

1. **Prior goal invariant 약화** — §5 케이스 (b)/(c) 미준수 변경 금지.
   `## Supersedes`/enforcement-이전 선언 없이 prior `.gates.sh`/`.md`
   손대지 마라. (#5 의 sanctioned trim 은 예외 — 규칙 준수 시.)
2. **Hook 우회 금지** — `--no-verify`, `--no-gpg-sign` 등 금지. fail 하면
   원인 디버그.
3. **테스트/lint 비활성화 금지** — `.skip()`/`xit()`/`it.skip()` 추가
   금지, 새 `eslint-disable`/`@ts-ignore`/`@ts-expect-error` 금지. 깨진
   동작이면 _코드_ 를 고쳐라.
4. **Coverage threshold 인하 금지** — `vitest.config.ts` baseline
   (75/80/80/80) 손대지 마라.
5. **3 TDD 사이클(또는 위임 3 라운드) 무진전** — blocker append 후 다음
   target. promote 한 goal 이면 루프 알고리즘의 ★ DEADLOCK 가드(promotion
   back out)를 따라 chain 을 GREEN 으로 되돌릴 것.
6. **Chain 이 예상 못한 방식으로 깨질 때** — `.state/active-goal` 이 work
   plan 과 안 맞거나 새로 fail 하는 goal 이 생기면 STOP, blocker 기록.
7. **Destructive git 금지** — `push --force`/`-f`, `reset --hard`,
   `checkout -- .`, `clean -f`, `rebase -i`, `filter-branch`. **main 으로
   force push 절대 금지.**
8. **`.env`/credentials/대용량 산출물 commit 금지** (`/commit` secret-scan).
9. **사용자 환경 영향 금지** — 호스트 설정/`~/.vspec/config.json` 덮어쓰기
   등 금지. 작업은 워크트리 안에서만.
10. **Out of scope 항목 작업 금지** — Gap B, F3(유료 에이전트 spawn), F4,
    shared-api-contracts. 발견해도 등록만.

---

## Commit / push 프로토콜

`/commit` skill + `guidelines/goal-iteration.md` Phase 4:

- TDD 각 phase (RED/GREEN/REFACTOR) — **한 phase 한 commit**.
- finding/sub-item 완료 후 마무리 commit + `git push origin main`.
- **브랜치 `main` 유지** (별도 branch 생성 금지). 시작 시 현재 브랜치
  확인 — 우연히 다른 곳으로 옮겨가지 마라.
- 커밋 메시지 끝에 Co-Authored-By (codex 자신). HEREDOC 으로 전달.
- **Push 실패 시**: 원인 디버그 (네트워크? remote rejection?). retry 1회
  OK. 두 번째도 실패하면 blocker.

---

## 진행 상황 추적

- `docs/state/progress.md`, `docs/state/next-task.md` 는
  `scripts/update-state.sh` 자동 생성 — **손대지 마라**.
- `docs/state/learnings.md`, `docs/state/blockers.md` 는 append-only.
  - learnings: "이 finding 처리하며 발견한 의외의 점" 한 줄.
  - blockers: forbidden action 트리거 / 3-사이클 stuck / promotion
    back out 시.

---

## 검증 — 진짜 끝났는지

종료 직전:

```bash
# 1. in-scope target findings 상태 점검
for f in \
  docs/findings/2026-05-25T1503-web-viewer-de-jargon.md \
  docs/findings/2026-05-25T1511-project-overview-blueprint.md \
  docs/findings/2026-05-21T1856-cli-spec-gaps.md \
  docs/findings/2026-05-23T1700-dogfood-followups.md \
  docs/findings/2026-05-23T1700-gates-over-coupling.md \
  docs/findings/2026-05-23T1836-route-test-coverage-honesty.md \
  docs/findings/2026-05-21T1642-harness-spec-debt.md \
; do
  awk '/^---$/{c++; if(c==2)exit} /^resolved:/{print FILENAME": "$0}' "$f"
done

# 예상:
#   F1 web-viewer-de-jargon      → resolved: true   (goal 32 GREEN)
#   F2 project-overview-blueprint→ true 또는 partial (백엔드 닫고 프론트 위임 진행도에 따라)
#   cli-spec-gaps                → true 또는 partial (merge setup blocked 시)
#   dogfood-followups            → partial (큰 큐 — 닫은 만큼) 또는 true
#   gates-over-coupling          → partial (goal 별 trim 진행도) 또는 true
#   route-test-coverage-honesty  → partial ("Phase 2: N/80 migrated")
#   harness-spec-debt            → partial (item 1·2 닫고 3·4 deferred)

# 2. chain green
bash scripts/completion-check.sh; echo "exit: $?"   # 0

# 3. 작업 트리 clean
git status --short    # 비어야 함

# 4. push 완료
git log @{u}..HEAD --oneline   # 비어야 함
```

다 통과하면 `docs/state/learnings.md` 에 append:

```
- 2026-05-26 overnight-sweep: closed N findings / M sub-items
  (Tier1 WOW F1[+F2], Tier2 CLI gaps, Tier3 dogfood/gates/route-test
  queues). Out of scope: Gap B, F3, F4, shared-contracts. Open blockers: K.
  See git log for details.
```

TERMINATE.
