---
cycle: 260603-01
title: Findings sweep — honesty · contracts tail · spec-mvp lessons (L1/L2) + trust-gap sprint + meta audit
authored_at: 2026-06-03T03:20:00+09:00
started_at: 2026-06-03T03:37:40+09:00
completed_at: 2026-06-03T05:10:40+09:00
status: complete
---

> **Run plan (2026-06-03).** `docs/findings/` 의 미해결 finding 을 9개 병렬
> 조사로 코드와 대조 검증했다. 대부분은 직전 cycle(260602-01)이 이미 명시적으로
> 닫았거나 out-of-scope 로 미뤘고(그 결정 존중), 남은 **무인-안전·결정-잠금**
> main-repo 작업은 두 sprint 다: **(2A)**
> `2026-06-02T1827-spec-mvp-lessons-for-main.md` 의 **L1(한글-aware verb-phrase
> 검증 버그)+L2(typed self-teaching error contract)** — spec-mvp 재작성에서
> 역수입한, 이 repo(apps/api·apps/cli) 대상 제품 수정. L1 은 contained 한 실제
> correctness 버그라 quick-win 으로 먼저. **(2B)**
> `2026-06-02T1804-spec-code-verification-trust-gap.md` 의 **T1→T2→T3→T4** — 4개
> reproducer claim 재확인·작업 0건·7 touch point 정확, 아침까지 도는 **deep
> backstop**(직전 cycle 의 route-test 36파일에 해당). 그 앞에 (Tier 0) 전 finding
> status_notes 정직성 정정 1 work-unit, (Tier 1) shared-api-contracts read-path
> 꼬리 3-cast 안전 슬라이스 1 work-unit 을 깔아 확실한 quick win 을 먼저 잠근다.
> work-unit 2개마다 메타 감사.

# 260603-01 — Findings sweep: honesty · contracts tail · spec-mvp lessons + trust-gap sprint + meta audit

**목표**: 2026-06-03 시점 `docs/findings/` 의 미해결 finding 을, **무인 실행에
안전한(decision-locked)** 항목부터 우선순위/의존성 순으로 닫는다. 안전치 않은
항목(제품 결정 필요·cross-repo·유료 에이전트·blast-radius)은 **건드리지 않고**
frontmatter status_notes 만 정직하게 정정한다. **work-unit 2개마다 메타 시스템
감사**를 돌려 하니스/lint/테스트 코드를 점검하고 개선을 처리한다.

본 문서를 codex/claude 에게 **무한 루프 모드**로 넘긴다:
`/goal cycles/260603-01-findings-trustgap-sprint.md 의 내용을 모두 완수할
때까지 작업해줘.`

이것은 **무인(set-and-sleep) 실행**이다. 설계 원칙: 결정이 끝난(높은 확실성)
작업을 먼저, 깊고 안전한 대량 큐(trust-gap T1–T4)를 backstop 으로, 매 work-unit
commit + push **(브랜치 `main`, 직접 push 허용 — 사용자가 코드 전수 검토 불가함을
양해함)**. **조기 종료 절대 금지** — 막히면 blocker 기록 후 다음 target.

## 작업 시작 전 반드시 읽을 것

- `docs/goal-design.md` — harness 설계 (특히 §1.5 최소 gate 패턴, §5
  immutability/case (a)/(b)/(c)/(d))
- `guidelines/goal-iteration.md` — iteration 프로토콜 (TDD, commit cadence, Phase 4)
- `guidelines/meta-system-audit.md` — **메타 감사 렌즈 (Q1–Q8, 판정 프레임).
  체크포인트의 source of truth**
- `prompts/check-test-codes/*.md` — 테스트 점검 철학(실프롬프트 이력): (1) 구현
  overfit 테스트 탐지·제거, (7) unit 이 fetch 를 과검증하는 것 자체를 의심,
  (8~10) payload/schema 검증은 테스트가 아니라 `@vooster/contracts` 로 이전,
  (12) "모든 route 대상". 메타 감사 시 이 렌즈를 testcode 점검에 적용.
