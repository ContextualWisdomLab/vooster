# 분석·계측 정책 (Analytics & Instrumentation)

> **상태:** 초안(라이트). 정확한 이벤트 스키마/서베이 문구/임계값은 **베타
> 직전 확정(deferred)**. 이 문서는 "당장 수준"의 방향과 불변 원칙만 박는다.
>
> **위치 근거:** 번호 시리즈(`docs/0N`)는 "제품이 무엇인가(spec)", 루트
> `guidelines/`는 "어떻게 만드나", 본 디렉토리 `docs/practices/`는 **"제품을
> 어떻게 운영/관측하나"**. 첫 입주 문서.
>
> 관련: `docs/findings/2026-05-25T1447-activation-wow-project-overview.md`
> (이 정책의 post-beta 측정 수요를 만든 finding).

---

## 0. 목적

베타 이후 **유저 만족도 / 와우 도달**을 측정한다. 도구는 이미 연동된
PostHog를 쓴다(신규 도입 아님). 인-스코프 = 제품 분석. 아웃 = 인프라 로깅·
에러 모니터링(별개).

---

## 1. 원칙 — facts-only 로깅, 해석은 downstream 도출

**결론을 로깅하지 않는다. 나중에 결론을 계산할 수 있는 *사실*을 로깅한다.**

- ❌ `wow_reached`, `usecase_structured_well`, churn 플래그 같은 **해석을
  이벤트에 박지 말 것** — 제품이 바뀌면 의미를 잃고 죽은 데이터가 된다.
- ✅ "UC가 시각 T에 생성됨, revision R, actor=agent" 같은 **사실**만 — 제품이
  바뀌어도 참이고, 과거 데이터에서 새 지표를 **재도출** 가능.
- 그래서 churn/survival 같은 만족도 모델은 **이벤트 스키마가 아니라 분석
  레이어(쿼리/대시보드)**에 산다. 쿼리는 데이터 손실 없이 싸게 다시 쓴다.

이 원칙이 유지보수성과 "기능 크게 바꿀 때 이전 데이터가 짐이 되는" 문제를
구조적으로 해소한다.

## 2. 원칙 — privacy 바닥 (안 바뀜)

스펙 본문 = 유저 영업비밀급 IP. **절대 미수집:** 스펙 본문·이해관계자·프롬프트·
파일 내용·PII. **수집 가능:** ID·enum·timestamp·count·hash. 세션 리플레이는
마스킹 필수. CLI 텔레메트리 기본값(opt-in/opt-out)은 deferred지만 보수적으로.

## 3. 원칙 — 사람은 안 보인다, 행동으로 추론한다

**vspec CLI의 모든 호출은 에이전트발(發)로 가정.** 사람은 프롬프트로만 지시하고
에이전트의 채팅은 우리 제품 밖이라 못 본다. → CLI 레이어엔 **직접적인 사람 신호가 0.** 만족도는 에이전트-구동 이벤트의 **행동 패턴으로 간접 추론**한다(§6).
(웹 뷰어 이벤트만 _후보_ 직접 신호 — 비중은 deferred.)

---

## 4. vspec 고유 substrate — 이미 사실이 DB에 있다

만족도 신호 대부분은 **기존 revision history**에서 도출된다: 모든 변경 = revision,
생성/수정/archive/revert/status전이/세션이 다 기록됨.

- 대부분 **새로 심을 게 없다.** revision 테이블이 곧 행동 substrate.
- PostHog엔 **DB가 못 가진 것만**: 웹 뷰어 사람 신호, 가입/복귀, 크로스-서피스
  식별. **이중 로깅 금지.**

---

## 5. 균일 이벤트 스키마 (초기, 작고 안정적)

단일 균일 도메인-활동 이벤트 + 웹 이벤트 소수. 공통 **facts만**, 의미/점수/와우
플래그 없음.

```
공통 프로퍼티 (모든 이벤트):
  entity_type   usecase | scenario | step | actor | stakeholder | ...
  entity_id
  action        created | updated | archived | reverted | status_changed | ...
  revision_id
  actor_type    agent | human         # CLI는 사실상 항상 agent. --format=agent / API key로 판별
  surface       cli | api | web
  workspace_id  (PostHog group)
  project_id
  session_id
  ts
```

> ⚠️ **"너무 단조"의 함정:** 균일하게 하되 도출에 필요한 join key
> (`entity_id`·`revision_id`·`ts`·`actor_type`)는 반드시 남길 것. 빠지면 churn을
> _도출할 수 없게_ 된다.

웹(사람 후보 신호, 최소): `overview_viewed`, `signup`, `return`.

---

## 6. 파생 지표 (방향만 — 분석 레이어에 산다)

만족도 ≈ **교정(correction) vs 생존(survival)** 모델 (Copilot 수락률 발상):
에이전트가 구조를 제안하고, 사람이 얼마나 _고쳐야 했나_ + 위에 _계속 쌓았나_.

- 🔴 **불만 프록시:** 생성 직후 단시간 반복 수정(edit-churn), 즉시 수정/삭제/
  archive, `revert`, 동일 UC 재생성, 충돌 keep-local, 방치/이탈.
- 🟢 **만족 프록시:** 생성물이 손 안 타고 생존(가산 확장만), 전진 진행
  (create→step→commit, 백트래킹 없음), status 승격(DRAFT→APPROVED),
  `session complete`, **복귀 후 _이어서_ 작업(WOW-1)**, breadth 성장.
- ⚠️ "생존" 단독은 모호(좋아서 vs 포기). **반드시 progression/retention과 짝지어**
  해석.

핵심 지표(도출): **edit-churn rate · survival rate · progression/retention.**
1차 단위 = 엔티티 라이프사이클(UC), 2차 = 프로젝트-over-time.

와우 매핑: WOW-3 = 생성 UC 저-churn 생존 + 자동예외 안 지워짐 / WOW-1 = 복귀 후
이어서 / WOW-2·4 = impact·block 본 뒤 revert 없이 전진.

---

## 7. Open / deferred (베타 직전 확정)

- 균일 이벤트 스키마 필드 freeze, 웹 이벤트 최종 셋.
- CLI 텔레메트리 기본 opt-in/opt-out.
- 스펙 민감성 때문에 PostHog self-host 여부.
- 웹 직접신호를 만족도에 *보조*로 둘지, 100% 행동 추론으로 갈지.
- time-to-wow: 사람 의도 시작점이 없으니 정밀 타임스탬프 대신
  survival+retention을 와우 지표로 쓸지(권고) vs "time-to-stable-structure"로
  재정의할지.
- PostHog Survey(와우 직후 1탭 👍/👎)·세션 리플레이 도입 여부.
