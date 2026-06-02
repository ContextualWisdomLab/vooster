---
title: "F4 — GAP-A 자연어→유스케이스 생성 보조 (에이전트-assisted, 로드맵)"
created_at: 2026-05-25T15:20:22Z
resolved: false
status_notes: |
  2026-06-03: blocked on F3 observation; doctor/verb-phrase foundations exist,
  but elicitation design and scope remain open. Keep open.
related:
  - docs/findings/2026-05-25T1447-activation-wow-project-overview.md
  - docs/findings/2026-05-25T1516-persona-dogfood-harness.md
  - form-data/vooster-icp-gap-analysis.md
  - apps/api/src/application/usecases.ts
  - apps/cli/src/commands/ai-guide.ts
---

# F4 — GAP-A 자연어→유스케이스 생성 보조 (에이전트-assisted, 로드맵)

## TL;DR

WOW-3의 *진짜 변수*는 뷰어(프레젠테이션)가 아니라 **생성 품질**이다. vspec은 빈
Cockburn 칸을 **강제하지만 채우지 않는다**(GAP-A, `form-data/
vooster-icp-gap-analysis.md`). 입문층 62%에겐 빈 템플릿이 오히려 벽. → **vspec이
LLM을 재구현하지 말고, 이미 거기 있는 *코딩 에이전트*가 잘 저작하도록 유도/
스캐폴딩**한다(방향 b+c). **로드맵 — 크기·내용은 F3 실측 후 확정.**

부모 스냅샷: `docs/findings/2026-05-25T1447-activation-wow-project-overview.md`.
우선순위 미부여(로드맵; pre-beta 해저드나 cleanup이 아님).

## 인사이트

vspec의 차별점(Cockburn 구조 강제)이 입문층에겐 진입장벽으로 뒤집힌다. "막연한
한 줄 → 빠짐없는 구조 + 안 시킨 예외까지"라는 WOW-3 감정은 *구조 강제*만으론 안
나오고 _내용이 채워져야_ 난다. 현재 코드엔 LLM 의존성 0(생성 미지원).

## 결정 — 누가/어떻게 채우나: (b) 에이전트-assisted + (c) 하이브리드

컨셉이 `사람 → 에이전트 → vspec`이므로 **생성은 코딩 에이전트의 몫**, vspec은
그걸 _잘 하게 만드는_ 쪽으로 간다. vspec은 LLM을 갖지 않는다(boring solution).

**(b) 에이전트가 잘 채우도록 유도 — vspec의 affordance 강화:**

- `ai-guide` 저작 지침 강화(현재 스텁, snapshot B3) — 좋은 유스케이스/예외를
  어떻게 채우는지 에이전트에게 가르침.
- verb-phrase 휴리스틱 broaden(snapshot A13, `apps/api/src/application/
usecases.ts:207`) + `suggested_titles` 노출 — 에이전트가 막히지 않게.
- **doctor식 갭 탐지** — "이 UC에 예외/이해관계자 없음 → 추가하라"를 에이전트에게
  되돌려줘 빈칸을 _능동적으로_ 메우게.

**(c) 입문층 elicitation 스캐폴딩 (핵심 가설):**

- 입문층 와우 = **에이전트가 올바른 질문을 던져 "막막함"을 해소**("토론 유도로
  구체화", "기획 수준 어디까지" 류 신호).
- vspec은 **빈칸 탐지 + 물어볼 질문 세트(scaffolding)**를 제공하고, _에이전트가
  사람과 토론하며_ 채운다. vspec은 질문 구조만, 대화는 에이전트.

## 컨티전시 — F3에 의존 (크기 미확정 이유)

- F3(A)가 "에이전트가 현재 CLI로도 빈칸을 잘 채운다"를 보이면 → F4는 **작아짐**
  (ai-guide·휴리스틱·doctor 갭 탐지 튜닝 수준).
- "에이전트가 헤맨다/얕게 채운다"를 보이면 → F4는 **커짐**(elicitation 스캐폴딩
  본격 빌드).
- **F3 실측 전엔 크기 확정 불가** → 로드맵에 둔다.

## Acceptance signal (이 finding의 다음 동작)

- F3 실측 결과를 받아 본 finding을 구체화하고 크기를 확정한다.
- 진행 시에도 **vspec은 LLM 의존성을 추가하지 않는다**(scaffolding/affordance
  경로 유지). 위반하면 방향 재검토.

## 크기

XL(멀티위크), 단 **F3 결과에 따라 크게 축소 가능.** 즉시 스코프 밖.

## Open / deferred

- elicitation 질문 세트의 구체 설계(어떤 빈칸에 어떤 질문).
- doctor 갭 탐지를 에이전트 envelope(`--format=agent`)로 어떻게 되돌릴지.
- 랜딩 카피("자연어를 구조화")의 오버프로미스 정정 vs F4로 실현(icp-gap §2 GAP-A).