- `.claude/skills/commit/SKILL.md` (또는 `/commit` skill) — 커밋 규약, secret-scan
- `docs/findings/AGENTS.md` — finding frontmatter schema
  (`resolved: false|"partial"|true`, `priority`, `resolved_by`, `kind`,
  `status_notes`, `related`) + honesty rules
- `docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md` — **척추
  중 하나(trust-gap, Tier 2B)**. T1 의 7개 touch point 가 구현 레시피.
- `docs/findings/2026-06-02T1827-spec-mvp-lessons-for-main.md` — **나머지 척추
  (spec-mvp→main lessons, Tier 2A)**. L1(한글-aware 검증)+L2(typed error
  contract)가 promote 대상, L4(analyze-session skill)는 inline, L3/L5/L6 은
  deferred. 직전 `2026-06-02T1807`(형제 repo 로 잘못 프레이밍됨)을 supersede 하며
  1807 은 트리에서 삭제됨(commit 70296a8, git history 잔존).
- 직전 cycle `cycles/260602-01-findings-contracts-route-test-sweep.md` 의
  **Out of scope** 절 — 거기서 결정-잠금으로 미룬 항목(A14 verbs, typed-client
  layer, T1-4 unroutable suggestions, F3, F4, merge public setup)은 **본 cycle
  에서도 그대로 out-of-scope**. 어제 같은 워크플로우가 내린 결정을 뒤집지 말 것.

## 시작 상태 (2026-06-03, 검증됨)

- chain **GREEN** (`.state/active-goal == ALL_DONE`).
- 최고 goal 번호 `34` → 다음 빈 번호 **`35`**.
- 작업 브랜치 **`main`** (별도 branch 생성 금지, `origin/main` 으로 push).
- HEAD 은 user 의 `70296a8` 을 포함(1807 삭제 + 1827 추가). 1807 은 더 이상
  트리에 없음 — 1827 이 후속(이 repo 대상).
- 병렬 조사로 각 finding 실상을 코드 대조 검증함(아래 Target 분류 근거).

---

## 루프 알고리즘

```
  step 0 — 최초 1회 (루프 진입 전):
    이 문서(cycles/260603-01) frontmatter 갱신:
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
    한 work-unit 완료 = {Tier 0 honesty pass 1건 | contracts cast 슬라이스 1건 |
      1827 한 lesson(L1/L2) 또는 L4 skill | trust-gap 한 ticket(T1/T2/T3/T4)
      또는 그 sub-slice 1건 | 메타 감사가 만든 개선 1건 완료} 중 하나.
    완료 시:
      → 해당 finding frontmatter/status_notes 갱신, commit + push
      → audit_counter += 1
      → if audit_counter % 2 == 0:  ★ 메타 감사 체크포인트 (아래 절차) 실행
      → step 1

  step 3 — 소진 확인:
    Tier 0/1 in-scope + 1827 L1/L2/L4 가 처리됐고 trust-gap T1–T4 까지 처리
    가능한 만큼 처리했으면:
      → TERMINATE
    (1827 L1/L2 를 quick-win 으로 먼저, trust-gap sprint 가 사실상 아침까지의
     무한 filler. 다른 모든 in-scope 가 닫힌 뒤에도 시간이 남으면 T1→T2→T3→T4 를
     계속 전진. 멈추는 건 종료 조건이 모두 충족될 때만.)
```

종료 조건 (셋 다 만족):

1. Tier 0 honesty pass 완료 + Tier 1 contracts 꼬리 처리 + 1827 L1/L2/L4 처리
   - trust-gap 이 가능한 만큼 전진(각 ticket `resolved`/명시적 deferred).
2. `bash scripts/completion-check.sh` exit 0.
3. `git status --short` 비어 있고 `git log @{u}..HEAD` 비어 있음 (push 완료).

종료 시: 본 문서 frontmatter `completed_at` 기입, `status` 를
`complete`/`partial`/`aborted` 로 갱신. `docs/state/learnings.md` 한 줄 요약
append. → commit + push.

**막혀도 종료하지 마라.** 한 target stuck → blocker 기록 → 다음 target.
main-repo sprint backstop(1827 · trust-gap)이 남아 있는 한 할 일은 항상 있다.

---

## Target (실행 순서)

