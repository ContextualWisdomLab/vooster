---
title: "F3 — claude -p 페르소나 dogfood 하니스 (WOW-3 프록시 관찰)"
created_at: 2026-05-25T15:16:07Z
resolved: false
priority: P1
status_notes: |
  2026-06-03: re-confirmed unattended-unsafe (paid headless agent spawn +
  human-vetted oracle for persona thresholds, interpretation, and PII limits);
  keep queued, do not promote.
related:
  - docs/findings/2026-05-25T1447-activation-wow-project-overview.md
  - docs/findings/2026-05-25T1503-web-viewer-de-jargon.md
  - docs/findings/2026-05-25T1511-project-overview-blueprint.md
  - docs/claude/headless.md
  - docs/claude/delegation.md
  - form-data/vooster-icp-gap-analysis.md
---

# F3 — claude -p 페르소나 dogfood 하니스 (WOW-3 프록시 관찰)

## TL;DR

vspec의 실제 사용 형태는 `사람 → 프롬프트 → 코딩 에이전트 → vspec`이다. 그래서
매력도(와우)도 **헤드리스 코딩 에이전트(`claude -p`, opus 4.7)가 self-teaching
CLI만으로 vspec을 운전**하게 두고 관찰해야 한다. 사람은 페르소나 시나리오
프롬프트만 주고 vspec을 **직접 호출하지 않는다.** 이는 `docs/00-overview.md`
성공기준 #3("처음 보는 에이전트가 ai-guide만으로 대표 작업 완수")의 직접 검증이며,
실유저 측정(post-beta) 이전의 **프록시 관찰**이다 — 실유저가 아님(정직히).

부모 스냅샷: `docs/findings/2026-05-25T1447-activation-wow-project-overview.md`.
**큐에 보유**(별도 goal로 승격하지 않음).

## 무엇을 검증하나 — 실험 (A)

부모 finding의 2-요인 와우 중 **생성 품질** 절반: _에이전트 + vspec 분업으로
WOW-3(막연한 입력 → 빠짐없는 구조화 + 안 시킨 예외까지)가 실제로 터지는가_,
그리고 self-teaching CLI가 **저마찰**인가.

## 아키텍처

```
dogfood/
  consumer/        격리된 "고객사" 워크스페이스 (이 레포 CLAUDE.md 오염 차단)
    CLAUDE.md      "네 스펙은 vspec에 있다. vspec CLI로만 다뤄라. 모르면 ai-guide."
    .vspec/config  로컬 서버 + VSPEC 프로젝트 바인딩
  bin/vspec        PATH shim → node apps/cli/bin/run.js (+ VSPEC_CONFIG_PATH 격리)
  scenarios/       페르소나 저니 = 프롬프트 + 기대 end-state
  run.sh           시나리오별: claude -p → 관측 캡처 → 스코어카드 판정
  runs/<ts>/       transcript · cost · turns · verbs · 스코어카드
```

## 오라클 — 객관 스코어카드 3종 + 정성 보조

1. **결과 도달**(binary) — 기대 end-state 생성 여부(예: 구조화 UC ≥N개가 서버에
   존재). _서버 상태로 체크._
2. **substance**(WOW-3 본질) — 생성 UC의 Cockburn 칸이 안 비었나 + **프롬프트에
   없던 예외/엣지 ≥K개 자동 추가**했나. _서버 상태로 측정._
3. **friction**(time-to-wow) — turns · cost · CLI 에러 수 · `ai-guide`/`--help`
   조회 수 · 동일 엔티티 retry/churn. _stream-json transcript에서 추출._
4. (보조) **LLM-judge** — 2차 claude가 transcript+end-state로 "이 페르소나가 와우
   느낄까 + 어디서 fizzle" 정성 요약.

→ 1·2 = 생성 품질, 3 = self-teaching/time-to-wow.

## v1 스코프

- **WOW-3 activation, 페르소나 2명**: ① 막막한 쌩비개발자, ② 기획형 비개발 PM.
  (집계 테마 기반 **합성 페르소나** — 얼리액세스 실명/인용 **금지**, PII.)
- **보류:** WOW-1 2-세션, WOW-2/4, 나머지 페르소나, goal 승격.

## 메커니즘

- 서버: 로컬 dev (`VSPEC_AUTH_STUB=1`, docker `vspec-db` healthy 확인됨,
  `DATABASE_URL=...localhost:5434`) + seed(`scripts/dogfood-smoke.ts` 패턴 재사용).
- CLI: 전역 미설치 → shim. 격리 `VSPEC_CONFIG_PATH`(전역 `~/.vspec/config.json`
  오염 방지 — snapshot H1).
- `claude -p` (opus 4.7): `--output-format stream-json --verbose`
  `--allowedTools "Bash(vspec *),Read,Edit"` `--permission-mode acceptEdits`
  `--max-budget-usd <cap>`. (`--bare` 미사용 — consumer/CLAUDE.md를 일부러
  로딩; consumer엔 프로젝트 훅 없음.) 근거: `docs/claude/headless.md`.

## Acceptance signal (이 finding이 닫히는 기준)

- `dogfood/`가 존재하고 `run.sh`가 WOW-3 시나리오 2개를 end-to-end 실행한다.
- 실행마다 `runs/<ts>/`에 스코어카드(결과 도달·substance·friction) + transcript +
  LLM-judge 요약이 기록된다.
- 최소 1회 실측 결과가 부모 스냅샷에 요약된다(WOW-3가 닿았는지/어디서 fizzle).

## 크기

~2–4일 (탐색적 — 오라클·시드·flaky 다룸). 별도 goal 승격은 보류.

## Open / deferred

- WOW-1 retention(2-세션: session 2를 `--continue` 없이 새 호출 → vspec에서
  컨텍스트 복구하나), WOW-2/4.
- 나머지 페르소나(주니어·개발자, 메타하네스 시니어).
- 실유저 측정은 본 프록시가 아니라 `docs/practices/analytics.md`(post-beta).
- 결과가 크면 goal로 승격.

## 위임 하니스와의 관계

본 `run.sh`는 codex→Claude 위임 오케스트레이터(`scripts/delegate-to-claude.sh`,
`docs/claude/delegation.md`)와 형제 headless-loop다 — 차용할 결정론 패턴: 최종
result 이벤트에서 cost/`is_error`를 jq로 파싱, 누적 예산·정체(stall) 캡, cwd
격리(여기선 `dogfood/consumer/`). 단 본 finding은 위임 _대상_ 이 아니라 관찰
도구이고, transcript를 위해 `stream-json`을 쓰는 점만 다르다.
