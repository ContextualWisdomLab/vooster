---
cycle: 260524-01
title: Post-review findings closure
authored_at: 2026-05-24T03:47:00+09:00
started_at: 2026-05-24T03:47:00+09:00
completed_at: 2026-05-24T04:34:28+09:00
status: complete
---

# 260524-01 — Post-review findings closure

**목표**: 2026-05-23 dogfood-findings 브랜치에 대한 claude 리뷰
(`claude-feedback.md`) 와 2026-05-24 spec ↔ impl audit
(`docs/findings/2026-05-24T1100-spec-impl-audit.md`) 에서 도출된
7 개 findings 를 우선순위/의존성 순서대로 닫는다. 일부는 goal 로
promote, 일부는 직접 작업. 매 finding 완료 시 commit + push.

본 문서를 codex 에게 무한 루프 모드로 넘겨 자율 처리시킨다.

작업 시작 전 반드시 읽을 것:

- `docs/goal-design.md` — harness 설계 (특히 §1.5, §5)
- `guidelines/goal-iteration.md` — iteration 프로토콜 (TDD, commit cadence)
- `.claude/skills/commit/SKILL.md` (또는 `/commit` skill) — 커밋 규약
- `docs/findings/AGENTS.md` — finding 문서 규약
  (단, `priority`/`resolved`/`resolved_by`/`was` 필드는 실제 사용
  관습이 문서와 다름 — 본 cycle 의 finding #7 이 이 drift 를 보정함.
  드리프트 보정 _전까지는_ 기존 finding 들의 frontmatter 를 source of
  truth 로 삼을 것: `P0|P1|P2`, `boolean|partial`, `resolved_by`, `was`)

---

## 루프 알고리즘

```
LOOP:

  step 1 — chain 상태 확인:
    $ bash scripts/completion-check.sh
    if exit 0 (.state/active-goal == ALL_DONE):
      → step 2
    else:
      → .state/active-goal 의 goal 을 TDD 로 GREEN 만들기
        (guidelines/goal-iteration.md 의 Phase 4 따름)
      → commit + push
      → step 1 (재확인)

  step 2 — finding 진행:
    target_findings 리스트(아래)에서 첫 unresolved 항목 선택
    if 없음:
      → TERMINATE (모든 작업 완료)
    else:
      → "Finding 처리 절차" 섹션 따름
      → frontmatter resolved: true (또는 partial + remaining 명시)
      → commit + push
      → step 1
```

종료 조건:

1. 모든 target findings 가 `resolved: true` (또는 명시적 partial)
2. `bash scripts/completion-check.sh` exit 0

종료 시 `docs/state/learnings.md` 에 한 줄 요약 append.

---

## Target findings (순서)

**P0 — 데이터 무결성 (먼저)**

1. `docs/findings/2026-05-23T1836-sync-conflict-canonical-markdown.md`
   - `staleFileConflict` 의 remote 본문이 stripped markdown — silent
     data-loss 위험.
   - Universal invariant 명시 가능 → **goal 화 권장** (negative grep:
     "no conflict path emits stripped markdown").
   - 본 cycle 의 HARD STOP 1순위.

**P1 — Pre-beta 기능 완성 + hygiene (그 다음, 순서대로)**

2. `docs/findings/2026-05-24T1100-spec-impl-audit.md` — **Gap C 만**
   (UC-016 `--auto-branch` SEMANTIC lock 누락)
   - 가장 작은 spec gap (SMALL). `work-session-start.ts:212` 한 곳 +
     테스트.
   - 처리 후 audit finding 의 `status_notes` 에 "Gap C — CLOSED …"
     append.
   - **이 finding 은 본 cycle 에서 `partial` 로 유지**: A 도 닫지만
     B 는 design decision 필요 → 다음 cycle.

3. `docs/findings/2026-05-24T1100-spec-impl-audit.md` — **Gap A 만**
   (UC-013 step `actor_id` editing 미구현)
   - MEDIUM. ~4 source + 2 test 파일. `editStep` 에 `ActorStore` 주입,
     `UNKNOWN_ACTOR` 결과, BREAKING severity, CLI body 와이어.
   - 처리 후 audit finding 의 `status_notes` 에 "Gap A — CLOSED …"
     append.
   - **Gap B (UC-022 SOFT lock 다중성) 는 본 cycle 에서 손대지 마라**
     — `## Out of scope` 섹션 참고.

4. `docs/findings/2026-05-23T1836-doctor-route-hardening.md`
   - 3 tranche (A: auth ordering / B: query contract / C: severity).
     같은 라우트 파일 (`doctor-routes.ts`) → 한 finding 안에서 RED/GREEN
     세 번 사이클.
   - Tranche A 만 universal claim 가능하지만 enforcement gate 가 복잡 →
     **goal 화 부적합**. 직접 작업.