### Tier 0 — Honesty pass (가장 먼저, 빠름, work-unit 1개)

미해결 finding 들의 status_notes 를 코드로 재검증·정정한다
(`guidelines/meta-system-audit.md` Q6, P8 — 검증자를 검증). 아래는 9개 병렬
조사로 확정된 각 finding 의 정직한 현재 상태이며, 이 work-unit 에서 각
frontmatter 에 반영한다. **단일 commit** 으로 묶어 처리.

- **`2026-05-25T1447-activation-wow-project-overview.md`** (P1, `kind: snapshot`)
  — F1(`web-viewer-de-jargon`)/F2(`project-overview-blueprint`)가 goal 32/33 으로
  **이미 ship 됨**. F3/F4 는 독립 child finding. → `kind: snapshot` 이므로
  **`resolved: true` 로 강제하지 않음**(Forbidden). status_notes 에
  "F1 shipped via goal 32, F2 via goal 33; F3/F4 remain independent children
  (queued)" 추가. resolved 는 false(snapshot reference) 유지.
- **`2026-05-22T1632-dogfood-snapshot.md`** (`kind: snapshot`) — 이미 정확한
  status_notes 보유(open work 는 dogfood-followups 가 추적). 추가 정정 불요;
  손대지 않음(snapshot reference).
- **`2026-05-21T1856-cli-spec-gaps.md`** (`partial`) — 유일 잔여 = merge 충돌
  **public conflict setup**. 조사 결론: `change propose`/`change commit` 을
  conflict-setup 으로 쓸지 vs 전용 public endpoint 를 둘지는 **제품 결정 필요**
  → 무인 불가. status_notes 에 "2026-06-03 re-verified: only open item is public
  conflict setup; blocked on product decision (mechanism), still relies on
  /\_\_test/.../revisions; KEEP partial" 추가.
- **`2026-05-26T1234-agent-contract-followups.md`** (P2 `partial`) — item 1–3
  **CLOSED 재확인**(typos 8d27157/73dca0f, goal --actor name 5ce7ea5,
  format_version 통합 b0ef532). 잔여 4a/4c(unroutable `member`/`workspace`
  suggestions, option b)는 `suggestedNextActionSchema` 재사용 **17 schema + ~20
  printer + ~10 test** blast-radius → 무인 불가(직전 cycle 도 measured-defer).
  status_notes 정정: "items 1–3 verified CLOSED; 4a/4c reason-only conversion
  stays deferred to a reviewed slice (contract-wide loosening). KEEP partial."
- **`2026-05-25T1516-persona-dogfood-harness.md`** (F3, P1, `false`) — 유료
  `claude -p` 자율 spawn + 사람 판단(페르소나/임계값/해석/PII) 필요 → 무인 불가.
  직전 cycle 들도 명시적 out-of-scope. status_notes 에 "2026-06-03: re-confirmed
  unattended-unsafe (paid headless agent spawn + human-vetted oracle); keep
  queued, do not promote" 추가. resolved false 유지.
- **`2026-05-25T1520-gap-a-authoring-assist.md`** (F4, `false`) — **F3 결과에
  종속**, elicitation 설계 미확정 → 무인 불가. status_notes/note 에 "2026-06-03:
  blocked on F3 observation; doctor/verb-phrase foundations exist but design
  open; keep open" 추가.
- **`2026-06-02T1827-spec-mvp-lessons-for-main.md`** (P1) — 직전 `1807`(형제
  repo 로 잘못 프레이밍)을 supersede; user 가 1807 삭제 + 1827 추가(70296a8).
  1827 의 대상은 **이 repo**(apps/api·apps/cli·.claude) — in-scope. honesty pass
  대상이 아니라 **work tier(Tier 2A)에서 promote/처리**. 여기선 손대지 않음.
- **`2026-05-22T1628-shared-api-contracts.md`** / **`2026-05-23T1700-dogfood-followups.md`**
  — Tier 1 / out-of-scope 에서 별도 처리(아래). 이 honesty pass 에서는 손대지 않음.

→ 한 work-unit, single commit `docs(findings): honesty pass — re-verify status_notes (cycle 260603-01)`.

