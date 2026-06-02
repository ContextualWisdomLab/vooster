---
cycle: 260602-01
title: Findings closure — contracts tail, agent-envelope, route-test honesty + meta audit
authored_at: 2026-06-02T08:20:51+09:00
started_at: 2026-06-02T08:21:00+09:00
completed_at: 2026-06-02T09:25:39+09:00
status: complete
---

> **Run summary (2026-06-02).** Tier 0 honesty pass done. Tier 1: T1-1
> stakeholder-interest + T1-2 impact migrated to `@vooster/contracts`; T1-3
> agent envelope consolidated to a single `format_version: 1` (incl. goal-7
> gate §5 case (b) update); T1-4 unroutable-suggestions DEFERRED after
> measuring its contract-wide blast radius (17 schemas + many printers — see
> Out of scope). Tier 2: route-test Phase 2 finding CLOSED (`resolved: true`)
> — 33/37 mocked-unit route tests migrated to app.inject integration (the
> side-effect tail via uc-fixtures, asserting observable state not mocks), 4
> trimmed to documented HTTP-unreproducible defensive residuals. 4 meta-audit
> checkpoints ran (init-test overfit trim; gate-7.A2 KEEP rationale; migration
> honesty; rejected a form-coupled "integration importer" gate). Final
> verification: API 776 tests, CLI+contracts 276 tests, `completion-check`
> exit 0, all pushed to `main`. shared-api-contracts + agent-contract-followups
> remain `partial` (typed-client + reason-only suggestions deferred to reviewed
> slices). Terminated on the cycle's own conditions: all in-scope
> resolved/deferred, chain green, nothing left to push.

# 260602-01 — Findings closure: contracts tail · agent-envelope · route-test honesty + meta audit

**목표**: 2026-06-02 시점 `docs/findings/` 의 미해결 finding 중, **무인 실행에
안전하도록 설계가 잠긴(decision-locked)** 항목을 우선순위/의존성 순서대로 닫는다.
그리고 **work-unit 2개마다 메타 시스템 감사 체크포인트**를 돌려 하니스/lint/
테스트 코드를 점검하고 개선을 처리한다.

본 문서를 codex/claude 에게 **무한 루프 모드**로 넘긴다:
`/goal cycles/260602-01-findings-contracts-route-test-sweep.md 의 내용을 모두
완수할때까지 작업해줘.`

이것은 **무인(set-and-sleep) 실행**이다. 설계 원칙: 결정이 끝난(높은 확실성)
작업을 먼저, 깊고 안전한 대량 큐(route-test 36파일)를 backstop 으로, 매 work-unit
commit + push **(브랜치 `main`, 직접 push 허용 — 사용자가 코드 전수 검토 불가함을
양해함)**. **조기 종료 절대 금지** — 막히면 blocker 기록 후 다음 target. 할 일은
의도적으로 하룻밤보다 많게 깔아두었다(route-test 36파일은 사실상 무한 filler).

## 작업 시작 전 반드시 읽을 것

- `docs/goal-design.md` — harness 설계 (특히 §1.5 최소 gate 패턴, §5 immutability/case (a)/(b)/(c)/(d))
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
- 위임 goal 생성 시: `docs/claude/delegation.md` + `docs/claude/headless.md`

## 시작 상태 (2026-06-02, 검증됨)

- chain **GREEN** (`.state/active-goal == ALL_DONE`).
- 최고 goal 번호 `34` → 다음 빈 번호 **`35`**.
- 작업 브랜치 **`main`** (별도 branch 생성 금지, `origin/main` 으로 push).
- 직전 cycle `260527-01` 이 결정-잠금 finding 다수를 닫음. 이번 cycle 의 in-scope:
  (a) contracts 꼬리 도메인 2개, (b) agent-envelope follow-up 2개,
  (c) route-test Phase 2 backstop 36파일, (d) work-unit 2개마다 메타 감사가
  생성하는 개선 작업.
- 각 target 의 현황은 본 cycle 작성 전 코드와 대조해 검증함(아래 Target 의 분류 근거).