5. `docs/findings/2026-05-23T1836-cli-onboarding-hint-correction.md`
   - `apps/cli/src/flag-values.ts:47` 한 줄 + 테스트. **goal 화 불필요**.

**P2 — Post-beta cleanup (마지막)**

6. `docs/findings/2026-05-23T1836-route-test-coverage-honesty.md`
   - `tests/unit/http/*-routes.test.ts` 80+ 파일이 coverage-diagnosis
     finding 의 처방 위반.
   - 본 cycle 의 scope = **Phase 1**: 결정 doc + 2-3 exemplar
     integration test. **Phase 2 (per-route migration) 은 본 cycle 에서
     처리 금지** — 시간 폭증 위험.
   - `resolved: partial` + `status_notes` 에 "Phase 1 complete; Phase 2
     queued" 명시.

7. `docs/findings/2026-05-23T1836-post-beta-hygiene-sweep.md`
   - H1-H5 sub-item queue. 각 sub-item 한 commit.
   - 시간 부족하면 닫은 sub-item 만큼만 status_notes 에 표시하고 finding
     자체는 `partial`. **strict 우선순위 없음** — 어느 H 부터 시작해도
     OK.

8. `docs/findings/2026-05-23T1836-findings-protocol-drift.md`
   - `docs/findings/AGENTS.md` + `docs/findings/CLAUDE.md` 의 4 가지
     drift 보정. 순수 doc 작업.
   - 본 cycle 의 _마지막_ 으로 처리할 것: 직전 6 개 finding 작성/closure
     과정에서 drift 가 추가로 발견될 가능성이 있음. 마지막에 묶어서
     반영.

---

## Out of scope (본 cycle 에서 손대지 마라)

다음 항목들은 의도적으로 본 cycle 의 target 에서 제외함. 작업 중 발견해도
**fix 시도 금지** — 별도 finding/goal 로 등록만.

- **spec-impl-audit Gap B (UC-022 SOFT lock 다중성)** — 모델 변경 필요
  (lock-store port + Prisma `@@unique` 제약 + 모든 caller). audit
  finding 본문 권고대로 "design decision 후 dedicated goal" 경로.
- **`tests/unit/http/*-routes.test.ts` 의 per-route 마이그레이션** —
  finding #6 Phase 2. 80+ 파일 마이그레이션은 multi-day 작업이라 본
  cycle 에서 시작도 하지 말 것.
- **commit hygiene / prettier 순서 / Co-Authored-By 누락 의 _과거_
  commit 정정** — git history 는 immutable. 본 cycle 의 _새로운_ commit
  들은 규약 준수하되, 과거 정정은 별도 process 문서 작업.
- **spec-impl-audit 의 cross-cutting 문서 drift** (docs 06/07/08/09 의
  미구현 endpoint/subcommand 추가 구현) — 이미 `🔵 Planned` 로
  annotated 됨. MVP 이후 작업.

---

## Finding 처리 절차

각 finding 마다:

1. **읽기**:
   - frontmatter 의 `resolved`, `priority`, `related` 확인
   - `resolved: true` 면 skip
   - `resolved: partial` 면 status_notes 의 "남은 일" 만 처리
   - TL;DR + Acceptance signal + (있으면) Migration plan 정독
   - related 의 다른 findings/docs 도 확인 (특히 의존성)

2. **판단 — goal 로 promote 할지 vs 직접 작업할지**:

   **goal 로 promote**: 다음 _모두_ 해당될 때만:
   - 작업 완료를 _gate 로_ 검증 가능한 universal invariant 가 있음
     (negative grep 0 개 같은 source-of-truth enumeration)
   - 작업이 multi-step 으로 RED/GREEN 사이클 여러 번 돔
   - prior goal 들과 의미적으로 별개

   **직접 작업**: 위 조건 하나라도 안 맞으면:
   - 그냥 작업 (guidelines/goal-iteration.md Phase 4 TDD 따름)
   - finding 의 Acceptance signal 그대로 통과 확인
   - frontmatter `resolved: true` + `resolved_by: <sha>` 명시

   본 cycle 의 promote 판단 (각 finding 본문에 명시되어 있음):
   - #1 sync-conflict: **promote** (universal grep + multi-step)
   - #2-5: **직접 작업**
   - #6: **직접 작업** (Phase 1 만)
   - #7: **직접 작업** (sub-item queue)
   - #8: **직접 작업** (doc only)