### Tier 1 — 작은 결정-잠금 직접 작업 (high certainty, work-unit 1개)

**T0-contracts: `2026-05-22T1628-shared-api-contracts.md` — CLI read-path 꼬리 3-cast**

- 현황(검증됨): CLI 에 남은 hand-rolled `.body as <Type>` cast 3곳:
  1. `apps/cli/src/commands/impact.ts:27-31,131` — local `RevisionListResponse`
     → `packages/contracts/src/revision.ts` 의 `revisionHistoryResponseSchema`.
  2. `apps/cli/src/commands/status.ts:75` — `.body as SessionListResponse`
     → `sessionListResponseSchema` parse (타입은 이미 contracts 재노출).
  3. `apps/cli/src/application/auto-export.ts:20-23,31` — local `SyncPullResponse`
     → `packages/contracts/src/sync.ts` 의 `syncPullResponseSchema`.
- 작업: 각 site 에서 local 타입 정의 제거 → 해당 contracts schema 로 `.parse()`.
  세 곳 모두 read-side, 신규 contract 불요, route 변경 불요. 패턴은 이미 마이그레이션된
  session/change/usecase 도메인을 따름.
- ★ 주의(직전 cycle 의 deferral 존중): 직전 cycle 은 이걸 "typed-client tail"로
  **batch-defer** 했다. 본 cycle 은 typed-client **전체 레이어**(47 커맨드)는 여전히
  out-of-scope 로 두고, **이미 schema 가 존재하는 read-path 3-cast 만** 안전 슬라이스로
  닫는다(테스트가 커버). 이걸로 read-path cast 잔여가 0 이 됨.
- 검증: `pnpm exec vitest run apps/cli` (또는 관련 e2e) + `completion-check.sh` exit 0.
  실제 API 응답 shape 와 parse 가 호환되는지 테스트로 확인(P8). parse 가 깨지면
  **즉시 되돌리고** status_notes 에 "3-cast slice deferred (parse mismatch)" 기록.
- 완료 시: shared-api-contracts status_notes 에 "2026-06-03: CLI read-path
  3-cast (impact/status/auto-export) migrated to contracts parse — no `.body as`
  casts remain on read paths" 추가. `resolved` 는 **partial 유지**(typed-client
  write layer + unroutable-suggestions 잔존).

### Tier 2 — 결정-잠금 main-repo sprints (quick-win-first → deep backstop)

두 sprint 모두 이 repo 의 제품 코드를 건드리며 enumerable gate 를 갖는다.
**2A(1827 L1/L2)를 quick-win 으로 먼저**, **2B(trust-gap T1–T4)를 아침까지 도는
deep backstop** 으로. L4(skill)는 inline, L3/L5/L6 은 deferred(Out of scope).

#### Tier 2A — `2026-06-02T1827-spec-mvp-lessons-for-main.md` (spec-mvp→main lessons)

spec-mvp 재작성 commit 들에서 역수입한, 본 repo 가 아직 내재화 못한 lesson.
1827 의 promotion judgment 그대로: **L1+L2 promote(goal chain), L4 inline,
L3/L5/L6 deferred**.

- **goal 35 — L1: 한글-aware verb-phrase 검증 + `spec_language`** _(실제 correctness 버그)_
  현황(검증됨): `apps/api/src/application/verb-phrases.ts:1-44` 가 English-only
  verb list + `^[A-Za-z]+`(ASCII) 매칭 → 한글 제목(`주문을 생성한다`)이 **절대
  매칭 안 되고 silent fail**. doctor 메시지도 English-only
  (`apps/api/src/application/doctor.ts:114-149`), `spec_language` 개념 부재. 제품
  ICP 가 한국어(`apps/www` 전부 한국어)이므로 이는 i18n 이 아니라 correctness 버그.
  작업: spec-mvp 의 한글-aware verb-phrase + quality heuristic 을 포팅,
  `spec_language`(default `ko`)가 선택하게. RED(한글 verb-phrase 제목이 검증
  통과하는 실패 테스트) → GREEN.
  gates(§1.5 최소): (a) 한글 verb-phrase 제목이 검증 통과, (b) doctor 가 한글
  산문을 false-flag 안 함, (c) `grep "spec_language" apps/` non-empty.
  - check-gate-rigor 마지막 게이트. acceptance(finding L1) 그대로.

