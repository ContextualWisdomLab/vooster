---
title: "F1 — 웹 뷰어 디저젯: 캐논 용어 라벨 + ? popover 용어집"
created_at: 2026-05-25T15:03:32Z
resolved: false
priority: P1
related:
  - docs/findings/2026-05-25T1447-activation-wow-project-overview.md
  - apps/web/app/components/StatusPill.tsx
  - apps/web/app/(app)/projects/[key]/usecases/[ucKey]/page.tsx
  - apps/web/app/(app)/projects/[key]/page.tsx
  - apps/web/lib/labels.ts
  - apps/web/DESIGN.md
  - docs/claude/delegation.md
---

# F1 — 웹 뷰어 디저젯: 캐논 용어 라벨 + ? popover 용어집

## TL;DR

웹 뷰어가 `primary_actor`/`main_scenario`/`extensions`/`stakeholder_interests`
같은 **코드 필드명(snake_case)을 그대로 헤더로** 노출하고, StatusPill은 스펙과
다른 enum을 써서 라벨이 대부분 raw로 떨어진다. → **라벨은 캐논 용어(유스케이스·
액터·확장…)로 단정하게 표기하고, 설명이 필요한 곳엔 우측 `?` 아이콘 + popover로
description을 on-demand 제공**한다. 용어를 paraphrase로 치환하지 않음(라벨 안정·
유지보수↑, 모르는 사용자는 눌러서 학습).

부모 스냅샷: `docs/findings/2026-05-25T1447-activation-wow-project-overview.md`
(WOW-3·4 activation 분석). 본 F1은 그 결정의 **첫 출고 단위(라이트 출시)**.

## 스코프 경계 (중요)

- **용어 표기 + 용어집 popover만.** 구조 변경·새 데이터 fetch **없음** → 그건
  F2(프로젝트 개요 = 구조화 청사진).
- 프로젝트 페이지는 여전히 리스트. 메타 문자열·헤더 라벨만 손본다. **데이터
  중립** → gate 깨끗, ~1일.

## 근거 (현재 raw 노출)

- `apps/web/app/(app)/projects/[key]/usecases/[ucKey]/page.tsx` — 헤더가
  `primary_actor`(:60), `level`(:68), `status`(:74), `main_scenario`(:83),
  `extensions`(:93), `stakeholder_interests`(:101).
- `apps/web/app/(app)/projects/[key]/page.tsx:39,54` — H1 `Use cases`,
  메타 `{key} · {level} · {primary_actor}`.
- `apps/web/app/components/StatusPill.tsx:4-10` — `STATUS_STYLES`가
  `DRAFT/READY/IN_PROGRESS/DONE/BLOCKED` (스펙: `DRAFT/IN_REVIEW/APPROVED/
DEPRECATED`). 대부분 `DEFAULT_STYLE`로 떨어지고 라벨도 raw enum(:24).

## 내용 — 용어 + 용어집(popover)

> 표기 *원칙*은 `apps/web/DESIGN.md`. 아래 구체 용어집은 **이 finding이 보유**하며
> `apps/web/lib/labels.ts`가 구현한다.

**라벨 = 캐논 용어, `?` popover = description.**

| 코드 필드               | 라벨(용어)        | `?` popover description                                   |
| ----------------------- | ----------------- | --------------------------------------------------------- |
| `Use cases` (H1)        | 유스케이스        | 사용자가 시스템으로 달성하는 하나의 목표 단위             |
| `primary_actor`         | 주요 액터         | 이 유스케이스를 주로 수행하는 사용자/시스템               |
| `level`                 | 레벨              | 유스케이스의 추상화 수준 (요약 / 사용자 목표 / 하위 기능) |
| `status`                | 상태              | (자명 — popover 불필요)                                   |
| `main_scenario`         | 메인 시나리오     | 모든 것이 정상일 때의 기본 성공 흐름                      |
| `extensions`            | 확장              | 기본 흐름에서 벗어나는 조건과 그 처리                     |
| `stakeholder_interests` | 이해관계자 관심사 | 누구의 어떤 가치가 보호되어야 하는가                      |

**enum 값 라벨 (popover 없이 단순 표기):**

- level: `SUMMARY`=요약, `USER_GOAL`=사용자 목표, `SUBFUNCTION`=하위 기능
- status: `DRAFT`=초안, `IN_REVIEW`=검토 중, `APPROVED`=확정, `DEPRECATED`=폐기

**그대로 두는 것:** `main_scenario` 스텝 `{actor} {action}`은 이름+문장이라
jargon 아님 → 라벨만 손봄.

**구현 시 확인 항목:** extension `outcome`(`page.tsx:95`, 데모값 `"FAILURE"`)이
enum인지 자유텍스트인지 코드 미확인. enum이면 번역 대상(`FAILURE`=실패 시 처리
등), 자유텍스트면 그대로.

## 접근 (라이트)

- `apps/web/lib/labels.ts`(신규): `levelLabel()`·`statusLabel()` enum 맵 +
  용어/description 용어집(`GLOSSARY`).
- `?` popover 컴포넌트: shadcn `Popover`(또는 `HoverCard`/`Tooltip`) — 미설치 시
  추가. 작은 래퍼 `TermLabel`(용어 텍스트 + `?` 아이콘 + popover) 1개.
- StatusPill: 스펙 상태 4종 매핑 + 한국어 라벨.
- 두 페이지의 raw 헤더를 `TermLabel`/라벨 헬퍼로 교체.
- **한국어 하드코딩, i18n 없음**(ICP·랜딩 모두 한국어, 베타까지 충분).

## Gate (universal claim)

1. 두 페이지 파일에 raw 헤더 리터럴(`primary_actor`/`main_scenario`/`extensions`/
   `stakeholder_interests`)이 **JSX 텍스트로 0건**.
2. StatusPill이 스펙 상태 4종(`DRAFT/IN_REVIEW/APPROVED/DEPRECATED`)을 **전부
   매핑**(어느 것도 default로 안 떨어짐).
3. `labels.ts`가 level·status enum 값을 **빠짐없이** 커버(exhaustive).
4. 용어집 항목(액터/레벨/메인 시나리오/확장/이해관계자 관심사)이 각각 popover
   description을 가진다.

## Acceptance signal

- 위 gate 4종 통과 + `labels.ts` 단위테스트(매핑 exhaustive, 미지 enum 가드).
- 두 페이지 렌더에 snake_case·raw enum 문자열이 보이지 않고, 용어 옆 `?` popover로
  설명이 뜬다.

## 크기

~1일 (라벨 헬퍼·용어집 + `?` popover 컴포넌트 + 두 페이지 적용 + 단위테스트).

## Promotion (위임)

순수 presentation 작업(apps/web 한정, 데이터 중립 → gate 깨끗)이라 goal로 승격
시 **claude-owned 위임 goal**이 된다 — `## Delegation` (owner: claude, cwd:
apps/web). 위 "Gate (universal claim)"가 그대로 `goals/<n>.gates.sh`가 되고,
승격 goal의 next-task 힌트는 처방을 얇게 둔다(용어집/popover의 정확한 코드 대신
"무엇"만 — Claude의 표기 판단을 살림). 계약: `docs/claude/delegation.md`.