3. **실행**:
   - guidelines/goal-iteration.md Phase 4 TDD 그대로 (RED → GREEN →
     REFACTOR, 각 phase 한 커밋)
   - goal 로 promote 했다면 `goals/31-*`, `goals/32-*` 등 다음 빈 번호
     (현재 highest 는 goal-29, goal-30 은 삭제됨)
   - 각 phase commit 직후 chain 상태 점검 (`bash scripts/active-check.sh`)

4. **검증**:
   - finding 의 Acceptance signal 그대로 실행
   - `bash scripts/completion-check.sh` 가 ALL_DONE 인지 확인
   - 만약 다른 goal 이 깨졌다면 → **STOP, blocker 기록** (`docs/state/blockers.md`)

5. **마무리**:
   - finding 의 frontmatter 업데이트:
     - 완전히 끝났으면 `resolved: true` + `resolved_by: <sha>`
     - 일부만 끝났으면 `resolved: partial` + `status_notes:` 에 "남은 일"
   - finding 본문 마지막에 "## Resolution" 섹션 append: 어떤 커밋이
     어떤 acceptance signal 을 flip 했는지
   - commit + push

### spec-impl-audit 특수 처리

이 finding 은 multi-gap (A/B/C) 모델. 본 cycle 의 처리:

- **#2 cycle 진입 시**: audit finding 을 읽음 → Gap C 의 reproducer/fix
  /acceptance 만 처리 → 커밋 후 audit finding 의 `status_notes` 에
  "Gap C — CLOSED YYYY-MM-DD (commit `<sha>`)" 한 줄 prepend. `resolved`
  는 `false` → `partial` 로 전환 (Gap A 아직 open 이라도).
- **#3 cycle 진입 시**: 동일하게 Gap A 처리 후 status_notes 에 한 줄
  추가. `resolved` 는 `partial` 유지.
- **종료 시**: `resolved` 는 `partial`. status_notes 에 "Gap B — OPEN
  (deferred — see cycles/260524-01-post-review-findings-closure.md
  Out of scope)" 명시.

---

## Goal 화 시 주의점 (`docs/goal-design.md` §1.5 / §5 / `gates-over-coupling` finding 종합)

### 최소 gates.sh

**금지 패턴** (gates-over-coupling 표 참조):

- 함수 본문 grep (`grep "buildXEnvelope" file.ts`)
- 타입 필드 grep (`grep "id: string" file.ts`)
- 테스트 제목 grep (`grep "agent X verb" file.test.ts`)
- 특정 경로 파일 존재 강제 (`[ -f "specific/path.test.ts" ]`)
- 마크다운 헤딩 grep
- findings bullet 제거 추적

**허용 패턴**:

- **Rigor 메커니즘**: 모든 goal 의 마지막 게이트로 항상 포함:
  ```
  if "$ROOT/scripts/check-gate-rigor.sh" "$ROOT/goals/<n>-<name>.md" ...
  ```