- **goal 36 — L2: typed self-teaching error contract** _(에이전트 recovery)_
  현황(검증됨): 12-code enum 존재(`apps/cli/src/domain/error-codes.ts:3-16`)하나
  **HTTP-status + problem-title 문자열 매칭**(`error-codes.ts:26-41`, 예: 리터럴
  `"Use case title should be a verb phrase"` 매칭)으로 도달 — 메시지 리워딩/한글화
  (L1)에 깨짐. zod 실패는 **generic** `problem(400, "Invalid use case request")`
  (`apps/api/src/http/usecase-routes.ts:81-83`)로 떨어져 _어느 필드_·_허용값_
  미고지. 작업: zod 실패를 offending field + allowed values 를 담은 coded
  envelope 로 매핑; `error.code` 를 title-string 매칭이 아니라 에러 출처에서 도출.
  gates(§1.5): (a) 잘못된 usecase payload → 필드명 포함 coded error, (b)
  `error-codes.ts` 의 problem-title 리터럴 수가 0 방향으로 축소.
  - check-gate-rigor 마지막 게이트. acceptance(finding L2) 그대로.

- **L4 — `analyze-session` dogfood skill 포팅** _(inline, goal 아님)_
  `.claude/skills/analyze-session/` 을 이 repo 로 포팅, "internalize the
  direction" step 을 `docs/06-api-contract.md`/`docs/07-cli-spec.md` 로, friction
  catalog 을 apps/\* contract 로 적응. acceptance: 스킬 디렉터리 존재. (외부 세션
  digest 는 human-driven — 스킬만 포팅하고 1회 digest 는 deferred note.)
  ★ skill 추가는 universal-invariant gate 가 아니므로 goal 승격 안 함(direct fix).

- **L3/L5/L6 — deferred (Out of scope 참조).**

1827 처리: L1/L2 goal GREEN 시 status_notes 에 "L<n> CLOSED via goal <m> (<sha>)",
`resolved_by` SHA. L1·L2·L4 닫히고 L3/L5/L6 만 남으면 `partial` + 잔여 명시.
(finding 삭제 금지 — "promoted to goal 35–36" 기록.)

#### Tier 2B — trust-gap sprint (deep backstop, 무한 filler, 아침까지 전진)

**`docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md` —
spec↔code 검증 trust gap (P1).**

조사 결론: 4개 claim 전부 재확인, 작업 0건, T1 의 **7개 touch point 가 현재 코드와
정확히 일치**. 이 finding 은 goal chain 으로 **promote** 한다(§1.5/§5 만족: 하드한
enumerable gate — round-trip lossless, doctor unlinked count, 그리고 T2 의
10-run 결정성 criterion). T5(semantic LLM)는 **무인 금지·promote 금지**.

승격 계획 (한 ticket = 한 goal, chain-blocking core 먼저):

