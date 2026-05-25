# guidelines/meta-system-audit.md — 메타 시스템 점검 렌즈 (유지보수자 관점)

이 문서는 **메타 시스템** — 하니스(`goals/*.gates.sh`,
`goals/*.next-task.sh`, `scripts/`), findings 프로토콜
(`docs/findings/`), cycle 드라이버(`cycles/`) — 를 점검할 때, **프로젝트
오너의 개발 철학으로 의심하고 검증**하기 위한 렌즈다.

기계 층위는 이미 "무엇이 금지/허용인가"를 강제한다:

- `docs/goal-design.md §1.5` — gates 가 _하지 말아야_ 할 것.
- `docs/goal-design.md §5` — 이전 goal 게이트 immutability + case (a)/(b)/(c).
- `scripts/check-gate-rigor.sh` — universal claim ↔ gate enumeration rigor.
- `docs/findings/2026-05-23T1700-gates-over-coupling.md` — 강결합 진단·migration.

이 문서는 그 **위**에 얹히는 사람 층위다 — 규칙을 통과해도 _나라면
어디를 의심하고, 무엇으로 검증하겠는가_. 자동화가 아니라 판단의 체크리스트다.

> **이 철학은 지어낸 것이 아니다.** 아래 원칙은 이 프로젝트의 Claude Code
> 프롬프트 이력(2026-05-22 ~ 2026-05-25, 70개 실프롬프트)에서 **추출**했고,
> 각 원칙에 당시 발화를 인용해 추적 가능하게 남겼다. 철학이 바뀌면 근거
> 인용도 함께 갱신할 것.

---

## Part 1 — 추출된 개발 철학

각 원칙 = **주장 / 근거(인용) / 함의** 한 묶음.

### P1. 메타 시스템은 제품의 종(從)이다

- 근거: 프롬프트 70건 중 메타 시스템(findings/goal/gate 의문)이 **약 41%**,
  하니스 쉘이 제품 소스의 **61%**(18.0K vs 29.3K LOC)까지 누적된 상태에서
  반복된 의문 — _"한 파일이 이렇게까지 길게 생성되는 것 자체가 좀 의문이야"_
  (05-22, new-goal-dogfood-findings).
- 함의: 모든 하니스 한 줄은 **제품 가치**로 정당화돼야 한다. 메타가 제품을
  압도하면 그것이 곧 결함이다.

### P2. 중복 검증은 빚이다

- 근거: _"어차피 진짜 작동을 검증하고 코드를 체크하는 건 lint/typecheck/
  test 의 몫이잖아. 근데 gates.sh 가 왜 이렇게 길어야 돼?"_ (05-22).
- 함의(서명 휴리스틱): **"이 invariant 가 깨지면 어떤 _테스트_ 가
  빨개지는가?"** 답이 있으면 게이트에서 빼라 — 테스트가 이미 잡는다.

### P3. 양식이 아니라 의도를 검증한다

- 근거: _"gates.sh 만 할 수 있는 것들이 진짜 중요한 체크들이야? 너무
  코드/문서 양식 등에 강결합 되는 건 아니야?"_ (05-22).
- 함의: 함수명·타입 필드·테스트 제목·파일 경로·마크다운 헤딩 grep 은
  현재 _구조_ 에 묶인다. 무해한 리팩터에 spurious fail 하는 검사는 의도가
  아니라 양식을 보고 있는 것이다.

### P4. invariant 는 초기 추측을 화석화하면 안 된다

- 근거: _"invariant 강제가 듣기엔 좋아 보이는데… 초기에 생각한 invariant 를
  너무 강제해버리면 오히려 잠재력을 제한하는 건 아닐지 걱정… 한편으론 이런
  통제 장치가 안전장치/브레이크로 꼭 필요할 것 같기도 해"_ (05-22).
- 함의: guard-rail 은 필요하되, **더 나은 설계의 발견을 막으면 실패**다.
  게이트는 영속 진실만 고정하고, 추측은 약하게 — 그리고 수정 가능하게.

### P5. boring·minimal 이 기본값이다

- 근거: _"지금보다 next-task 를 minimal 하게 만들자는 거야?"_ (05-22).
  AGENTS.md 의 Kent Beck 신조("the simplest thing that could possibly work").
- 함의: **길이는 그 자체로 의심 대상**이다. 짧게 쓸 수 있는데 길면 줄여라.
  레퍼런스: goal-30 게이트(~63줄)는 의도적으로 짧게 쓴 모범.

### P6. 정직성은 협상 불가다 (P5 와의 긴장을 푸는 규칙)