- **Negative universal grep**: "codebase 어디에도 X 없음" — single grep
  으로 universal invariant 강제 (sync-conflict #1 가 이 케이스)
- **구조 앵커**: 후속 goal routing 에 필요한 문서/파일 존재만

### 회의적 휴리스틱

**"이 invariant 가 깨지면 어떤 테스트가 빨갛게 되는가?"**

- 답이 있음 → gate 에서 빼라. 테스트가 잡는다.
- 답이 없음 → gate 가 적절.

### Prior goal 수정 (case b/c)

- 기존 goal 의 gate 를 약화하거나 삭제해야 한다면:
  - 새 goal `.md` 에 `## Supersedes` 섹션 명시 (case c)
  - 또는 enforcement 이전임을 PR 메시지에 명시 (case b 의 특수형)
- **선언 없이 prior gate 삭제 절대 금지** — `docs/goal-design.md §5`

---

## Forbidden actions (HARD STOP — `docs/state/blockers.md` 기록 후 다음으로)

1. **Prior goal invariant 약화** — `docs/goal-design.md §5` 케이스 (b)/(c)
   미준수 변경 금지. `## Supersedes` 또는 enforcement 이전 명시 없이
   prior `.gates.sh`/`.md` 손대지 마라.

2. **Hook 우회 금지** — `git commit --no-verify`, `--no-gpg-sign` 등 금지.
   hook fail 하면 원인 디버그.

3. **테스트/lint 비활성화 금지**:
   - `.skip()` / `.skip:` / `xit()` / `it.skip()` 추가 금지
   - `// eslint-disable-*` 새로 넣기 금지 (기존 것도 가능하면 제거)
   - `// @ts-ignore` / `// @ts-expect-error` 추가 금지
   - 깨진 동작이면 _코드_ 를 고쳐라, 검증 도구를 침묵시키지 말라.

4. **Coverage threshold 인하 금지** — `vitest.config.ts` 의 75/80/80/80
   baseline. threshold 자체 손대지 마라.

5. **3 TDD 사이클 무진전** — `docs/state/blockers.md` append 후 다음
   finding 으로. 막혀서 시간 낭비 금지.

6. **Chain 이 예상 못한 방식으로 깨질 때** — `.state/active-goal` 이
   work plan 과 안 맞는 goal 을 가리키거나 새로 fail 하는 goal 이
   생기면 STOP. blocker 기록.

7. **Destructive git 명령 금지** (사용자 명시 승인 없으면):
   - `git push --force`, `git push -f`
   - `git reset --hard`, `git checkout -- .`, `git clean -f`
   - `git rebase -i`, `git filter-branch`
   - 메인 브랜치로 force push 절대 금지

8. **`.env`, credentials, 대용량 산출물 commit 금지**. `/commit` skill 의
   secret-scan 규약 그대로.

9. **사용자 환경에 영향** (호스트 시스템 설정 변경, `~/.vspec/config.json`
   덮어쓰기 등) 금지. 작업은 _워크트리 안에서만_.

10. **본 cycle 의 "Out of scope" 항목 작업 금지** — 발견해도 별도
    finding 등록만. 특히 spec-impl-audit Gap B 는 _절대_ 손대지 마라.

---

## Commit / push 프로토콜

`/commit` skill + `guidelines/goal-iteration.md` Phase 4 따름:

- TDD 각 phase (RED, GREEN, REFACTOR) — **한 phase 한 commit**
- finding 완료 후 — 마무리 commit 1번 (있으면) + `git push origin <branch>`
- 현재 branch 유지 (별도 branch 생성 금지)
- 커밋 메시지 끝에 Co-Authored-By 라인 (codex 자신)
- HEREDOC 으로 메시지 전달 (포맷 깨짐 방지)

**브랜치 확인**: 작업 시작 시 현재 브랜치 확인. main 이나 다른 곳으로
우연히 옮겨가지 마라.

**Push 실패 시**: 원인 디버그 (네트워크? remote rejection?). retry 한 번
까지 OK. 두 번째도 실패하면 blocker.

---

## 진행 상황 추적

`docs/state/progress.md` 와 `docs/state/next-task.md` 는
`scripts/update-state.sh` 가 자동 생성. **손대지 마라**.

`docs/state/learnings.md` 와 `docs/state/blockers.md` 는 append-only.

- learnings: "이 finding 처리하면서 발견한 의외의 점" 같은 한 줄
- blockers: forbidden action 트리거 시 또는 3-사이클 stuck 시

---

## 검증 — 진짜 끝났는지

종료 직전 마지막 점검:

```bash
# 1. 본 cycle 의 target findings 상태 점검
for f in \
  docs/findings/2026-05-23T1836-sync-conflict-canonical-markdown.md \
  docs/findings/2026-05-24T1100-spec-impl-audit.md \
  docs/findings/2026-05-23T1836-doctor-route-hardening.md \
  docs/findings/2026-05-23T1836-cli-onboarding-hint-correction.md \
  docs/findings/2026-05-23T1836-route-test-coverage-honesty.md \
  docs/findings/2026-05-23T1836-post-beta-hygiene-sweep.md \
  docs/findings/2026-05-23T1836-findings-protocol-drift.md \
; do
  awk '/^---$/{c++; if(c==2)exit} /^resolved:/{print FILENAME": "$0}' "$f"
done

# 예상 결과:
#   #1 sync-conflict          → resolved: true
#   #2/#3 spec-impl-audit     → resolved: partial  (Gap A+C closed, B deferred)
#   #4 doctor-hardening       → resolved: true
#   #5 cli-onboarding         → resolved: true
#   #6 route-test-honesty     → resolved: partial  (Phase 1 만 닫힘)
#   #7 hygiene-sweep          → resolved: true  (모든 H 닫힌 경우) 또는 partial
#   #8 protocol-drift         → resolved: true

# 2. chain green
bash scripts/completion-check.sh
echo "exit: $?"   # 0 이어야 함

# 3. 작업 트리 clean
git status --short    # 비어야 함

# 4. push 다 됐는지
git log @{u}..HEAD --oneline   # 비어야 함 (모두 push 됨)
```

다 통과하면 `docs/state/learnings.md` 에 한 줄 append:

```
- 2026-05-24 post-review: closed N findings (P0×1, P1×4, P2 sweep).
  spec-impl-audit Gap B deferred to dedicated goal. Open blockers: K.
  See git log for details.
```

TERMINATE.