---

## 루프 알고리즘

```
  step 0 — 최초 1회 (루프 진입 전):
    이 문서(cycles/260602-01) frontmatter 갱신:
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
    한 work-unit 완료 = {finding 1건 closed | contracts 도메인 1개 마이그레이션 |
      route-test 파일 1개(또는 ≤5 파일 배치) 마이그레이션 |
      메타 감사가 만든 개선 1건 완료} 중 하나.
    완료 시:
      → 해당 finding frontmatter/status_notes 갱신, commit + push
      → audit_counter += 1
      → if audit_counter % 2 == 0:  ★ 메타 감사 체크포인트 (아래 절차) 실행
      → step 1

  step 3 — 소진 확인:
    모든 Tier 0/1 in-scope target 이 resolved/partial 이고 route-test Phase 2
    backstop 까지 처리 가능한 만큼 처리했으면:
      → TERMINATE
    (route-test 는 사실상 무한 filler 이므로, 다른 모든 in-scope 가 닫힌 뒤에도
     시간이 남으면 계속 마이그레이션. 멈추는 건 종료 조건이 모두 충족될 때만.)
```

종료 조건 (셋 다 만족):

1. 모든 Tier 0/1 in-scope target finding 이 `resolved: true` 또는 명시적 `partial`
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

미해결 finding 들의 status_notes "OPEN/CLOSED" 주장을 코드로 재검증·정정한다
(`guidelines/meta-system-audit.md` Q6, P8 — 검증자를 검증).

- 각 in-scope finding 의 status_notes 가 실제 코드 상태와 일치하는지 확인.
  이미 닫힌 item 을 OPEN 으로 두고 있으면 CLOSED 로 정정(닫은 커밋/파일 인용),
  거꾸로도 정정.
- 한 work-unit 으로 묶어 처리, commit + push.

### Tier 1 — 작은 결정-잠금 직접 작업 (high certainty 먼저)

**1. `docs/findings/2026-05-22T1628-shared-api-contracts.md` — stakeholder-interest 도메인**

- 현황(검증됨): `apps/api/src/http/stakeholder-interest-routes.ts` 가 route-local
  `interestRequestSchema` 사용 — `@vooster/contracts` 미경유. CLI 사용처:
  `apps/cli/src/commands/usecase.ts` (stakeholder-interests).
- 작업: `packages/contracts/src/stakeholder-interest.ts` 에 create/delete
  request + response 스키마 추가(actor/stakeholder 도메인 선례 따름). API 라우트와
  CLI 가 공유 스키마로 parse 하도록 전환. 기존 route-local 스키마 제거.
- 검증: 해당 도메인 e2e/통합 테스트 + `bash scripts/completion-check.sh`.
- 완료 시: shared-api-contracts status_notes 에 "stakeholder-interest domain
  CLOSED" 추가. resolved 는 partial 유지(CLI typed client + impact 잔존).

**2. `docs/findings/2026-05-22T1628-shared-api-contracts.md` — impact 도메인**

- 현황(검증됨): `apps/api/src/http/impact-routes.ts` 가 route-local `previewSchema`
  사용. `POST /v1/changes/preview` 의 impact 변종(payload 에 `proposed_change_content`
  / `proposed_change_path` 추가). CLI 사용처: `apps/cli/src/commands/impact.ts`.
- 설계 결정(본 cycle 이 잠금): **별도 `packages/contracts/src/impact.ts`** 를
  만든다(change preview 와 의미가 다른 file-based impact 변종이므로 change 스키마
  오염을 피함). `impactPreviewRequestSchema`(proposed_change 필드 포함) +
  response 스키마. change.ts 는 건드리지 않음.
- 검증: impact e2e/통합 + `completion-check.sh`.
- 완료 시: status_notes 에 "impact domain CLOSED (separate impact.ts)" 추가.

**3. `docs/findings/2026-05-26T1234-agent-contract-followups.md` — format_version 통합**