- 근거: _"게이트를 약화시켜 통과시키는 건 금지 — 정직성 위반"_ (05-25,
  fix-eslint-boundaries-ci, 수용 기준).
- 함의: 짧게 만들되 **통과를 위해 검증을 약화하지 마라**. trim 은
  "검사를 테스트로 _이전_"이지 "검사 _삭제_"가 아니다. 게이트를 줄이려면
  먼저 대응 테스트가 존재해야 한다. (§5 case (b).)

### P7. 데이터 없이 결정하지 않는다

- 근거: _"반드시 실제 데이터 기반으로 의사결정을 내려야 한다"_ (05-25),
  _"최대한 정량적인 데이터를 기반으로 신뢰도 높게 분석"_ (05-25).
- 함의: 메타 시스템 변경 제안은 추측이 아니라 **재현·측정·인용**으로
  뒷받침돼야 한다. "그럴 것 같다"는 근거가 아니다.

### P8. 검증자를 검증한다

- 근거: _"너가 이 파일들을 진짜 잘 옮겼을지 걱정돼… 다시 한번 체크해줄래?"_
  (05-22), _"그 방식이 astro 권장 방식이 맞아? 한번만 더 체크좀"_ (05-22).
- 함의: 에이전트(또는 과거의 나)의 "됐다"를 액면 그대로 믿지 마라. 특히
  **상태/완료 주장**(`resolved: true`, "gate green")은 acceptance signal 을
  직접 재실행해 확인한다.

### P9. 순응이 아니라 논쟁을 원한다

- 근거: _"너 입장에서 비판적으로 한번 고민해봐줘"_, _"우리 한판 붙어보자"_
  (05-22, 05-25, 다수).
- 함의: 점검자는 반박할 수 있어야 한다. 설계를 옹호만 하지 말고, 먼저
  **반대 입장을 세워** 그래도 살아남는지 보라. 살아남지 못하면 기각.

---

## Part 2 — 점검 렌즈: 의심 질문 + 검증

메타 시스템 산출물(특히 게이트/next-task 블록 단위)마다 아래를 적용한다.
질문 → 어떻게 검증하나 → 판정.

### Q1. "이 검사가 없으면 어떤 _테스트_ 가 빨개지는가?" (P2)

- 검증: 그 invariant 를 의도적으로 깬 상태를 가정하고
  `pnpm test` / `pnpm run lint` / `pnpm run typecheck` 가 잡는지 확인.
- 판정: **잡는다 → MOVE-TO-TEST 또는 DELETE-WITH-DECLARATION**(P6 규칙 하).
  못 잡고 오직 게이트만 잡을 수 있다 → KEEP.

### Q2. "이 검사는 의도를 보는가, 현재 양식을 보는가?" (P3)

- 검증: 무해한 리팩터를 가정한다 — 헬퍼 rename, 테스트 파일 이동, heredoc
  재구성, 마크다운 헤딩 문구 변경. 이 중 하나로 게이트가 깨지면 양식 결합.
- 판정: 양식 결합 → **TRIM**(grep 제거, negative-universal/구조 앵커만 남김).
  허용 패턴은 `goal-design.md §1.5` 의 화이트리스트를 따른다.

### Q3. "왜 이렇게 긴가? 절반으로 줄이면 무엇을 잃는가?" (P5)

- 검증: `wc -l goals/<n>-*.gates.sh goals/<n>-*.next-task.sh` → goal-30
  (~63줄) 및 게이트 LOC 예산과 대조. 예산 초과분의 각 블록에 Q1·Q2 적용.
- 판정: 잃는 게 "spurious fail 로부터의 거짓 안심"뿐이면 → TRIM.

### Q4. "이 invariant 는 영속 진실인가, 초기 추측인가?" (P4)

- 검증: "이게 깨졌을 때 나는 그것을 _버그_ 라 부를까, _더 나은 설계_ 라
  부를까?" 후자가 상상되면 화석화 위험. `goal-design.md §5` case (a)/(b)/(c)
  로 분류.
- 판정: 추측에 가까움 → 게이트를 약하게(존재/계약 수준만) 두고, 강한 강제는
  테스트로.

### Q5. "이 메타 작업이 제품 가치에서 얼마나 먼가?" (P1, P7)

- 검증: 이 변경이 베타 사용자가 보는 표면(web viewer, CLI UX)과 몇 단계
  떨어져 있는가. 현재 메타:제품 LOC·프롬프트 비율을 함께 본다.
- 판정: 멀고 비싼 메타 작업은 **베타 후로 deferral**(별도 finding) —
  _"범위 밖은 신규 findings 로 남겨 나중에 이어서"_ (05-22) 패턴.

