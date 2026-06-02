---
title: "스냅샷 — WOW-3·4 activation 분석 + 디저젯된 프로젝트 개요 결정"
created_at: 2026-05-25T14:47:49Z
resolved: false
priority: P1
kind: snapshot
status_notes: |
  2026-06-03: re-verified — F1 shipped via goal 32, F2 via goal 33;
  F3/F4 remain independent queued children. Keep this snapshot as
  resolved: false reference-only rationale.
  2026-05-26: F2(project-overview-blueprint) closed via backend count
  contract + delegated goal 33 (commits 462164e..4b5d701); F3/F4 remain child work.
  2026-05-26: F1(web-viewer-de-jargon) closed via delegated goal 32
  (commits 629957b..1d4d672).
  분석/결정 스냅샷(rationale, goal 아님). 실행은 자식 findings로 분해:
  F1(웹뷰어 디저젯) · F2(프로젝트 개요 청사진) · F3(페르소나 dogfood 하니스) ·
  F4(GAP-A 생성 보조). 실유저 측정은 docs/practices/analytics.md.
related:
  - docs/findings/2026-05-25T1503-web-viewer-de-jargon.md
  - docs/findings/2026-05-25T1511-project-overview-blueprint.md
  - docs/findings/2026-05-25T1516-persona-dogfood-harness.md
  - docs/findings/2026-05-25T1520-gap-a-authoring-assist.md
  - docs/practices/analytics.md
  - form-data/vooster-icp-gap-analysis.md
  - form-data/vooster-early-access-summary.md
  - docs/00-overview.md
  - docs/claude/delegation.md
---

# 스냅샷 — WOW-3·4 activation 분석 + 디저젯된 프로젝트 개요 결정

## TL;DR

얼리액세스 42명으로 "충분히 매력적인가"를 점검: 가장 강한 와우는 전부 **둘째
세션·첫 변경 이후**의 retention 와우고, 첫-세션 activation 와우는 **WOW-3(막연한
입력 → 구조화된 전체 그림)** 하나뿐인데 미구현 갭(생성 보조) 위에 있다.
activation 와우의 표면은 UC 상세가 아니라 **프로젝트 개요**다. **결정:** 어려운
용어만 걷어낸 라이트 렌더로 출시하고 실제 반응을 관찰. 와우 = 생성 품질 × 가독
프레젠테이션.

이 문서는 **분석/결정(rationale) 스냅샷**이며 goal이 아니다. 실행은 아래 자식
findings로 분해된다.

> ⚠️ 근거 `form-data/`는 PII라 집계 수치/경로만 인용(실명·인용 없음).

---

## 1. 맥락

- 사용의 진짜 형태는 `사람 → 프롬프트 → 코딩 에이전트 → vspec` 간접 사용.
- 신청자: 비개발·입문층 **62%**, 솔로 메이커, **병렬 에이전트 언급 0건**
  (`form-data/vooster-early-access-summary.md`).
- **ICP ≠ 설계 페르소나**(`form-data/vooster-icp-gap-analysis.md`): 헤드라인
  (멀티 에이전트)과 ICP 페인 불일치, 진짜 강점(컨텍스트 보존·스펙 작성)은 가려짐.
- 본 스냅샷은 그 위에 **와우-타이밍 인사이트 + 웹뷰어 착지 결정**만 얹는다.

## 2. 와우 모먼트 맵

| 순간                                   | 강도     | 시점                    | 오늘         |
| -------------------------------------- | -------- | ----------------------- | ------------ |
| WOW-3 막연 입력 → 구조화 + 놓친 것까지 | 높음     | **첫 5분 (activation)** | ❌ 생성 갭   |
| WOW-1 새 세션 "이어서" — 안 까먹음     | **최고** | 둘째 세션 (retention)   | ✅ pinning   |
| WOW-2 "완료" 보고를 도구가 검증/차단   | 높음     | 변경/PR                 | 🟡 구조적만  |
| WOW-4 한 곳 바꾸면 영향 자동 표시      | 중상     | 변경 시                 | ✅ 스펙 수준 |

**인사이트: 와우가 back-loaded.** 강한 와우(1·2·4)는 retention. 유일한 첫-세션
activation(WOW-3)은 미구현 갭 위 → **time-to-wow를 앞당기는 게 매력도 레버.**

## 3. 결정 (헤드) — WOW-3·4는 프로젝트 개요를 공유

- WOW-3 감정 = **전체의 완성도·짜임새**(개요 레벨), journey path 최단(착지 화면).
- WOW-4(영향 표시)도 _개요에서 지도에 불 켜지는_ 그림이 가장 강함.
- → 두 와우가 **프로젝트 개요**를 공유. UC 상세는 2차(검증·다듬기).
- 현재 뷰어가 그걸 죽임(평면 리스트 + 생 Cockburn 용어) — 상세 근거는 F1/F2.

## 4. 분해 — 자식 findings (1 finding = 1 goal)

|                                           | 스코프                                      | 크기   | 상태            |
| ----------------------------------------- | ------------------------------------------- | ------ | --------------- |
| **F1** `…1503-web-viewer-de-jargon`       | 용어 캐논 라벨 + `?` popover, StatusPill    | ~1일   | P1 ship-now     |
| **F2** `…1511-project-overview-blueprint` | 평면→청사진(substance 카운트+예외)          | ~1.5일 | P1, F1 후속     |
| **F3** `…1516-persona-dogfood-harness`    | `claude -p` 페르소나 dogfood (WOW-3 프록시) | ~2–4일 | P1, 큐          |
| **F4** `…1520-gap-a-authoring-assist`     | GAP-A 생성 보조(에이전트-assisted)          | XL     | 로드맵, F3 의존 |

- 와우 = **생성 품질(F3·F4) × 가독 프레젠테이션(F1·F2)**. 라이트 출시(F1) 먼저,
  관찰(F3)로 진짜 변수(생성 품질) 측정 후 F4 크기 확정.

## 5. 관찰 (2-트랙)

- **(pre-beta) 프록시** = F3 `claude -p` 페르소나 dogfood. oracle = 결과 도달·
  substance·friction 스코어카드 + LLM-judge.
- **(post-beta) 실유저** = `docs/practices/analytics.md`. CLI는 100% 에이전트발
  → 만족도는 행동 프록시(churn/즉시수정·삭제 vs 생존·전진·복귀)로 간접 측정.