- 현황(검증됨): read 봉투 `apps/cli/src/agent-envelope.ts` 는 `format_version: 1`,
  mutation 봉투 `apps/cli/src/domain/envelope.ts` 는 `ENVELOPE_VERSION_V2 = 2`.
  finding 의 권고: **단일 `format_version: 1` + mutation 전용 필드를 optional 로**.
- 작업(설계 잠금됨): 두 봉투의 `format_version` 을 `1` 로 통합. mutation 전용 필드
  (`status`, `error`, `affected_files`, `dry_run`)는 optional 로 남겨 read 봉투와
  공존. `apps/cli/src/application/mutation-runner.ts` 및 mutation 커맨드(actor,
  goal, comment, step, scenario, stakeholder, project, usecase) + 관련 테스트
  (`agent-mode-contract.test.ts` 의 `>= 2` 기대 등) 갱신.
- ★ 주의(Q7): 이건 계약 **약화가 아니라 통합**이다. 봉투 스키마가 `@vooster/contracts`
  에 있다면 거기서 단일화하고, 대응 테스트를 먼저 갱신(RED) 후 구현(GREEN).
- 검증: `pnpm exec vitest run apps/cli/tests` + `completion-check.sh`.
- 완료 시: status_notes 에 "format_version split CLOSED — consolidated to v1 +
  optional mutation fields" 기입.

**4. `docs/findings/2026-05-26T1234-agent-contract-followups.md` — unroutable suggestions**

- 현황(검증됨): `member set-role`/`member list`(8 API 사이트), `workspace list`
  (2 사이트)가 403 컨텍스트의 `suggested_next_actions[].command` 로 노출되는데
  CLI 에 해당 verb 가 없음(CLI 는 `member invite`, `workspace switch` 만).
- 설계 결정(본 cycle 이 잠금 — finding 권고안 (b)): **reason-only advisory 로 전환**.
  `SuggestedNextAction.command` 를 optional 로 만들고, 위 무라우팅 제안들에서
  `command` 필드를 제거하되 `reason`(왜 막혔는지)은 유지. 403 advisory 가 호출자가
  실행할 수 없는 command 를 광고하지 않게 한다.
- 작업: `apps/cli/src/domain/envelope.ts` 의 `SuggestedNextAction` 에서 command
  optional 화 → API result 빌더(usecase-results, revision-diff-routes,
  invitation-problems, invitation-results, branch-results, impact-results,
  revision-history-results, api-key-results, who-results, session-list-results)
  에서 해당 command 제거 → ~10개 테스트 단언 갱신(RED→GREEN).
- 완료 시: agent-contract-followups status_notes 에 "unroutable suggestions
  CLOSED — converted to reason-only (option b)" 기입. 이 finding 의 나머지 OPEN
  item 이 모두 닫히면 `resolved: true` 로. (format_version 와 이 둘이 마지막
  OPEN item 이므로, T1-3 + T1-4 완료 시 finding 닫힘.)

### Tier 2 — route-test Phase 2 backstop (무한 filler, 다른 in-scope 소진 후 계속)

**`docs/findings/2026-05-23T1836-route-test-coverage-honesty.md` — Phase 2 마이그레이션**

- 현황(검증됨): `apps/api/tests/unit/http/*-routes.test.ts` **36개** 잔존. 통합
  exemplar 3개 존재(`apps/api/tests/integration/http/{doctor,lock,sync}-route.test.ts`).
- 우선순위(finding 본문): sync → signup → lock/session(concurrency) → 나머지 알파벳순.
  (sync/lock 은 이미 exemplar 가 있으므로 잔존 unit 파일이 있으면 정리, 없으면 skip.)
- 파일당 기계적 레시피:
  1. unit 파일의 각 `test()` 가 검증하는 endpoint/method/path/payload 추출.
  2. `apps/api/tests/integration/http/<route>-route.test.ts`(단수 route) 생성,
     `startServer()`(`apps/api/tests/helpers/server.ts`) + `server.fetch(...)` 사용.
  3. `await handler(request(...), reply())` → `server.fetch(path, {...})`,
     `captured.statusCode` → `response.status`, `captured.body` → `await response.json()`.
  4. mock store side-effect 단언은 실제 DB/상태 조회 또는 응답 단언으로 치환.
  5. green 확인 후 기존 unit 파일 삭제.
  6. `pnpm exec vitest run apps/api/tests/integration/http` green.