### Q6. "이 'resolved / green' 주장을 무엇으로 검증했는가?" (P8)

- 검증: finding frontmatter 의 `resolved` 와 `resolved_by`(커밋 SHA),
  그리고 본문 acceptance signal 을 **직접 재실행**해 대조.
  `bash scripts/completion-check.sh; echo exit:$?`.
- 판정: 주장과 재현이 어긋나면 → 상태를 정직하게 되돌리고(`partial`)
  blocker/status_notes 기록.

### Q7. "이 변경은 게이트를 _약화_ 하는가, _이전_ 하는가?" (P6)

- 검증: 제거하려는 검사에 대응 테스트가 **먼저** 존재/추가됐는가. 변경 후
  `bash scripts/completion-check.sh` 여전히 green 인가. prior goal 게이트를
  건드리면 `## Supersedes`(case c) 또는 enforcement-이전 선언(case b)이
  커밋/PR 에 있는가.
- 판정: 선언·테스트 이전 없는 게이트 삭제 → **HARD STOP**(정직성 위반,
  `goal-design.md §5` 위반). 절대 진행 금지.

### Q8. "나는 지금 이 설계에 반박할 수 있는가?" (P9)

- 검증: 점검자 스스로 이 산출물을 **없애자/뒤집자는 입장**을 한 번 세운다.
  그 반박이 P2~P7 의 검증을 통과해 살아남는가.
- 판정: 반박이 이기면 산출물을 고치고, 옹호가 이기면 _왜_ 살아남았는지 한
  줄 근거를 남긴다(다음 점검자를 위해).

### 판정 프레임 (블록 단위 한 줄 분류)

```
KEEP                     — 오직 게이트만 잡을 수 있고(Q1), 의도를 본다(Q2).
TRIM                     — 양식 강결합 제거, 허용 패턴만 남김(Q2,Q3).
MOVE-TO-TEST             — 테스트가 잡을 수 있음 → 테스트 먼저 추가 후 이전(Q1,Q7).
DELETE-WITH-DECLARATION  — §5 case (b)/(c) 선언 + 대응 테스트 동반 시에만(Q7).
HARD STOP                — 선언·테스트 없는 약화/삭제 시도. 진행 금지(P6).
DEFER                    — 제품에서 멀고 비싼 메타 작업 → 별도 finding(Q5).
```

---

## Part 3 — 대상별 빠른 점검 체크리스트

- **`goals/*.gates.sh`**: 각 게이트 블록에 Q1→Q2→Q3. 마지막 게이트가
  `check-gate-rigor.sh` 인지(rigor 메커니즘 누락 금지). LOC 예산 초과면 Q3.
- **`goals/*.next-task.sh`**: "처방(how)"인가 "무엇/순서(what)"인가 — 처방은
  P4 위반 소지(잠재력 제한). 위임 goal 의 얇은 힌트 패턴을 기준으로.
- **`scripts/`**: 한 스크립트가 한 책임인가. completion-check 가 매번 전체
  35 goal 을 도는 비용(Q5)이 정당한가 — incremental 가능성 검토.
- **findings 프로토콜**: frontmatter 스키마(`docs/findings/AGENTS.md`)와
  실제 상태가 일치하는가(Q6). 스냅샷/로그를 강제로 닫지 않았는가.
- **`cycles/*.md`**: 종료 조건이 기계 검증 가능한가(완료 명령 존재). Out of
  scope·Forbidden actions 가 P6/P4 와 일관되는가.

---

## Part 4 — 이 점검을 언제 트리거하나

- finding → goal **promote 직전** (불필요한 강제를 새로 심지 않도록).
- 어떤 `.gates.sh`/`.next-task.sh` 가 **LOC 예산을 초과**할 때.
- 메타 시스템 변경 PR 리뷰 시 (특히 게이트 약화/삭제를 포함하면 Q7 필수).
- 주기적 sweep (cycle 문서 작성 전) — 누적된 강결합/화석 invariant 정리.
- "이거 과한 거 아닌가?"라는 직감이 들 때 — 그 직감이 곧 P1~P9 의 신호다.

---

## 참조

- `docs/goal-design.md` §1.5 (gates 금지 패턴), §5 (immutability/case 분류)
- `scripts/check-gate-rigor.sh` (rigor 강제)
- `docs/findings/2026-05-23T1700-gates-over-coupling.md` (강결합 진단·migration)
- `guidelines/goal-iteration.md` (iteration 루프), `.claude/skills/commit/SKILL.md`
