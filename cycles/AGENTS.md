# `cycles/` — Working Protocol for cycle-driver documents

## What this directory is

`cycles/` holds **loop-driver prompts** — the documents you hand to an
autonomous coding agent (codex / claude) in infinite-loop `/goal` mode:

```
/goal cycles/260526-01-overnight-findings-sweep.md 의 내용을
      모두 완수할때까지 작업해줘.
```

A cycle document describes **one work session**: it picks unresolved
items from `docs/findings/`, orders them by priority/dependency, and
drives a TDD loop that closes them — promoting some into
`goals/<n>-*` harness goals, doing the rest directly. It is a _prompt_,
not a contract.

---

## cycle ≠ harness goal

|           | `goals/<n>-*.md`                                                             | `cycles/YYMMDD-NN-*.md`              |
| --------- | ---------------------------------------------------------------------------- | ------------------------------------ |
| 발견 주체 | `completion-check.sh` / `next-task.sh` 가 `find goals -maxdepth 1` 으로 스캔 | 사람이 `/goal <path>` 로 직접 전달   |
| 성격      | gate 로 검증되는 **영속 invariant**                                          | 특정 세션의 작업 **프롬프트** (이력) |
| 검증      | `.gates.sh` + `check-gate-rigor.sh`                                          | 없음 — 본문이 종료 조건을 서술       |

하네스는 `goals/` 최상위만 스캔하므로 이 폴더는 **절대 gate 대상이 되지
않는다**. 사이클 문서는 완료 후에도 이력으로 남긴다 — 삭제하지 말 것.

---

## Filename convention

```
cycles/<YYMMDD>-<NN>-<slug>.md
```

- `<YYMMDD>` — 사이클 시작일 (예: `260526` = 2026-05-26).
- `<NN>` — 같은 날짜 안에서의 순번 (`01`, `02`, …). 하루에 사이클을
  여러 번 시작할 수 있으므로 순서를 보장한다.
- `<slug>` — 짧고 소문자, 하이픈. 날짜는 prefix 가 이미 인코딩하므로
  slug 에 중복하지 말 것.

예시:

```
cycles/260523-01-overnight-findings-closure.md
cycles/260524-01-post-review-findings-closure.md
cycles/260526-01-overnight-findings-sweep.md
```

---

## Frontmatter (required)

모든 cycle 문서는 YAML frontmatter 로 시작한다 — 사이클의 생애주기를
기계가 읽을 수 있게 기록한다.

| 필드           | 의미           | 비고                                               |
| -------------- | -------------- | -------------------------------------------------- |
| `cycle`        | `YYMMDD-NN` id | 파일명 prefix 와 일치                              |
| `title`        | 짧은 제목      | `# H1` 과 동일                                     |
| `authored_at`  | **작성시점**   | 문서 작성 시각 (ISO-8601, `+09:00`)                |
| `started_at`   | **시작시점**   | 루프에 넘겨 실행 시작한 시각. 미시작이면 공란      |
| `completed_at` | **완수시점**   | 루프 종료(TERMINATE) 시각. 미완이면 공란           |
| `status`       | **완수여부**   | `draft`→`running`→`complete`\|`partial`\|`aborted` |

```yaml
---
cycle: 260526-01
title: Overnight findings sweep
authored_at: 2026-05-26T01:03:39+09:00
started_at:
completed_at:
status: draft
---
```

- **status 전이**: `draft`(작성, 미시작) → `running`(시작 시 `started_at`
  기입) → 종료 시 `complete`(모든 in-scope 닫힘) / `partial`(일부 deferred
  남김) / `aborted`(중단) 중 하나 + `completed_at` 기입.
- **과거 문서의 시점은 git 에서 도출**: `authored_at` =
  `git log --follow --diff-filter=A --format='%aI' -- <path>` (최초 add),
  `completed_at` = 그 사이클의 마지막 closure 커밋 author date.

---

## A cycle document MUST contain

생성용 메타 프롬프트: `prompts/goal-docs-generate.md`. 최소 구성:

1. **목표 + Target findings** — 닫으려는 finding 목록과 그들 간의
   순서/의존성.
2. **루프 알고리즘** — chain 상태 확인 → 미완료 goal 완수 → 다음 finding.
3. **Finding 처리 절차** — 읽기 / promote·delegate·direct 판단 /
   실행(TDD) / 검증 / 마무리(frontmatter + Resolution).
4. **Out of scope** — 의도적으로 손대지 않을 항목 (발견해도 fix 금지,
   이유 명시).
5. **Forbidden actions** — HARD STOP 규칙.
6. **Commit / push 프로토콜**.
7. **종료 / 검증** — 진짜 끝났는지 확인하는 명령들.

---

## Authoring rules

작성 전 반드시 읽을 것: `docs/goal-design.md` (특히 §1.5, §5),
`guidelines/goal-iteration.md`, `.claude/skills/commit/SKILL.md`,
`docs/findings/AGENTS.md`. 위임 goal 을 만들 거면
`docs/claude/delegation.md` + `docs/claude/headless.md` 도.

- **스냅샷/로그를 강제로 닫지 말 것.** `kind: snapshot` /
  `append-only-log` finding (감사·dogfood·perf 기록)은 "resolved"
  대상이 아니다. 그 finding 이 분해한 **자식 work item** 을 닫고,
  스냅샷 자체는 reference 로 둔다.
- **Promote 는 아껴서.** goal 로 승격하는 조건은 셋 다 만족할 때만:
  (a) gate 로 검증 가능한 universal invariant, (b) multi-step
  RED/GREEN, (c) prior goal 과 의미적으로 별개. 최소 gate 규칙은
  `docs/goal-design.md §1.5` 와 `gates-over-coupling` finding 참조.
- **Presentation 작업 위임.** UI/UX·카피·디자인 (주로 `apps/web`,
  `apps/www`)은 claude-owned 위임 goal 로 — `## Delegation`
  (owner: claude). 계약: `docs/claude/delegation.md`.
- **무인(overnight) 실행 설계.** 깊고 안전한 큐(대량 per-file 작업)는
  뒤로, 설계 결정이 필요한 항목은 out-of-scope 로. 3 TDD 사이클
  무진전이면 blocker 기록 후 다음 target 으로 — **절대 조기 종료 금지**.
  종료는 모든 in-scope target 이 resolved/partial 이고 chain 이
  green 일 때만.

---

## Lifecycle

1. **Generate** — `prompts/goal-docs-generate.md` 로 새 사이클 문서 작성.
2. **Run** — `/goal cycles/<file>` 으로 무한 루프 에이전트에 전달.
3. **History** — 완료 후 파일을 그대로 남긴다 (삭제 금지). 다음 사이클이
   직전 사이클의 Out-of-scope/deferred 항목을 인계받는다.

다른 파일을 참조할 땐 repo-rooted 경로
(`docs/findings/<file>.md`, `goals/<n>-<name>.md`, `cycles/<file>.md`)
를 쓴다 — `./`·`../` 상대경로 금지.