- 배치: 1 work-unit = 파일 1~5개(난이도에 따라). 매 배치 commit + push, status_notes
  의 "Progress: N/37 migrated" 갱신.
- ★ gotcha: signup-routes(OAuth/cookie stub), session/lock(concurrency 순서 단언),
  store-state mock → 실제 side-effect 검증, fixture 인라인. 까다로운 파일은
  주의해서 읽고, 막히면 다음 파일로 넘어가 blocker 기록.
- ★ honesty(P6/Q7): unit 파일 삭제는 통합 동등 테스트가 green 인 뒤에만. 검증을
  약화시키지 말 것.

---

## Finding 처리 절차 (work-unit 공통)

1. **읽기** — finding 전문 + 관련 코드. status_notes 의 주장을 코드로 대조(Q6).
2. **판단** — promote(goal) / delegate(claude-owned) / direct 중 택. 본 cycle 의
   Tier 1 은 전부 **direct**(작고 gate-불요). promote 는 §1.5/§5 셋 다 만족할 때만.
3. **실행 (TDD)** — RED(실패 테스트 먼저) → GREEN(최소 구현) → REFACTOR.
   `guidelines/goal-iteration.md`.
4. **검증** — 해당 도메인 테스트 + `bash scripts/completion-check.sh` exit 0.
   acceptance signal 을 직접 재실행(P8).
5. **마무리** — finding frontmatter 갱신:
   - 도메인/항목 1개 닫음 → status_notes 에 "<item> CLOSED <date> (commit/file)" 추가,
     `resolved_by` 에 SHA 추가(가능하면). 잔여 OPEN 있으면 `partial` 유지.
   - finding 의 모든 in-scope item 닫힘 → `resolved: true`.
   - 스냅샷/로그는 닫지 않음(reference only).
6. **commit + push** (main). audit_counter += 1.

---

## ★ 메타 시스템 감사 체크포인트 (work-unit 2개마다)

`guidelines/meta-system-audit.md` 가 source of truth. 절차:

1. **대상 선정** — 최근 2 work-unit 이 건드린 하니스/테스트 표면, 그리고 누적
   의심 지점(긴 `.gates.sh`/`.next-task.sh`, overfit 테스트). 직전에 만든 goal 의
   gates 가 있으면 우선.
2. **렌즈 적용** — 각 블록/테스트에 Q1–Q8:
   - Q1: 이 검사 없으면 어떤 _테스트_ 가 빨개지나? (잡으면 MOVE-TO-TEST/DELETE-W-DECL)
   - Q2: 의도인가 양식(grep/함수명/헤딩)인가? (양식 → TRIM)
   - Q3: 왜 이렇게 긴가? (LOC 예산 초과 → Q1·Q2 재적용)
   - Q6: resolved/green 주장을 재실행으로 검증했나?
   - Q7: 게이트 _약화_ 인가 _이전_ 인가? (선언·테스트 없는 삭제 → **HARD STOP**)
   - **테스트 코드 렌즈(`prompts/check-test-codes` 철학)**: 구현 overfit 테스트
     (정확한 `fetch(..., RequestInit)` 단언, 내부 호출 횟수 단언, 양식 결합)
     탐지 → 제거 또는 contracts/통합 패턴으로 이전. unit 이 payload/schema 를
     과검증하면 `@vooster/contracts` 가 잡게 이전.
3. **개선 처리** — 발견한 개선이:
   - 영속 universal invariant + multi-step + 별개 → **goal 35+ 로 promote**
     (§1.5 최소 gate, `check-gate-rigor.sh` 마지막 게이트 포함). chain 으로 처리.
   - 단발 직접 수정 → direct fix + 테스트.
   - 제품에서 멀고 비싼 메타 작업 → **DEFER**(신규 finding 생성, Q5).