- **goal 37 — T1: spec step ↔ code/test traceability link (`implements`)**
  finding 의 7 touch point 그대로 구현:
  1. `apps/api/prisma/schema.prisma` `model Step` 에 `implements String[] @default([])`
     (invokes 옆). 마이그레이션 1개.
  2. `apps/api/src/domain/entities/step.ts` `StoredStep` 에 `implements: string[]`.
  3. `apps/api/src/infrastructure/prisma-signup-mappers.ts` — `storedStep`(:243),
     `stepData`(:682), `stepUpdate`(:696) 에 `implements` 전달.
  4. `packages/contracts/src/scenario.ts` — `stepStoredResponseSchema`(:56-63)에
     `implements: z.array(z.string()).default([])`; `stepPatchRequestSchema`(:19-25)에
     ref 형식(`path` 또는 `path:symbol`) `.refine()` 추가 → "malformed link → exit 2"
     진입점.
  5. `apps/api/src/application/markdown-invocations.ts` — `_(includes: …)_`
     parser/serializer 쌍을 `_(implements: …)_` 쌍으로 복제;
     `apps/api/src/application/markdown-renderer.ts:162` 에서
     `invocationAnnotation(...)` 뒤에 `implementsAnnotation(step.implements)` 추가.
     parse↔serialize inverse 가 round-trip-lossless 를 구조적으로 보장.
  6. content hash: `revisionContentHash`(`prisma-signup-mappers.ts:397`)는
     `sha256(JSON.stringify(snapshot))` 이므로 (2)(3) 가 snapshot 에 `implements`
     를 실으면 자동 해시. snapshot builder 가 `implements` 포함함을 단언하는 테스트 1개.
  7. `apps/api/src/application/doctor.ts` — 빈 `implements` step 수를 세는 check
     (`id: "steps.unlinked"`) 추가.
     gates(§1.5 최소): (a) step 이 `implements` 보유 가능, (b) export markdown /
     pull / push round-trip lossless, (c) `doctor` 가 unlinked step 카운트,
     (d) malformed link → exit 2. + `check-gate-rigor.sh` 마지막 게이트.
     acceptance(finding):
  - [ ] step 이 `implements: ["tests/UC-013.feature:scenario_login","src/auth/login.ts"]` 보유
  - [ ] export/pull/push round-trip 무손실
  - [ ] unlinked step 쿼리 가능(doctor 카운트)
  - [ ] malformed link → exit 2.

- **goal 38 — T2: `vspec verify [<KEY>]` — 결정적 traceability check**
  새 `apps/cli/src/commands/verify.ts`(`diff.ts`/`impact.ts` 템플릿). 두 순수 단계:
  (a) resolve — 각 `implements` ref 를 working tree 에 대조(file→존재,
  `path:symbol`→symbol grep/AST, test-ID→test list), (b) run — `--test-cmd` spawn
  후 exit code 만 읽음(Vooster 는 test 출력 해석 안 함). 결정성: 출력 정렬(step_number,
  ref), timestamp/random/map-order 누수 없음.
  gates(§1.5): exit 0(all linked+exist) / exit 1(broken link) / exit 7(unlinked
  step) / **10-run 동일 결과(`for i in $(seq 10); do vspec verify; echo $?; done |
sort -u | wc -l` == 1)** ← 가장 중요한 hard gate / test 실행은 위임(`--test-cmd`).
  acceptance(finding) 4개 그대로.

- **goal 39 — T3: CI gate adapter (GitHub Action)** (T2 의존)
  `action.yml` + 복붙용 `.github/workflows/vspec-verify.yml`(`vspec verify` 실행).
  exit 0→pass / 1→fail / 7→config. broken link/failing test 를 PR comment 또는
  Checks API 로 노출. `apps/cli/src/commands/init.ts` 가 옵션으로 workflow yml 생성.
  cloud 비의존(T2 가 순수 함수면 자동).

- **goal 40 — T4: "spec drift" 정직한 정의 + 랜딩 카피 정정** (T2 의존)
  `verify --format=agent` 가 `{ drift: [{ kind: "broken_link"|"failing_test"|
"unlinked_step", … }] }` 방출. 문서/랜딩에 "drift = 위 3개 결정적 조건"임을 명시.
  `apps/www/src/components/sections/HowItWorks.astro:18,78-81` 의 "자동 검증" 카피를
  link/test 기반 검증으로 재서술(semantic 함의 제거). `Onboarding.astro:103` 도 점검.

- **T5(semantic) — 본 cycle out-of-scope. promote/구현 금지.** note 만.

각 goal: RED→GREEN→REFACTOR(`guidelines/goal-iteration.md`), 매 step commit+push,
`completion-check.sh` exit 0 유지. T1→T2 가 chain-blocking core; T3/T4 는 T2 뒤
follow-on. 한 goal 이 3 TDD 사이클 무진전 → DEADLOCK 가드(promotion back out).

finding 처리: 각 ticket goal 이 GREEN 되면 trust-gap status_notes 에
"T<n> CLOSED via goal <m> (<sha>)" 추가, `resolved_by` 에 SHA. T1–T4 가 모두
닫히면 `resolved: true`; 일부만이면 `partial` + 잔여 명시. (finding 삭제 금지 —
"promoted to goal 37–40" 기록.)

