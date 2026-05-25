---
title: "F2 — 프로젝트 개요 = 구조화 청사진 (substance 카운트 + 예외 강조)"
created_at: 2026-05-25T15:11:52Z
resolved: false
priority: P1
related:
  - docs/findings/2026-05-25T1447-activation-wow-project-overview.md
  - docs/findings/2026-05-25T1503-web-viewer-de-jargon.md
  - apps/web/app/(app)/projects/[key]/page.tsx
  - apps/web/app/data.tsx
  - docs/claude/delegation.md
---

# F2 — 프로젝트 개요 = 구조화 청사진 (substance 카운트 + 예외 강조)

## TL;DR

프로젝트 페이지가 제목+상태만 나열한 평면 리스트(목차)라 WOW-3 activation 감정
("막연히 던졌는데 _빠짐없이_ + _예외까지_ 정리됐네")이 안 터진다. → **플랫 목록을
유지하되 substance 카운트(유스케이스·액터·시나리오 수)와 UC별 예외 카운트 +
"대비된 예외 상황 N건" 블록을 얹어** 한눈에 "꽉 찬/단단한" 느낌을 준다.

부모 스냅샷: `docs/findings/2026-05-25T1447-activation-wow-project-overview.md`.
**F1에 의존**(용어 라벨·`?` popover·`labels.ts`/`TermLabel` 재사용).

## 스코프 / 결정

- **D1 = (c) 플랫 + 예외 강조 + substance 카운트.** 액터/레벨 그룹핑 안 함
  (솔로 프로젝트는 액터가 얇고, 레벨은 추상적 → 그룹이 깨지거나 무의미).
  플랫은 솔로/대형 모두 안 깨지고 _완성도·예외 대비_ 감정을 직접 준다.
- **D2 = (i) 기존 리스트 enrich + 액터 엔드포인트 재사용.** 새 집계 엔드포인트
  신설 안 함(라이트).
- **예외 표시 = 카운트만.** "결제 실패 · 재고 부족" 같은 *조건 텍스트 칩*은
  extension condition 문자열이 더 필요 → **보류**(top-N condition enrich는 후속).
- **명시적 보류(과설계 금지):** 관계 그래프, 완성도 스코어, 라이브 리프레시,
  impact 오버레이(WOW-4) — 전부 F2 밖.

## 화면 (목표)

```
결제 서비스
유스케이스 12 · 액터 4 · 시나리오 28        ← 한눈에 "꽉 찼다"

· 주문하기        [확정]   예외 3
· 환불 요청하기    [초안]   예외 2
· 주문 상태 보기   [초안]   예외 1

⚠ 대비된 예외 상황 28건 ⓘ
```

## 구현

**백엔드:**

- `GET /v1/projects/:projectId/usecases` 응답에 UC별 `scenario_count`·
  `extension_count` 추가. (현재 응답은 title/level/status/primary_actor만 —
  `apps/web/app/data.tsx:11-17` UsecaseSummary 참조.)
- **DB 집계로 한 번에** 계산(UC마다 추가 쿼리 도는 N+1 금지).
- 액터 수는 **기존 `GET /v1/projects/:projectId/actors` 재사용**(신규 라우트 없음).

**프론트:**

- `apps/web/app/data.tsx`: `UsecaseSummary`에 카운트 2개 추가 +
  `fetchProjectActors()` 한 줄. 합계("시나리오 28")는 클라이언트 합산.
- `apps/web/app/(app)/projects/[key]/page.tsx`: 상단 substance 카운트 줄 +
  행마다 `예외 N` + 하단 "대비된 예외 상황 N건" 블록. F1의 라벨/`?` popover 재사용.

## Gate (universal claim)

1. `GET /v1/projects/:projectId/usecases`의 **모든** UC 항목이 `scenario_count`·
   `extension_count`를 포함한다(API 테스트로 열거).
2. 개요 페이지가 substance 카운트 줄(유스케이스·액터·시나리오) + UC별 예외
   카운트 + "대비된 예외 상황 N건" 블록을 렌더한다.
3. 카운트 집계가 **단일 집계 쿼리**로 수행된다(UC 수에 비례하는 N+1 쿼리 아님).

## Acceptance signal

- 위 gate + list 응답 카운트 정확성 테스트(시나리오/확장 N개 시드 → 카운트 일치).
- 개요 렌더 스냅샷/테스트에서 카운트 줄과 예외 블록이 보인다.

## 크기

~1.5일 (백엔드 카운트 enrich + 집계 쿼리 + 프론트 개요 + 테스트). F1 선행 필요.

## Open / deferred

- 예외 _조건 텍스트 칩_(top-N condition enrich).
- 액터/레벨/기능영역 그룹핑(라이트 출시 반응 본 뒤 결정).
- 관계 그래프·완성도 스코어·라이브 리프레시·impact 오버레이(WOW-4).

## Promotion (위임)

**혼합 goal**이다 — 백엔드(usecases 응답 `scenario_count`/`extension_count`
enrich + 단일 집계 쿼리)는 codex의 TDD 영역이고, 프론트(개요 페이지)는
presentation이다. whole-goal 위임만 구현된 현재는 **슬라이스-레벨 위임**
(`docs/claude/delegation.md`의 Open decision) 케이스라: 백엔드 sub-goal(codex)과
프론트 claude-owned sub-goal로 **분할**하거나, 분할 전까진 codex-led로 둔다
(F1 claude-owned 선행 의존은 그대로 유지).