4. **기록** — `docs/state/learnings.md` 에 감사 1줄 요약(무엇을 의심→판정→조치).
   개선을 defer 했으면 신규 `docs/findings/<TS>-*.md` 생성.
5. commit + push. 이 체크포인트 자체도 work-unit 으로 카운트하지 않음(감사는
   work-unit 사이의 게이트).

> 감사가 "이상 없음"으로 끝나도 좋다 — P9: 그래도 **반박을 한 번 세워** 살아남는지
> 본다. 살아남으면 한 줄 근거를 learnings 에 남긴다.

---

## Out of scope (발견해도 fix 금지 — 이유 명시)

- **`cli-spec-gaps` merge-resolve public conflict setup** — `/__test/.../revisions`
  의존 제거는 **제품 결정 필요**: sync 를 non-main 브랜치로 확장할지, 신규
  `vspec commit` verb 를 둘지. 무인 실행이 임의로 결정하면 안 됨. 그대로 partial.
- **`dogfood-followups` A14 (planned verbs)** — 어떤 verb 를 MVP/beta 에 넣을지는
  **제품 스코프 결정**(multi-sprint). 그대로 queued.
- **T1-4 unroutable suggestions (option b)** — DEFERRED after measurement
  (2026-06-02): 본래 S 로 추정했으나, `command` optional 화는
  `suggestedNextActionSchema` 를 쓰는 **17개 contract 스키마 + 다수 CLI printer
  (`action.command` 무조건 접근) + API problem 타입 + ~10 테스트**에 걸치는
  contract-wide loosening 임이 확인됨. finding 도 "after beta" 로 명시. 무인
  실행으로 안전히 못 닫음 → 별도 리뷰 슬라이스로 미룸. agent-contract-followups
  는 format_version 만 닫고 partial 유지.
- **`persona-dogfood-harness` (F3)** — 하니스 골격은 자율 가능하나 의미있는 종료가
  human-vetted 페르소나 + 임계값 + 해석 + PII 제한 `form-data/` 에 의존. 무인 루프로
  못 닫음. 그대로 false.
- **`gap-a-authoring-assist` (F4)** — XL 로드맵, F3 결과 의존, scaffolding/gap-detection
  미설계. 그대로 open.
- **`shared-api-contracts` CLI typed client layer** — finding 이 명시적으로 deferred
  (L 리팩터, ~47 커맨드/~78 호출부). 본 cycle 은 stakeholder-interest/impact 도메인만.
- **스냅샷/로그 finding** (`perf-log`, `dogfood-snapshot`, `activation-wow`) — 강제
  종료 금지. reference 로 둔다.
- 위 항목을 작업 중 발견해도 고치지 말 것. 새 아이디어는 신규 finding 으로만 남긴다.

---

## Forbidden actions (HARD STOP)

- prior goal 의 게이트를 대응 테스트·`## Supersedes`(§5 case c)/enforcement-이전
  선언(case b) 없이 **약화/삭제** — 즉시 중단(정직성 위반, `goal-design.md §5`).
- 게이트를 통과시키려 **검증을 약화**(P6). trim 은 "테스트로 이전"이지 "삭제"가 아님.
- 통합 동등 테스트가 green 이기 _전에_ route-test unit 파일 삭제.
- `kind: snapshot`/`append-only-log` finding 을 강제로 `resolved: true` 로.
- secret 커밋 (`.claude/skills/commit/SKILL.md` 의 secret-scan 준수).
- `main` 외 브랜치 생성(이 cycle 은 main 직접 push).

막히면: 3 TDD 사이클 무진전 → `docs/state/blockers.md` 기록 → 다음 target.
**절대 조기 종료 금지.**

---

## Commit / push 프로토콜

- `.claude/skills/commit/SKILL.md` 준수. Conventional Commits.
- 매 work-unit(또는 route-test 배치)마다 commit + `git push origin main`.
- 메시지 말미:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
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