---

## Finding 처리 절차 (work-unit 공통)

1. **읽기** — finding 전문 + 관련 코드. status_notes 의 주장을 코드로 대조(Q6).
2. **판단** — promote(goal) / delegate(claude-owned) / direct 중 택. Tier 0/1 +
   1827 L4(skill) 는 direct; 1827 L1/L2 와 trust-gap 은 promote(goal chain).
   promote 는 §1.5/§5 셋 다 만족할 때만.
3. **실행 (TDD)** — RED(실패 테스트 먼저) → GREEN(최소 구현) → REFACTOR.
4. **검증** — 해당 도메인 테스트 + `bash scripts/completion-check.sh` exit 0.
   acceptance signal 직접 재실행(P8).
5. **마무리** — finding frontmatter 갱신: 항목 1개 닫음 → status_notes 에
   "<item> CLOSED <date> (commit/file)" + `resolved_by` SHA. 잔여 OPEN 있으면
   `partial` 유지. 모든 in-scope item 닫힘 → `resolved: true`. 스냅샷/로그는
   닫지 않음(reference only).
6. **commit + push** (main). audit_counter += 1.

---

## ★ 메타 시스템 감사 체크포인트 (work-unit 2개마다)

`guidelines/meta-system-audit.md` 가 source of truth. 절차:

1. **대상 선정** — 최근 2 work-unit 이 건드린 하니스/테스트 표면 + 누적 의심 지점
   (긴 `.gates.sh`/`.next-task.sh`, overfit 테스트). 직전에 promote 한 goal(35+)의
   gates 가 있으면 우선.
2. **렌즈 적용** — 각 블록/테스트에 Q1–Q8:
   - Q1: 이 검사 없으면 어떤 _테스트_ 가 빨개지나? (잡으면 MOVE-TO-TEST/DELETE-W-DECL)
   - Q2: 의도인가 양식(grep/함수명/헤딩)인가? (양식 → TRIM)
   - Q3: 왜 이렇게 긴가? (LOC 예산 초과 → Q1·Q2 재적용)
   - Q6: resolved/green 주장을 재실행으로 검증했나?
   - Q7: 게이트 _약화_ 인가 _이전_ 인가? (선언·테스트 없는 삭제 → **HARD STOP**)
   - **테스트 코드 렌즈(`prompts/check-test-codes` 철학)**: 구현 overfit 테스트
     (정확한 `fetch(..., RequestInit)` 단언, 내부 호출 횟수 단언, 양식 결합) 탐지
     → 제거 또는 contracts/통합 패턴으로 이전. unit 이 payload/schema 를 과검증하면
     `@vooster/contracts` 가 잡게 이전.
   - ★ trust-gap 특화: T1 의 `implements` 가 `invokes` 패턴을 미러링하므로, 새
     테스트가 **markdown round-trip 무손실 + content-hash 포함 + doctor 카운트**라는
     관찰가능 행위를 검증하는지(구현 detail 아님) 확인. `verify` 결정성 게이트가
     양식(출력 문자열 grep) 아니라 **exit-code 안정성**을 보는지 확인.
3. **개선 처리** — 발견한 개선이:
   - 영속 universal invariant + multi-step + 별개 → goal 35+ 로 promote
     (§1.5 최소 gate, `check-gate-rigor.sh` 마지막 게이트). chain 으로 처리.
   - 단발 직접 수정 → direct fix + 테스트.
   - 제품에서 멀고 비싼 메타 작업 → DEFER(신규 finding, Q5).
4. **기록** — `docs/state/learnings.md` 에 감사 1줄 요약(무엇을 의심→판정→조치).
   defer 했으면 신규 `docs/findings/<TS>-*.md` 생성.
5. commit + push. 이 체크포인트는 work-unit 으로 카운트하지 않음.

> 감사가 "이상 없음"으로 끝나도 좋다 — P9: 반박을 한 번 세워 살아남는지 본다.
> 살아남으면 한 줄 근거를 learnings 에 남긴다.

---

## Out of scope (발견해도 fix 금지 — 이유 명시)

- **`cli-spec-gaps` merge-resolve public conflict setup** — 메커니즘 제품 결정 필요
  (`change commit` 재사용 vs 전용 endpoint). 무인 불가. partial 유지.
- **`dogfood-followups` A14 (27 planned verbs)** — 어떤 verb 를 MVP/beta 에 넣을지
  제품 스코프 결정(multi-sprint, beta-blocker 5 + product-scope 3 포함). 직전 cycle
  이 명시 out-of-scope. 그대로 queued, status_notes 만(Tier 0 에서 다루지 않으면
  손대지 않음).
- **shared-api-contracts typed-client 전체 레이어** — L 리팩터(~47 커맨드). 본 cycle
  은 read-path 3-cast 만. 나머지 deferred.
- **agent-contract-followups 4a/4c (unroutable suggestions, option b)** — contract-wide
  loosening(17 schema + 20 printer + 10 test). reviewed slice 필요. deferred.
- **`persona-dogfood-harness` (F3)** — 유료 헤드리스 에이전트 + human-vetted oracle.
  무인 불가. false 유지.
- **`gap-a-authoring-assist` (F4)** — XL 로드맵, F3 결과 의존, 미설계. open 유지.
- **`spec-mvp-lessons-for-main` L3/L5/L6** — L3(에이전트-first defaults + API
  problem 을 envelope error family 로 통합)·L5(canonical markdown round-trip
  normalize for sync/export)는 더 큰 contract/format 리팩터로, L1/L2 _뒤_ 별도
  scoped goal. L6(공유 `parseEnum` + section-level apply)는 opportunistic(P3).
  본 cycle 은 L1/L2/L4 만; L3/L5/L6 deferred.
- **형제 repo `vooster-spec-mvp` 자체 개선** — 1827 은 lesson 을 _main_ 으로
  역수입하는 것이지 형제 repo 를 고치는 게 아니다. 형제 repo 에 자율 커밋 금지
  (본 run 인가 범위 = vooster/main).
- **trust-gap T5 (semantic LLM check)** — 비결정적, 무인 금지. note 만.
- **스냅샷/로그 finding** (`perf-log`, `dogfood-snapshot`, `activation-wow`) — 강제
  종료 금지. reference 로 둔다(`kind: snapshot`/`append-only-log` → `resolved: true`
  금지).
- 위 항목을 작업 중 발견해도 고치지 말 것. 새 아이디어는 신규 finding 으로만 남긴다.

---

## Forbidden actions (HARD STOP)

- prior goal 의 게이트를 대응 테스트·`## Supersedes`(§5 case c)/enforcement-이전
  선언(case b) 없이 **약화/삭제** — 즉시 중단(`goal-design.md §5`).
- 게이트를 통과시키려 **검증을 약화**(P6). trim 은 "테스트로 이전"이지 "삭제"가 아님.
- `kind: snapshot`/`append-only-log` finding 을 강제로 `resolved: true` 로.
- trust-gap 의 결정적 게이트 안에 **LLM semantic 판단**을 넣음(T5 는 비-blocking·out).
- cross-repo: `vooster-spec-mvp` 등 다른 repo 에 자율 커밋/push.
- secret 커밋 (`.claude/skills/commit/SKILL.md` 의 secret-scan 준수).
- `main` 외 브랜치 생성(이 cycle 은 main 직접 push).

막히면: 3 TDD 사이클 무진전 → `docs/state/blockers.md` 기록 → 다음 target.
**절대 조기 종료 금지.**

---

## Commit / push 프로토콜

- `.claude/skills/commit/SKILL.md` 준수. Conventional Commits.
- 매 work-unit(또는 trust-gap step)마다 commit + `git push origin main`.
- 메시지 말미: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- push 전 `bash scripts/completion-check.sh` exit 0 확인(chain green 유지).

---

## 종료 / 검증

```
bash scripts/completion-check.sh; echo "exit:$?"   # 0 이어야
git status --short                                  # 비어야
git log @{u}..HEAD                                  # 비어야 (push 완료)
```

종료 시 본 문서 frontmatter `completed_at`+`status` 갱신, `docs/state/learnings.md`
한 줄 요약 append, 마지막 commit + push.
