# Ideation

이 문서는 Vooster Spec 제품 아이디어 구체화를 위해, 사용자와 Claude가 나눈 대화를 기록한다.

---

'앨리스터 코오번의 유스케이스' 에서 유스케이스를 정의하는 기법을 알려줘

---

앨리스터 코오번(Alistair Cockburn)의 『Writing Effective Use Cases』에서 제시하는 유스케이스 정의 기법을 정리해 드리겠습니다.

## 핵심 개념

코오번은 유스케이스를 "특정 목표를 달성하기 위해 액터(actor)와 시스템이 상호작용하는 행위들의 계약"으로 정의합니다. 단순한 기능 명세가 아니라 **이해관계자들의 목표와 이익을 보호하는 계약서**라는 관점이 핵심입니다.

## 1. 범위(Scope)와 수준(Level)의 구분

코오번 기법의 가장 특징적인 부분은 유스케이스의 **추상화 수준**을 명시적으로 구분하는 것입니다. 그는 아이콘(고도 비유)으로 수준을 표현합니다.

- **요약 수준(구름 ☁️)**: 매우 높은 추상화, 여러 사용자 목표를 묶음
- **사용자 목표 수준(바다 🌊)**: 기본 단위. 한 액터가 한 번에 달성하려는 목표 (예: "주문하기")
- **하위 기능 수준(물고기 🐟)**: 사용자 목표를 지원하는 세부 기능 (예: "로그인하기")
- **너무 낮은 수준(조개 🐚)**: 보통 다루지 않음

가장 중요한 것은 **사용자 목표 수준(바다 수준)**이며, 이것이 작성의 기준점이 됩니다.

## 2. 이해관계자와 이익(Stakeholders and Interests)

코오번이 강조하는 독창적 개념입니다. 유스케이스는 주 액터(primary actor)뿐 아니라 **모든 이해관계자의 이익을 보호**해야 합니다.

예를 들어 "현금 인출" 유스케이스에서:

- 고객: 빠르고 정확하게 돈을 받기를 원함
- 은행: 사기를 막고 정확한 기록을 원함
- 규제기관: 자금세탁 방지 정보를 원함

각 단계는 누군가의 이익을 보장하는 행동이어야 합니다.

## 3. 전제조건·성공보장·최소보장(Preconditions, Guarantees)

- **전제조건(Preconditions)**: 유스케이스가 시작되기 전에 반드시 참이어야 하는 것
- **최소보장(Minimal Guarantees)**: 어떤 경로로 끝나든(실패해도) 시스템이 보장하는 것
- **성공보장(Success Guarantees)**: 주 시나리오가 성공했을 때 보장되는 것

이 세 가지는 유스케이스 종료 시점의 시스템 상태를 명확히 합니다.

## 4. 주 성공 시나리오(Main Success Scenario)

번호가 매겨진 3~9개 정도의 단계로 구성합니다. 각 단계는 다음 형식을 따릅니다.

> "주체가 목표를 달성한다"

예시:

1. 고객이 카드를 삽입한다.
2. 시스템이 PIN을 요청한다.
3. 고객이 PIN을 입력한다.
4. 시스템이 PIN을 확인한다.

각 단계는 **목표 지향적**이어야 하며, UI 세부사항("버튼을 클릭한다")이 아니라 의도("PIN을 입력한다")를 적습니다.

## 5. 확장(Extensions) — 예외 흐름

코오번 기법의 가장 강력한 부분입니다. 각 단계에서 발생할 수 있는 **모든 실패와 대안**을 체계적으로 다룹니다.

표기법:

- `3a`: 3번 단계의 첫 번째 대안
- `3a1, 3a2`: 그 대안의 처리 단계
- `*a`: 모든 단계에서 발생 가능한 상황

예시:

```
4a. PIN이 틀린 경우:
    4a1. 시스템이 재입력을 요청한다.
    4a2. 3회 실패 시 카드를 회수한다 (유스케이스 종료).
*a. 정전이 발생한 경우: 거래를 취소하고 카드를 반환한다.
```

## 6. 작성 형식의 단계적 정제

코오번은 **한 번에 완벽하게 쓰지 말고 단계적으로 작성**할 것을 권합니다.

1. **액터-목표 목록** 만들기 → 어떤 유스케이스가 필요한지 식별
2. **요약(Brief) 형식**: 2~3문장 단락
3. **캐주얼(Casual) 형식**: 자유로운 단락 형태
4. **완전한 형식(Fully Dressed)**: 모든 필드를 갖춘 정식 템플릿

## 7. 완전한 형식(Fully Dressed) 템플릿

```
유스케이스 이름: (동사구로 — "주문을 처리한다")
범위: (시스템 경계)
수준: (사용자 목표 / 하위 기능)
주 액터:
이해관계자와 이익:
전제조건:
성공보장:
최소보장:
트리거:
주 성공 시나리오: 1, 2, 3...
확장: 1a, 2a...
기술 및 데이터 변형 목록:
```

## 실무 팁

코오번이 반복해서 강조하는 원칙들입니다.

- **시스템 내부 동작이 아니라 액터와 시스템 사이의 상호작용**을 적는다
- 능동태와 현재시제를 쓴다
- "검증한다"처럼 결과를 단언하는 동사를 쓰고, "검증을 시도한다" 같은 모호한 표현을 피한다
- UI 디자인을 유스케이스에 섞지 않는다
- 유스케이스 다이어그램은 보조 도구일 뿐, **텍스트가 본체**다

코오번 기법의 본질은 "사용자가 시스템으로 무엇을 이루려 하는가"를 이해관계자 관점에서 계약처럼 명확히 기술하는 것입니다. 특정 부분(예: 확장 흐름 작성법, 이해관계자 식별 등)을 더 자세히 보고 싶으시면 말씀해 주세요.

---

엘라스터 코오번 방식으로 유스케이스를 관리하는데 특화된 saas를 만들고싶다.
이 saas는 cli, api 방식으로도 이용할 수 있다.

일단 어떤 도메인 entity들이 필요할까?

---

좋은 프로덕트 아이디어입니다. 코오번 방식의 풍부한 구조는 일반 이슈 트래커로는 표현하기 어렵고, Notion·Confluence 같은 범용 도구는 그 구조를 강제하지 못합니다. 전용 SaaS의 자리가 분명히 있습니다.

도메인 엔티티를 설계할 때 가장 중요한 결정은 **"코오번의 개념을 얼마나 충실히 1:1로 매핑할 것인가"**입니다. 너무 충실하면 무겁고, 너무 단순하면 차별점이 사라집니다. 균형을 잡아 설계해 보겠습니다.

## 엔티티 분류 개요

엔티티를 5개 계층으로 묶어 보겠습니다.

```
1. 조직 계층     : Workspace, Project, User, Team
2. 핵심 도메인   : UseCase, Actor, Goal, Stakeholder, Scenario, Step, Extension
3. 관계·구조    : ActorGoalList, Glossary, SystemBoundary
4. 협업·버전    : Revision, Comment, Review, Approval
5. 통합·확장    : GherkinExport, Link, Attachment, Tag, ApiKey
```

각 계층을 차례로 보겠습니다.

---

## 1. 조직 계층 (Tenancy)

멀티테넌트 SaaS의 기본 토대입니다.

### `Workspace`

가장 상위 컨테이너. 회사·조직 단위.

- `id`, `name`, `slug` (URL용)
- `plan` (free/pro/enterprise)
- `created_at`, `owner_id`
- `settings` (기본 유스케이스 템플릿, 워크플로 설정 등)

### `Project`

워크스페이스 내의 프로젝트. 보통 하나의 시스템/프로덕트에 대응.

- `id`, `workspace_id`, `name`, `key` (예: "PAY", "AUTH")
- `description`, `system_boundary_id`
- `default_template_id`
- `visibility` (private/internal/public)

**설계 포인트**: 프로젝트는 "하나의 시스템 경계(System under Discussion)"에 대응합니다. 코오번이 강조한 "범위(Scope)" 개념이 프로젝트 수준에서 자연스럽게 표현됩니다.

### `User`

플랫폼 사용자.

- `id`, `email`, `name`, `avatar_url`
- `auth_provider`, `last_login_at`

### `Membership`

사용자-워크스페이스-역할 매핑.

- `id`, `user_id`, `workspace_id`
- `role` (owner/admin/editor/reviewer/viewer)
- `joined_at`

### `Team`

워크스페이스 내 팀(선택적).

- `id`, `workspace_id`, `name`
- 멤버는 별도 `TeamMembership` 테이블로 관리

---

## 2. 핵심 도메인 — 코오번 개념 매핑

여기가 이 SaaS의 본질입니다.

### `UseCase` (가장 중요)

유스케이스 자체. 코오번 양식의 모든 필드를 표현해야 합니다.

```
- id
- project_id
- key                  # "PAY-001", 사람이 읽는 ID
- title                # 동사구 ("결제를 완료한다")
- scope                # 시스템 경계 참조
- level                # enum: SUMMARY / USER_GOAL / SUBFUNCTION
                       #       (코오번의 cloud/sea/fish)
- level_summary_parent_id  # 상위 요약 유스케이스 (있다면)
- primary_actor_id     # FK -> Actor
- status               # DRAFT / IN_REVIEW / APPROVED / DEPRECATED
- format               # BRIEF / CASUAL / FULLY_DRESSED
                       # 단계적 정제 수준
- trigger              # 트리거 텍스트
- preconditions        # 텍스트 (또는 별도 Precondition 엔티티)
- success_guarantee    # 텍스트
- minimal_guarantee    # 텍스트
- frequency            # 발생 빈도 (optional)
- priority             # 우선순위
- complexity_estimate  # 추정 복잡도
- created_at, updated_at, created_by, updated_by
- current_revision_id  # 현재 버전 참조
```

**설계 포인트**:

- `level`을 enum으로 두면 코오번의 추상화 수준을 강제할 수 있습니다.
- `format` 필드는 코오번이 강조한 "단계적 정제(brief → casual → fully dressed)"를 추적합니다. 사용자에게 "이 유스케이스는 아직 brief 단계입니다, 다음 단계로 정제하시겠습니까?" 같은 UX를 줄 수 있습니다.
- `key`는 사람이 읽는 식별자(JIRA 스타일). CLI에서 `vspec show PAY-001` 같은 명령을 가능하게 합니다.

### `Actor`

액터 카탈로그. 한 프로젝트 안에서 재사용됩니다.

```
- id
- project_id
- name                 # "고객", "관리자", "결제시스템"
- type                 # PRIMARY / SUPPORTING / OFFSTAGE
                       # 코오번의 액터 분류
- description
- is_human             # boolean (사람 vs 외부 시스템)
- aliases              # 동의어 배열 ["사용자", "회원"]
```

**설계 포인트**: Actor를 별도 엔티티로 두면 한 프로젝트 내에서 일관성이 유지됩니다. "고객"과 "사용자"가 섞이는 흔한 문제를 방지합니다.

### `Goal`

목표 카탈로그. 액터-목표 목록의 기본 단위.

```
- id
- project_id
- actor_id             # FK -> Actor
- description          # "주문을 완료한다"
- level                # USER_GOAL / SUBFUNCTION / SUMMARY
- status               # IDENTIFIED / IN_DESIGN / IMPLEMENTED
- linked_usecase_id    # 유스케이스로 발전했는지 (nullable)
- priority
```

**설계 포인트**: Goal과 UseCase는 분리되어야 합니다. **"식별된 목표"가 모두 즉시 유스케이스가 되지는 않기 때문**입니다. 액터-목표 목록은 "백로그"에 가깝고, 거기서 선별된 것이 UseCase로 승격됩니다. Goal → UseCase 발전 관계가 명시적으로 추적됩니다.

### `Stakeholder`

이해관계자. 액터와 다릅니다(코오번의 핵심 구분).

```
- id
- project_id
- name                 # "은행", "규제기관", "보안팀"
- type                 # INTERNAL / EXTERNAL / REGULATORY
- description
```

### `StakeholderInterest`

특정 유스케이스에서 특정 이해관계자가 가진 이익.

```
- id
- usecase_id           # FK -> UseCase
- stakeholder_id       # FK -> Stakeholder
- interest             # "정확한 잔액 차감과 사기 방지"
- protection_mechanism # 어떤 단계/보장으로 보호되는지 (선택)
```

**설계 포인트**: 이건 코오번의 가장 독창적 개념입니다. 별도 엔티티로 두면 **"이 이해관계자의 이익이 어느 단계에서 보장되는가"**를 추적할 수 있어 강력합니다. 자동 검증의 토대가 됩니다.

### `Scenario`

시나리오. 한 유스케이스는 여러 시나리오를 가집니다.

```
- id
- usecase_id
- type                 # MAIN_SUCCESS / EXTENSION
- extension_point      # "4a", "6a" 등 (EXTENSION일 때)
- parent_step_number   # 어느 단계에서 분기하는지
- condition            # "PIN이 틀린 경우" (EXTENSION일 때)
- outcome              # SUCCESS / FAILURE / PARTIAL
- order_index          # 표시 순서
```

**설계 포인트**:

- 주 성공 시나리오와 확장(예외)이 같은 엔티티로 통일됩니다. `type`으로 구분.
- `extension_point`가 "4a", "4b" 같은 코오번 표기법을 직접 담습니다.
- 확장이 또 다른 확장을 가질 수 있도록 `parent_scenario_id`를 추가할 수도 있습니다(중첩 확장 4a1, 4a2).

### `Step`

시나리오의 개별 단계.

```
- id
- scenario_id
- step_number          # 1, 2, 3...
- actor_id             # 이 단계의 행위자
- action               # "PIN을 입력한다"
- intention            # 의도(코오번이 강조한 "왜")
- is_system_step       # 액터 vs 시스템 구분
- notes                # 단계별 메모
- order_index
```

**설계 포인트**:

- 각 단계에 `actor_id`를 매다는 게 중요합니다. Gherkin 변환 시 Given/When/Then 구분이 자동화됩니다(액터 행위 = When, 시스템 반응 = Then).
- `intention` 필드는 코오번이 강조한 "의도 단위로 쓰기"를 도와줍니다. UI 세부사항이 들어오려 할 때 "의도가 뭔가요?"를 물어 추상화를 유지시킵니다.

### `Extension` (선택 — Scenario로 통합 가능)

확장을 별도 엔티티로 둘지, Scenario에 흡수시킬지는 설계 선택입니다. 위처럼 Scenario에 `type=EXTENSION`으로 통합하는 게 단순합니다.

---

## 3. 관계·구조 엔티티

### `SystemBoundary`

시스템 경계 정의. 코오번이 강조한 "범위" 개념.

```
- id
- project_id
- name                 # "ATM 시스템", "결제 모듈"
- description
- in_scope_items       # 포함되는 것들 (텍스트 배열)
- out_of_scope_items   # 제외되는 것들
- type                 # ORGANIZATION / SYSTEM / SUBSYSTEM
```

**설계 포인트**: 코오번은 "Scope"를 단순한 이름이 아니라 **"무엇이 들어가고 무엇이 빠지는가"의 명확한 진술**로 봅니다. 별도 엔티티로 분리해 "in/out of scope" 항목을 관리하면 가치가 큽니다.

### `Glossary` / `Term`

용어집. 도메인 용어의 일관성을 위한 것.

```
- id
- project_id
- term                 # "PIN", "거래", "승인"
- definition
- aliases
- related_terms
```

**설계 포인트**: 코오번이 직접 강조한 건 아니지만, 유스케이스 텍스트의 일관성을 위해 사실상 필수입니다. 유스케이스 본문에서 용어를 자동 링크할 수 있게 됩니다.

### `ActorGoalList`

이건 별도 엔티티라기보다 **뷰**에 가까울 수 있습니다. Goal 테이블에서 actor_id별로 그룹화한 결과가 액터-목표 목록입니다. 별도 테이블 없이 쿼리로 충분합니다.

다만, **목록 자체의 메타데이터**(언제 작성, 누가 검토, 우선순위 결정 회의록 등)가 필요하다면 별도로 둘 수 있습니다.

---

## 4. 협업·버전 관리

### `Revision`

유스케이스의 버전 이력. **이게 SaaS의 핵심 차별점이 될 수 있습니다.**

```
- id
- usecase_id
- version_number       # 1, 2, 3...
- snapshot             # 그 시점의 전체 유스케이스 (JSON)
- change_summary       # "확장 4a 추가"
- created_by
- created_at
- parent_revision_id   # 분기 추적
```

**설계 포인트**: 유스케이스는 살아 있는 문서입니다. Git처럼 버전을 추적하면 "언제 무엇이 왜 바뀌었는지" 알 수 있습니다. CLI에서 `vspec diff PAY-001 v3 v5` 같은 명령이 자연스럽게 됩니다.

### `Comment`

유스케이스, 시나리오, 단계 단위 코멘트.

```
- id
- target_type          # USECASE / SCENARIO / STEP
- target_id
- author_id
- body                 # 마크다운
- thread_id            # 스레드 그룹
- resolved             # boolean
- created_at
```

**설계 포인트**: Figma·Google Docs처럼 **세밀한 대상에 댓글**을 달 수 있어야 합니다. "4단계에 대해" 같은 모호한 코멘트가 아니라 "Step #42에 대해" 정확히 달립니다.

### `Review`

공식 리뷰 프로세스.

```
- id
- usecase_id
- revision_id
- reviewer_id
- status               # REQUESTED / APPROVED / CHANGES_REQUESTED
- summary
- created_at, resolved_at
```

### `ChangeRequest`

리뷰에서 나온 변경 요청 항목.

```
- id
- review_id
- target_step_id       # nullable
- description
- status               # OPEN / RESOLVED / WONTFIX
```

---

## 5. 통합·확장 엔티티

### `Template`

유스케이스 템플릿. 조직마다 형식이 조금씩 다를 수 있습니다.

```
- id
- workspace_id
- name
- structure            # JSON: 어떤 필드를 포함할지, 기본값 등
- is_default
```

**설계 포인트**: "결제 유스케이스 템플릿", "관리자 기능 템플릿" 식으로 도메인별 템플릿을 두면 작성 속도가 빨라집니다.

### `Tag`

태그.

```
- id
- workspace_id
- name
- color
```

### `Tagging`

태그-대상 매핑 (Polymorphic).

```
- id
- tag_id
- taggable_type        # USECASE / GOAL / ACTOR
- taggable_id
```

### `Link`

유스케이스 간 관계, 외부 링크.

```
- id
- source_type, source_id
- target_type, target_id
- relation_type        # INCLUDES / EXTENDS / RELATED_TO
                       # BLOCKS / IMPLEMENTS / SUPERSEDES
- description
```

**설계 포인트**: 코오번에서 유스케이스 간 관계(include, extend)는 UML 다이어그램에 등장합니다. Link 엔티티로 그래프를 만들면 의존성 시각화가 가능합니다.

### `ExternalLink`

Figma, Jira, GitHub 등 외부 리소스 연결.

```
- id
- usecase_id
- type                 # FIGMA / JIRA / GITHUB / CONFLUENCE / FILE
- url
- title
- metadata             # JSON
```

### `Attachment`

파일 첨부 (다이어그램, 스크린샷 등).

```
- id
- target_type, target_id
- filename, content_type, size
- storage_url
- uploaded_by, uploaded_at
```

### `GherkinExport`

Gherkin 변환 결과 캐싱·관리.

```
- id
- usecase_id
- revision_id
- gherkin_text
- generated_at
- generation_strategy  # AUTO / MANUAL / HYBRID
```

**설계 포인트**: Gherkin 변환을 자동화하되 사용자가 수정할 수 있게 합니다. 다음 자동 생성 시 사용자 수정이 덮어써지지 않도록 머지 전략이 필요합니다.

### `ApiKey`

CLI·API 접근용 키.

```
- id
- workspace_id
- user_id              # 발급자
- name                 # "CI 파이프라인용"
- key_hash             # 해시된 키
- scopes               # 권한 범위
- last_used_at, expires_at, revoked_at
```

### `Webhook`

이벤트 알림.

```
- id
- workspace_id
- url
- events               # ["usecase.created", "review.approved"]
- secret               # HMAC 서명용
- active
```

### `AuditLog`

감사 로그 (특히 엔터프라이즈에 필요).

```
- id
- workspace_id
- user_id
- action               # "usecase.update", "scenario.delete"
- target_type, target_id
- changes              # JSON diff
- ip_address, user_agent
- created_at
```

---

## ER 관계 핵심 요약

가장 중요한 관계들을 정리하면:

```
Workspace 1───n Project
Project   1───n UseCase
Project   1───n Actor
Project   1───n Stakeholder
Project   1───n Goal

UseCase   n───1 Actor (primary_actor)
UseCase   1───n Scenario
UseCase   n───n Stakeholder (through StakeholderInterest)
UseCase   1───n Revision
UseCase   1───n Comment
UseCase   1───n ExternalLink
UseCase   0───1 GherkinExport

Scenario  1───n Step
Step      n───1 Actor

Goal      0───1 UseCase (linked_usecase)
Goal      n───1 Actor
```

---

## 설계상 핵심 결정 5가지

지금까지 설계에서 의식적으로 내린 결정들입니다.

**1. Actor와 Stakeholder를 분리한다**
많은 도구가 둘을 섞지만, 코오번 방법론의 핵심은 이 둘이 다르다는 것입니다. 액터는 행위하고 이해관계자는 이익을 가집니다. 한 사람이 둘 다일 수도 있지만 개념적으로 별개입니다. 분리해야 코오번스러운 사고가 강제됩니다.

**2. Goal과 UseCase를 분리한다**
액터-목표 목록은 백로그이고, UseCase는 거기서 선별된 정제 산출물입니다. 모든 목표가 즉시 유스케이스가 되지 않습니다. 분리해야 발견과 정의가 자연스럽게 단계화됩니다.

**3. Scenario를 통합 엔티티로 둔다**
주 시나리오와 확장을 type으로 구분합니다. 확장도 시나리오의 한 종류입니다. 이렇게 하면 쿼리와 UI가 단순해집니다.

**4. Revision을 1급 시민으로 둔다**
유스케이스는 살아 있는 문서입니다. 버전 추적, 비교, 롤백이 SaaS의 차별점이 됩니다. Notion·Confluence가 약한 부분입니다.

**5. Gherkin Export를 별도 엔티티로**
변환을 일회성 함수가 아니라 **관리되는 산출물**로 봅니다. 사용자 편집과 자동 재생성을 공존시키려면 필수입니다.

---

## 다음 단계로 고민할 것

엔티티가 정의됐다면, 다음에 결정할 것들:

1. **권한 모델**: 워크스페이스/프로젝트/유스케이스 단위 권한 어디까지?
2. **검색 모델**: 유스케이스 본문의 전문 검색을 어떻게 인덱싱할지
3. **CLI 명령 구조**: `vspec usecase create`, `vspec scenario add` 등 어휘 선택
4. **API 페이지네이션 전략**: cursor vs offset
5. **이벤트 모델**: 어떤 도메인 이벤트를 발행할지 (Webhook 설계와 직결)
6. **AI 보조**: 액터-목표 목록에서 유스케이스 초안 자동 생성? 누락된 확장 흐름 제안?

지금 정리한 엔티티는 **풀 스펙**입니다. MVP를 만든다면 이 중에서:

- 필수: Workspace, Project, User, UseCase, Actor, Scenario, Step
- 강력한 차별점: Stakeholder + StakeholderInterest, Goal, Revision, GherkinExport
- 나중에: Review, Audit, Webhook, Template

이렇게 단계화할 수 있습니다.

어느 부분을 더 깊이 파보고 싶으신가요? 예를 들어 ER 다이어그램으로 시각화하거나, 특정 엔티티의 API 스키마 설계, 또는 CLI 명령 체계 설계 같은 방향으로 갈 수 있습니다.

---

로컬-원격 동기화 모델을 깊이 파보자. 나는 AI 코딩에이전트를 사용하는 비개발자/개발자를 주요 타겟으로 보고있어.
항상 스펙을 먼저 정의하고, 이를 기반으로 자동화 테스트를 생성한 뒤에, 해당 테스트를 완료조건으로 삼아서 에이전트를 사용하면 정확도를 끌어올릴 수 있을거라고 어필할거야. 근데 이들은 병렬 작업을 많이 하거든. 병렬로 작업 세션이 활성화 됐을때, 유스케이스 변경 관리가 어려울거같아서 걱정이야.

---

정말 중요한 문제를 정확히 짚으셨습니다. 이게 사실 **이 SaaS의 진짜 차별점**이 될 영역입니다. 단순한 유스케이스 도구는 많지만, "AI 에이전트의 병렬 작업을 전제로 한 스펙 관리"는 아직 누구도 제대로 풀지 않았습니다.

문제를 먼저 정확히 분해해 보겠습니다.

## 문제의 본질: "다중 에이전트 동시 편집" 문제

전통적 협업 도구의 동시성 문제와 AI 에이전트의 동시성 문제는 본질적으로 다릅니다.

**전통적 동시성 (Notion, Google Docs)**

- 사람 N명이 다른 문단을 편집
- 분당 몇 번의 편집
- 사람은 컨텍스트를 보고 충돌을 피함
- 충돌 시 사람이 협의

**AI 에이전트 동시성 (vspec의 환경)**

- 사람 1명 + 에이전트 N개가 동시 작업
- 초당 여러 번의 편집 가능
- 에이전트는 다른 에이전트의 작업을 모름
- 충돌 시 자동 머지 불가능 (스펙 변경이 다른 에이전트의 테스트를 깨뜨림)

게다가 더 까다로운 점이 있습니다.

**의미적 의존성**: 유스케이스 A의 변경이 유스케이스 B에 의존하는 에이전트의 작업을 무효화할 수 있습니다. 단순한 텍스트 머지로는 안 됩니다.

**테스트 깨짐의 연쇄**: 한 시나리오가 바뀌면 그 시나리오로 생성된 Gherkin이 바뀌고, 그걸 완료 조건으로 삼던 에이전트가 잘못된 방향으로 갑니다.

**시점의 모호성**: 에이전트 1이 t1에 스펙 v3을 읽고 작업 시작, 에이전트 2가 t2에 스펙을 v4로 수정, 에이전트 1이 t3에 작업 완료 — 이때 에이전트 1의 결과는 유효한가?

## 해결 전략의 큰 그림

이 문제는 다음 4가지 모델의 조합으로 풀 수 있습니다.

```
1. Snapshot 모델       → 에이전트는 고정된 버전을 본다
2. Branch 모델         → 변경은 독립된 공간에서 일어난다
3. Lock 모델           → 활성 작업 중인 스펙은 보호된다
4. Impact 모델         → 변경의 영향이 자동 추적된다
```

하나씩 보겠습니다.

---

## 1. Snapshot (Immutable Specification Pinning)

**핵심 아이디어**: 에이전트는 항상 **고정된 스냅샷**을 보고 작업합니다. 살아 있는 스펙이 아니라 동결된 버전을 봅니다.

**작동 방식**:

```
에이전트 작업 시작
  ↓
vspec session create --usecase PAY-001 --pin
  ↓
세션이 PAY-001@v7을 핀(pin)
  ↓
에이전트는 PAY-001@v7만 본다 (이후 변경 무시)
  ↓
에이전트 작업 완료 후 세션 종료
```

이때 핵심 엔티티가 추가됩니다:

### `WorkSession`

```
- id
- workspace_id, project_id
- agent_identifier      # "cursor-claude-bob", "windsurf-alice"
- agent_type            # CURSOR / CLAUDE_CODE / WINDSURF / HUMAN
- pinned_revisions      # JSON: { "PAY-001": "rev_abc", "AUTH-003": "rev_xyz" }
- status                # ACTIVE / COMPLETED / ABANDONED
- started_at, ended_at
- intent                # "결제 모듈 구현"
- linked_branch_id      # nullable, 아래 Branch 모델 참조
```

**비유**: Git의 `git checkout <sha>` 와 같습니다. 에이전트는 특정 커밋을 체크아웃해서 일합니다.

**해결되는 문제**: 작업 중 스펙이 바뀌어도 에이전트 입장에서는 안정적입니다.

**남는 문제**: 그러면 다른 사람의 변경은 언제 반영되는가? → Branch 모델과 결합해서 해결합니다.

---

## 2. Branch (Spec Branching)

**핵심 아이디어**: 모든 변경은 **브랜치 위에서** 일어납니다. 메인 스펙은 직접 수정되지 않습니다.

**작동 방식**:

```
main: PAY-001@v7
  │
  ├─ branch:agent-bob/payment-impl (PAY-001@v7 base)
  │    에이전트 Bob이 작업, 스펙 변경 없음
  │
  ├─ branch:human-alice/add-3ds   (PAY-001@v7 base)
  │    Alice가 3D Secure 시나리오 추가 → v8 후보
  │
  └─ branch:agent-charlie/refund  (PAY-001@v7 base)
       Charlie가 환불 흐름 작업
```

이때 추가되는 엔티티:

### `SpecBranch`

```
- id
- project_id
- name                  # "agent-bob/payment-impl"
- base_revision_id      # 분기 시점
- head_revision_id      # 현재 헤드
- owner_type            # HUMAN / AGENT
- owner_id              # User 또는 WorkSession
- purpose               # "결제 PG 연동 구현"
- status                # ACTIVE / MERGED / ABANDONED
- merge_strategy        # AUTO / MANUAL / SEMANTIC
- linked_external       # JSON: { "github_pr": "...", "jira": "..." }
```

### `MergeRequest`

```
- id
- branch_id
- target_branch_id      # 보통 main
- proposed_changes      # 변경 사항 요약
- impact_analysis_id    # 아래 Impact 모델 참조
- status                # OPEN / APPROVED / REJECTED / MERGED
- conflicts             # JSON: 충돌 정보
- created_by, reviewed_by
```

**핵심 결정**: 누가 머지할 수 있는가?

- 사람의 변경: 사람 승인 필요
- 에이전트의 변경: 사람 승인 + 영향 분석 통과 필수
- 머지 시 충돌은 의미적 충돌(아래 Impact 모델로 판정)

**해결되는 문제**: 변경이 격리됩니다. 에이전트 Bob의 작업과 Alice의 변경이 충돌하지 않습니다.

**남는 문제**: 브랜치가 너무 많아지면? → 라이프사이클 관리 필요.

---

## 3. Lock (Active Work Protection)

**핵심 아이디어**: 누군가 작업 중인 유스케이스는 **부분적으로 보호**됩니다. 전면 금지가 아니라 경고와 충돌 인지입니다.

여기서 중요한 건 **락의 종류를 구분**하는 것입니다. 전부 막으면 협업이 멈춥니다.

### `Lock`

```
- id
- target_type           # USECASE / SCENARIO / STEP
- target_id
- lock_type             # SOFT / HARD / SEMANTIC
- held_by_session_id    # WorkSession FK
- held_by_user_id
- reason                # "결제 PG 구현 중"
- acquired_at, expires_at
- auto_release          # boolean
```

**락의 3단계**:

**SOFT 락 (정보성)**

- 효과: 다른 사용자가 편집 시도 시 "현재 X가 작업 중입니다" 경고
- 차단: 안 함
- 용도: 단순 작업 중 표시

**SEMANTIC 락 (의미적 보호)**

- 효과: 의미를 바꾸는 변경(시나리오 추가/삭제, Then 변경)은 차단, 텍스트 수정은 허용
- 차단: 부분적
- 용도: 대부분의 에이전트 작업

**HARD 락 (전면 차단)**

- 효과: 모든 변경 차단
- 차단: 완전
- 용도: 머지 직전, 출시 직전 검증

**왜 3단계인가**: 에이전트가 "결제를 구현 중"이라고 해서 그 스펙을 1시간 동안 못 고치게 하면 사람이 환장합니다. 의미를 바꾸지 않는 한 수정은 허용되어야 합니다.

**해결되는 문제**: 활성 작업이 중간에 무너지는 일을 막습니다.

**남는 문제**: "의미적 변경"을 자동 판정해야 합니다. → Impact 모델로 풀어야 합니다.

---

## 4. Impact (Semantic Change Tracking)

**핵심 아이디어**: 모든 변경에 대해 **"이 변경이 누구의 작업을 깨뜨리는가"**를 자동 계산합니다.

**이게 vspec의 진짜 마법이 되어야 하는 부분입니다.** 기존 도구들이 못 하는 것이 바로 이것입니다.

### `ChangeImpact`

```
- id
- change_id             # 어떤 변경인지
- affected_sessions     # 영향받는 활성 세션들
- affected_branches     # 영향받는 브랜치들
- affected_tests        # 깨질 자동 테스트들 (Gherkin)
- affected_usecases     # 의존하는 다른 유스케이스들
- severity              # BREAKING / NON_BREAKING / COSMETIC
- confidence            # 0.0 ~ 1.0
- ai_analysis           # AI 판정 근거
```

**변경 분류 규칙**:

```
COSMETIC (안전)
  - 오타 수정
  - 단어 표현 개선
  - 코멘트 추가

NON_BREAKING (대체로 안전)
  - 새 시나리오 추가
  - 새 단계 추가 (기존 흐름 유지)
  - 더 강한 보장으로 변경

BREAKING (위험)
  - 시나리오 삭제
  - 단계의 결과 변경
  - 액터/이해관계자 제거
  - 트리거 조건 변경
  - Gherkin Then 절에 영향을 주는 변경
```

**자동 판정 방식**:

1. **구조적 diff**: 어느 필드가 바뀌었는지 (시나리오, 단계, 보장 등)
2. **의미적 diff**: 같은 필드 안에서 의미가 바뀌었는지 (AI로 판정)
3. **다운스트림 영향**: 이 변경이 영향 주는 Gherkin export, 의존 유스케이스, 활성 세션 추적

판정 결과에 따라 자동 행동:

- COSMETIC: 자동 머지
- NON_BREAKING: 알림만, 머지 허용
- BREAKING: 영향받는 세션·테스트 강제 검토, 사람 승인 필요

**해결되는 문제**: 변경의 파급을 사람이 추적할 필요가 없습니다.

## 통합 시나리오

위 4가지를 합치면 실제 작업이 이렇게 흐릅니다.

### 시나리오 A: 두 에이전트가 다른 유스케이스 작업

```
1. Alice (개발자)
   $ vspec session start --intent "결제 구현"
   → 세션 #1 시작, PAY-001@v7 핀
   → Cursor 에이전트에 PAY-001 스펙 전달
   → 에이전트가 코드 + Gherkin 테스트 생성

2. Bob (다른 개발자, 동시에)
   $ vspec session start --intent "환불 구현"
   → 세션 #2 시작, REF-002@v3 핀
   → Windsurf 에이전트에 REF-002 스펙 전달

3. 두 세션 독립적으로 진행
   - 서로 격리됨
   - 충돌 없음

4. 둘 다 완료
   $ vspec session complete
   → 변경 사항이 main에 머지
   → 영향 분석 자동 실행
```

여기까지는 행복한 경로입니다.

### 시나리오 B: 한 사람이 스펙을 수정하는 동안 에이전트가 작업 중

```
1. Alice의 에이전트가 PAY-001@v7 기반으로 작업 중 (세션 활성)

2. Charlie가 PAY-001에 "3D Secure 시나리오" 추가 시도
   $ vspec usecase edit PAY-001

   vspec 응답:
   ⚠️  PAY-001은 현재 1개의 활성 세션에 의해 사용 중입니다.
       - session_42 (Alice의 cursor-agent, 23분 전 시작)

   변경 유형을 분석합니다...
   → 새 시나리오 추가 = NON_BREAKING
   → 진행 가능. 활성 세션은 v7을 계속 사용합니다.

3. Charlie가 변경 완료 → v8 생성
   - Alice의 세션은 v7에 묶여 있음 (영향 없음)
   - main은 v8

4. Alice의 에이전트 완료
   → 머지 시도
   → vspec이 "v7→v8 변경 사항 확인" 표시
   → Alice가 v8 반영 여부 결정
```

### 시나리오 C: 위험한 변경이 일어날 때

```
1. Alice의 에이전트가 PAY-001@v7로 작업 중

2. Charlie가 PAY-001의 주 시나리오 Step 4를 삭제하려 시도

   vspec 응답:
   🛑 BREAKING CHANGE 감지

   영향 분석:
   - 활성 세션 1개 영향받음 (session_42)
   - Gherkin 테스트 3개 깨질 예정
   - 의존 유스케이스 2개 영향

   다음 중 선택:
   [1] 강제 진행 (영향받는 세션에 알림)
   [2] 브랜치 만들어서 작업 (권장)
   [3] 취소
```

## CLI에서의 표현

추가될 명령어들:

```bash
# 세션 관리
vspec session start --intent "결제 구현" --pin PAY-001,AUTH-003
vspec session list                       # 내 활성 세션
vspec session list --workspace           # 워크스페이스 전체
vspec session show <id>
vspec session complete <id>
vspec session abandon <id>

# 브랜치
vspec branch create feature/3ds --from main
vspec branch list
vspec branch checkout feature/3ds
vspec branch diff feature/3ds main
vspec branch merge feature/3ds --to main

# 락
vspec lock PAY-001 --type semantic --reason "결제 PG 작업"
vspec lock list
vspec unlock PAY-001

# 영향 분석
vspec impact PAY-001 --proposed-change <change.json>
vspec impact session <session-id>

# 활성 작업 모니터링
vspec watch                              # 실시간 활성 세션 표시
vspec who PAY-001                        # 이 유스케이스를 누가 보고 있는가
```

## API 설계의 핵심 포인트

API는 다음 패턴을 강제하면 좋습니다.

**1. 모든 읽기는 버전 명시 가능**

```
GET /usecases/PAY-001              → 최신
GET /usecases/PAY-001?rev=abc123   → 특정 버전
GET /usecases/PAY-001?session=sid  → 세션이 핀한 버전
```

**2. 모든 쓰기는 base_revision 명시 필수 (낙관적 동시성)**

```json
PATCH /usecases/PAY-001
{
  "base_revision": "abc123",
  "changes": { ... }
}
```

base_revision이 현재와 다르면 409 Conflict + 영향 분석 결과 반환.

**3. 세션 컨텍스트는 헤더로**

```
X-Vspec-Session: session_42
X-Vspec-Agent: cursor-claude
```

**4. 변경은 항상 두 단계**

```
1. POST /changes/preview { ... }
   → 영향 분석 결과 반환
2. POST /changes/commit { preview_id, confirmed: true }
```

preview 단계에서 사용자(또는 에이전트)가 영향을 보고 결정할 수 있습니다.

## 추가로 필요한 엔티티 정리

위 모든 것을 종합하면 새로 추가될 엔티티:

```
- WorkSession      : 작업 세션 (사람 또는 에이전트)
- SpecBranch       : 스펙 브랜치
- MergeRequest     : 머지 요청
- Lock             : 락
- ChangeImpact     : 변경 영향 분석
- ChangePreview    : 변경 미리보기
- ChangeProposal   : 변경 제안 (commit 전)
```

## 가장 중요한 설계 철학

여기서 의식적으로 내려야 할 결정이 있습니다.

**"Git처럼 분산형이냐, Figma처럼 실시간 동기형이냐?"**

두 모델이 매우 다릅니다.

**Git 모델 (브랜치·머지 중심)**

- 장점: 격리가 강함, 충돌 처리 명확
- 단점: 학습 곡선, 머지의 부담
- 적합: 개발자 중심 워크플로

**Figma 모델 (실시간 동기 + 락)**

- 장점: 직관적, 학습 곡선 낮음
- 단점: 복잡한 충돌 처리 어려움
- 적합: 비개발자 친화

**제 권장**: 두 모델의 **하이브리드**입니다. 구체적으로:

- 기본은 Figma 모델 (실시간 + 락) — 비개발자 친화
- 큰 변경이나 위험한 변경은 자동으로 브랜치로 분기
- 에이전트 세션은 항상 Snapshot 핀 (Git 모델)
- 명시적 브랜치 작업도 가능 (파워 유저용)

이렇게 하면 비개발자는 "그냥 편집"하지만, 시스템이 뒤에서 적절한 격리를 자동으로 만들어줍니다.

## 마지막 통찰: 이게 진짜 차별점이다

지금 시장의 스펙 도구들(Notion, Confluence, Linear)은 **"사람이 사람과 협업"**을 전제로 합니다. 그래서 락이 거의 없고, 동시 편집은 텍스트 머지로 처리됩니다.

vspec이 노리는 환경은 **"사람 + 다수 에이전트의 비대칭 협업"**입니다. 에이전트는:

- 빠르고 무자비하게 변경합니다
- 컨텍스트를 잃지 않게 안정성이 필요합니다
- 자기 작업의 완료 조건을 신뢰해야 합니다

이 환경에서 **"스펙이 안정적이고 신뢰할 수 있는 진실의 원천(source of truth)"**이 되는 것이 vspec의 약속이 되어야 합니다. 그러려면 위 4가지 모델(Snapshot, Branch, Lock, Impact)이 매끄럽게 작동해야 합니다.

이건 그냥 도구가 아니라 **"AI 시대의 스펙 관리 패러다임"**을 정의하는 시도가 될 수 있습니다.

다음으로 깊이 파볼 만한 주제들:

1. **변경 영향 분석의 구체적 알고리즘** — AI로 의미적 변경을 어떻게 판정할지
2. **에이전트 통합 SDK 설계** — Cursor, Claude Code, Windsurf 등에서 vspec 세션을 어떻게 시작·종료할지
3. **로컬-원격 동기화 프로토콜** — `vspec` CLI가 로컬 파일과 서버를 어떻게 동기화할지 (이게 또 큰 주제입니다)
4. **충돌 해결 UX** — 충돌이 났을 때 사람이 어떻게 결정하게 할지

어디로 가볼까요?

---

좋은데? 근데 이걸 ai 에이전트가 자유자재로 쓰게 만들기 어렵지 않을까하는 걱정도 돼.
왜냐면 우리는 새로 만들어진 도구라, LLM들이 우리의 권장 사용법을 모를거거든. 물론 CLAUDE.md 같은 시스템 프롬프트에 어느정도 적을 수도 있겠지만, 그보다 좋은건 `vspec --help` 같은 명령어를 호출한 뒤, 직관적으로 명령어를 호출하더라도 가이드/에러문구 등을 통해 권장 사용법대로 자연스럽게 쓸 수 있게 ux 자체를 잡아주는거야

---

정확한 관점입니다. 이건 사실 **CLI 디자인에서 가장 중요한 통찰**입니다 — *문서가 아니라 도구 자체가 사용법을 가르쳐야 한다*는 것. 그리고 AI 에이전트는 이걸 사람보다 더 충실히 따릅니다. 사람은 에러 메시지를 무시할 때가 많지만 LLM은 거의 항상 읽고 반영합니다.

이걸 **"Self-Teaching CLI"** 디자인이라고 부를 수 있고, 몇 가지 구체적 원칙과 패턴으로 정리할 수 있습니다.

## 핵심 통찰: LLM은 어떻게 CLI를 배우는가

먼저 LLM이 새 CLI를 만나면 어떻게 행동하는지 봐야 합니다. 관찰된 패턴은:

1. **`--help`를 먼저 호출**한다 (학습된 습관)
2. 에러 메시지를 **그대로 읽고 다음 행동을 결정**한다
3. 출력에 명시된 다음 명령을 **거의 그대로 따라한다**
4. 패턴이 일관되면 **유추로 다른 명령을 시도**한다 (예: `create`가 있으면 `delete`도 시도)
5. 출력이 JSON이면 **파싱해서 활용**한다

이 행동 패턴이 곧 디자인 원칙입니다. LLM이 자연스럽게 이런 행동을 할 때 올바른 길로 가도록 만들면 됩니다.

## 7가지 디자인 원칙

### 원칙 1: 모든 출력은 "다음 행동"을 제안한다

전통적 CLI는 결과만 출력합니다. **vspec은 결과 + 다음에 할 수 있는 것**을 출력합니다.

**나쁜 예 (전통적)**:
```
$ vspec usecase create
Error: missing required argument 'title'
```

**좋은 예 (자가 학습 가능)**:
```
$ vspec usecase create

❌ 유스케이스를 만들려면 제목이 필요합니다.

💡 권장 사용법:
   vspec usecase create --title "결제를 완료한다"

📝 코오번 권장: 제목은 동사구로 작성하세요.
   예: "주문을 제출한다", "비밀번호를 재설정한다"
   
🔍 더 알아보기: vspec help usecase create
```

각 출력에는 **다음에 무엇을 하면 되는지**가 들어 있습니다. 에이전트는 이걸 거의 반드시 따라합니다.

### 원칙 2: 잘못된 사용에 친절한 가드레일

에러가 아니라 **교정 제안**으로 응답합니다.

```
$ vspec usecase create --title "버튼을 클릭한다"

⚠️  검토가 필요한 사용입니다.

입력하신 제목: "버튼을 클릭한다"
이건 UI 동작에 가깝습니다. 코오번 방법론은 의도 중심의 동사구를 권장합니다.

추천 변경:
  - "로그인한다" (의도)
  - "주문을 제출한다" (의도)  
  
실제로 사용하시려면:
  vspec usecase create --title "버튼을 클릭한다" --force

또는 더 나은 제목을 제안받으려면:
  vspec suggest title --description "사용자가 로그인 버튼을 누르는 행위"
```

에이전트는 `--force`를 거의 안 씁니다. 첫 번째 옵션을 따라가게 됩니다.

### 원칙 3: 컨텍스트 자동 감지와 명시적 안내

LLM은 종종 컨텍스트를 잊습니다. CLI가 컨텍스트를 알려줘야 합니다.

```
$ vspec status

📍 현재 컨텍스트
   프로젝트: payment-system
   브랜치:   feature/3ds-integration
   세션:     없음 (작업 시작 시 vspec session start 권장)
   
🔄 활성 작업
   다른 사람의 활성 세션: 2개
   - Alice (cursor-agent): PAY-001 작업 중, 23분 전 시작
   - Bob (human):         REF-002 편집 중, 5분 전 시작
   
📌 핀된 유스케이스: 없음

💡 AI 에이전트로 작업을 시작하시려면:
   vspec session start --intent "<작업 설명>" --pin <USECASE-ID>
```

이걸 보면 LLM은 **"아, 세션을 먼저 시작해야 하는구나"**를 학습합니다.

### 원칙 4: `--help`는 단순 옵션 나열이 아닌 워크플로 가이드

대부분 CLI의 `--help`는 옵션 목록입니다. vspec의 `--help`는 **권장 워크플로**를 보여줍니다.

```
$ vspec --help

VSPEC - 코오번 방식 유스케이스 관리 도구

🎯 일반적인 AI 에이전트 워크플로:
   
   1. vspec session start --intent "구현할 기능"
        → 작업 세션을 시작하고 유스케이스를 핀(고정)합니다
   
   2. vspec usecase show <ID>
        → 핀된 유스케이스의 스펙을 확인합니다
   
   3. vspec export gherkin <ID>
        → 자동 테스트용 Gherkin을 생성합니다
   
   4. (구현 및 테스트 작업)
   
   5. vspec session complete
        → 세션을 종료하고 결과를 기록합니다

📚 주요 명령:
   session     작업 세션 관리 (시작/종료/조회)
   usecase     유스케이스 CRUD
   scenario    시나리오 관리
   actor       액터 관리
   export      Gherkin 등 다양한 형식으로 변환
   impact      변경 영향 분석
   
🤖 AI 에이전트시라면:
   vspec ai-guide
   → AI 에이전트를 위한 사용 가이드를 출력합니다

상세 도움말: vspec help <명령>
```

핵심은 **명령 목록보다 워크플로를 먼저** 보여주는 것입니다.

### 원칙 5: 에이전트 전용 가이드 명령

LLM이 자기소개를 받고 시작할 수 있게 합니다.

```
$ vspec ai-guide

# VSPEC: AI 에이전트를 위한 가이드

당신이 코딩 에이전트(Cursor, Claude Code, Windsurf 등)라면 다음 워크플로를 따르세요:

## 1단계: 세션 시작 (필수)

```
vspec session start --intent "당신이 할 일 한 문장" --agent-type <당신의 타입>
```

이 명령은:
- 작업 세션을 만들고
- 관련 유스케이스를 자동으로 식별하며
- 해당 스펙의 안정된 버전을 핀(고정)합니다

이후 모든 명령은 이 세션 컨텍스트에서 실행됩니다.

## 2단계: 스펙 확인

작업 대상 유스케이스를 확인하세요:
```
vspec usecase show <ID> --format agent
```

`--format agent` 옵션은 구조화된 JSON을 반환하여 파싱하기 쉽습니다.

## 3단계: 테스트 생성

자동 테스트의 완료 조건을 받아오세요:
```
vspec export gherkin <ID> --output tests/
```

이 Gherkin 파일들이 당신의 구현 완료 조건입니다.

## 4단계: 변경이 필요할 때

코드 구현 중 스펙이 잘못되었다고 판단되면:
```
vspec change propose --usecase <ID> --reason "..."
```

직접 수정하지 말고 제안하세요. 영향 분석이 자동 실행됩니다.

## 5단계: 세션 종료

```
vspec session complete --summary "..."
```

## 자주 하는 실수

- ❌ 세션 없이 명령 실행
  → 가능하지만 변경 추적이 안 됩니다. 항상 세션을 시작하세요.

- ❌ 여러 유스케이스를 한 세션에서 동시 작업
  → 가능하지만 권장하지 않습니다. 작업 단위로 세션을 나누세요.

- ❌ 스펙 직접 편집
  → 사용자의 명시적 지시 없이는 propose만 사용하세요.

## 모든 명령에 --format=json

스크립트에서 사용하려면 모든 명령에 `--format=json`을 추가하세요.
```

LLM은 이걸 한 번 읽고 거의 항상 올바르게 행동합니다. 이게 **CLAUDE.md보다 훨씬 강력**합니다. 왜냐하면 도구 자체에서 나오는 가이드라 항상 최신이기 때문입니다.

### 원칙 6: 두 종류의 출력 모드

LLM은 JSON을 좋아하고, 사람은 텍스트를 좋아합니다. 둘 다 지원합니다.

```
$ vspec usecase show PAY-001
(사람이 읽기 좋은 형식: 표, 색깔, 이모지)

$ vspec usecase show PAY-001 --format json
(LLM이 파싱하기 좋은 JSON)

$ vspec usecase show PAY-001 --format agent
(LLM 특화 형식: JSON + 다음 권장 행동 + 컨텍스트)
```

`--format agent`가 특히 중요합니다. 예시:

```json
{
  "usecase": {
    "id": "PAY-001",
    "title": "결제를 완료한다",
    "level": "USER_GOAL",
    ...
  },
  "context": {
    "pinned_in_session": "session_42",
    "revision": "rev_abc123",
    "last_modified": "2025-05-15T10:00:00Z"
  },
  "suggested_next_actions": [
    {
      "command": "vspec export gherkin PAY-001",
      "reason": "테스트 생성으로 구현 완료 조건을 확보하세요"
    },
    {
      "command": "vspec scenario list PAY-001",
      "reason": "주 시나리오와 확장 흐름을 상세히 봅니다"
    }
  ],
  "warnings": []
}
```

LLM은 `suggested_next_actions`를 거의 반드시 따라갑니다. 이게 **레일을 까는 작업**입니다.

### 원칙 7: 자기 검증과 자기 수정 가이드

명령이 잘 안 되면 **자가 진단을 제안**합니다.

```
$ vspec export gherkin PAY-001

⚠️  변환 가능하지만 권장 형식이 아닙니다.

문제:
- 이 유스케이스는 BRIEF 형식입니다 (Fully Dressed 권장)
- 확장 시나리오가 없습니다 (예외 흐름이 누락된 듯합니다)
- 이해관계자 이익이 정의되지 않았습니다

진단 실행:
   vspec doctor PAY-001
   → 자세한 품질 분석을 받습니다

또는 어쨌든 변환:
   vspec export gherkin PAY-001 --allow-incomplete
```

`vspec doctor` 같은 명령은 LLM이 **스스로 품질을 점검**하게 만듭니다.

## 구체적 패턴들

위 원칙들을 구현하는 구체적 패턴 몇 가지.

### 패턴 A: "Did you mean?" 패턴

```
$ vspec usecase creat --title "..."

❌ 'creat'은(는) 알 수 없는 명령입니다.

비슷한 명령을 찾았습니다:
  - vspec usecase create   (생성)
  - vspec usecase craft    (AI 보조 생성)

이걸 시도하셨나요?
   vspec usecase create --title "..."
```

### 패턴 B: 진행 가이드 (interactive 친화적이지만 non-interactive에서도 작동)

```
$ vspec usecase create

📝 유스케이스 생성을 도와드립니다.

필요한 정보:
  1. 제목 (--title)
  2. 주 액터 (--primary-actor)
  3. 수준 (--level)

빠른 시작 (모든 정보):
   vspec usecase create \
     --title "결제를 완료한다" \
     --primary-actor customer \
     --level user-goal

단계별로 만들려면:
   vspec usecase create --interactive

기존 유스케이스에서 복제:
   vspec usecase create --from PAY-001 --title "..."
```

### 패턴 C: 충돌 시 자동 안내

```
$ vspec usecase update PAY-001 --field success_guarantee --value "..."

🛑 충돌 감지

이 유스케이스는 활성 세션에서 사용 중입니다:
  - session_42 (Alice의 cursor-agent)

영향 분석:
  - 변경 유형: SEMANTIC (의미 변경)
  - 영향받는 테스트: 3개
  - 심각도: BREAKING

권장 행동:

  1. 활성 세션에서 작업 중이라면, 변경을 제안하세요:
     vspec change propose --usecase PAY-001 \
       --field success_guarantee --value "..." \
       --reason "구현 중 발견한 누락"
  
  2. 활성 세션과 무관한 변경이라면, 브랜치를 만드세요:
     vspec branch create fix/success-guarantee --from main
     vspec usecase update PAY-001 ... --branch fix/success-guarantee
  
  3. 그래도 강제 변경하려면 (위험):
     vspec usecase update PAY-001 ... --force
     ⚠️ 활성 세션의 작업이 깨질 수 있습니다.
```

LLM은 이 세 옵션 중 거의 항상 1번 또는 2번을 선택합니다.

### 패턴 D: 환영 메시지가 곧 사용법

처음 명령을 실행할 때 자동으로 가이드합니다.

```
$ vspec session start --intent "결제 구현"

🎉 첫 세션을 시작합니다!

세션 ID: session_42 (자동 생성)
의도: "결제 구현"

📌 다음 단계 권장:

이 의도와 관련된 유스케이스를 찾고 있습니다...
   발견된 후보:
   - PAY-001: 결제를 완료한다 (관련도: 95%)
   - PAY-003: 결제 수단을 등록한다 (관련도: 78%)
   - REF-002: 환불을 처리한다 (관련도: 45%)

자동으로 핀(고정)하시려면:
   vspec session pin PAY-001 PAY-003

또는 검색해서 추가:
   vspec usecase search "결제"

세션 정보 보기:
   vspec session show

세션 활용 가이드:
   vspec session guide
```

이런 식으로 **"가만히 있어도 도구가 끌어주는"** 경험을 만듭니다.

### 패턴 E: 메타 명령

LLM이 헷갈릴 때 쓸 수 있는 안전망:

```
$ vspec explain        # 현재 상태와 다음 권장 행동을 자연어로 설명
$ vspec ai-guide       # AI 에이전트용 가이드 출력
$ vspec doctor         # 현재 상태 진단
$ vspec why <명령>      # 왜 이 명령이 권장되는지 설명
$ vspec examples <명령> # 실제 사용 예시 보기
```

특히 `vspec explain`이 강력합니다:

```
$ vspec explain

현재 상태:
당신은 'feature/3ds-integration' 브랜치에서 작업 중이며,
PAY-001과 AUTH-003을 핀한 세션이 활성 상태입니다 (23분 경과).

지금까지 한 일:
- 세션 시작
- PAY-001의 Gherkin 내보내기
- 새 시나리오 1개 추가 제안

권장 다음 행동:
- 제안한 시나리오 변경의 영향을 분석: vspec impact preview
- 또는 코드 구현 후 테스트 실행
- 또는 세션 종료: vspec session complete
```

## 시스템 차원에서 추가로 할 일

CLI 디자인 외에도 보강할 것들:

**1. 에러 메시지 사전(Dictionary) 관리**
모든 에러 메시지를 한 곳에 모아 관리합니다. 각 에러 코드별로:
- 사람용 메시지
- LLM 친화적 메시지
- 추천 다음 행동
- 관련 문서 링크

**2. 명령어 실행 통계 수집**
LLM들이 어떤 명령을 어떤 순서로 자주 실행하는지 추적합니다. 자주 등장하는 잘못된 패턴은 가이드로 추가합니다.

**3. MCP 서버로도 제공**
CLI 외에 **MCP(Model Context Protocol) 서버**로도 제공하면, Claude Desktop 같은 환경에서 도구로 직접 호출됩니다. 이때 도구 설명(description)이 LLM의 1차 학습 자료가 됩니다.

**4. 공식 시스템 프롬프트 스니펫**
사용자가 자기 프로젝트의 CLAUDE.md, .cursorrules 등에 붙여넣을 수 있는 권장 스니펫을 제공합니다.

```
$ vspec ai-prompt
(CLAUDE.md, .cursorrules에 붙여넣을 권장 스니펫 출력)
```

## 가장 강력한 원칙 하나만 꼽자면

**"모든 출력은 다음 명령을 포함한다"**

이것 하나만 일관되게 지키면 LLM은 vspec을 자연스럽게 익힙니다. 사람도 마찬가지입니다. 이게 *self-teaching*의 본질입니다.

이걸 따르는 CLI들이 이미 있습니다:
- `gh`(GitHub CLI): 에러마다 다음 명령 제안
- `kubectl`: `kubectl explain` 같은 자가 학습 명령
- `stripe` CLI: 모든 출력에 관련 문서 링크
- `wrangler`(Cloudflare): 인터랙티브 가이드

이들의 공통점은 **"문서를 안 봐도 도구만 만져도 익힐 수 있다"**입니다. vspec은 이 수준을 넘어 **"LLM이 도구만 만져도 권장 워크플로를 따라하게 된다"** 수준을 목표로 해야 합니다.

## 정리

LLM을 위한 CLI 디자인은 사실 **모든 사용자를 위한 좋은 CLI 디자인**과 같은 방향입니다. 다만 LLM이 사람보다 지시에 더 충실하므로, 가이드를 잘 깔면 효과가 극적으로 큽니다.

핵심 정리:

1. **워크플로 중심 `--help`** — 명령 나열이 아닌 권장 경로
2. **에러 = 교정 제안** — 거부가 아닌 안내
3. **모든 출력에 다음 행동** — 레일을 깐다
4. **`--format agent` 모드** — 구조화된 JSON + 권장 다음 행동
5. **`ai-guide` 명령** — 도구 자체에서 메타 가이드 제공
6. **`explain`, `doctor`, `why`** — 메타 명령으로 안전망 제공
7. **MCP 서버 + 권장 프롬프트 스니펫** — CLI 외 통합

이런 디자인이라면 CLAUDE.md가 없어도 LLM이 90% 올바르게 사용합니다. CLAUDE.md는 그저 첫 호출을 줄여주는 보조 역할이 됩니다.

---

다음으로 깊이 파볼 만한 곳들:

1. **`vspec ai-guide`의 구체적 콘텐츠 작성** — 진짜로 LLM이 보고 따라할 가이드
2. **에러 메시지 카탈로그 설계** — 모든 에러를 학습 자료로
3. **MCP 서버 인터페이스 설계** — Claude Desktop 등에서 도구로 노출
4. **공식 CLAUDE.md/.cursorrules 스니펫** — 사용자에게 배포할 권장 프롬프트

어디로 가볼까요?

---

mvp 범위를 정해보자. 내 생각엔 vspec 자체의 유스케이스 및 개발 cycle을 vspec으로 관리할 수 있는 지점이 되면 가장 좋을 것 같아

---

훌륭한 기준입니다. 이건 **dogfooding의 정수**고, 실제로 많은 개발자 도구가 이 방식으로 성공했습니다(Git이 Git으로 관리되고, Linear가 Linear로 관리되는 식). 

"우리 자신을 위해 만든다"는 기준은 두 가지 강력한 효과가 있습니다.

1. **MVP 범위가 자연스럽게 수렴**합니다 — 우리에게 필요 없는 건 안 만들게 됩니다
2. **품질 피드백 루프가 즉시 작동**합니다 — 매일 우리가 쓰면서 문제를 발견합니다

이 기준에서 MVP를 정의해 보겠습니다.

## 먼저: "vspec 개발 사이클을 vspec으로 관리"가 의미하는 것

이 기준을 구체화해야 합니다. "관리"의 범위가 어디까지인지에 따라 MVP 크기가 크게 달라집니다.

이 기준을 만족하려면 vspec이 다음을 할 수 있어야 합니다.

```
1. vspec 자체의 유스케이스를 정의하고 저장
2. 각 유스케이스에 대해 Gherkin 테스트 생성
3. 개발자(또는 AI 에이전트)가 유스케이스를 보고 구현
4. 구현 중 스펙 변경 시 추적 가능
5. 여러 사람/에이전트가 병렬 작업 가능
6. 변경의 영향을 파악 가능
```

이게 dogfooding 최소 조건입니다.

여기서 한 가지 중요한 결정이 있습니다: **MVP에서 빼도 dogfooding이 가능한 것**과 **빼면 dogfooding이 불가능한 것**을 가르는 일입니다.

## MVP 범위 — 3개 레이어로 분류

### 레이어 1: 절대 필요 (Without this, no dogfooding)

이게 없으면 vspec을 vspec으로 관리할 수 없습니다.

**핵심 엔티티 (최소 세트)**
- `Workspace`, `Project`, `User`, `Membership`
- `UseCase` (level, format, title, primary_actor, trigger, preconditions, success_guarantee, minimal_guarantee 모두 포함)
- `Actor`
- `Scenario` (MAIN_SUCCESS / EXTENSION 통합)
- `Step`
- `Revision` (간소화 버전 — 전체 스냅샷 JSON만)

**핵심 작업 흐름**
- 유스케이스 CRUD
- 시나리오/단계 CRUD
- 액터 CRUD
- 버전 이력 보기와 diff

**필수 인터페이스**
- 웹 UI: 유스케이스 작성·편집·열람
- CLI: `vspec` 기본 명령 (init, login, usecase, scenario, actor, status, list, show)
- 인증: 이메일+비번 또는 GitHub OAuth (둘 중 하나만)

**필수 통합**
- Gherkin export (한 유스케이스 → Gherkin 파일)
- JSON export/import (백업과 마이그레이션)

여기까지가 **"vspec으로 vspec의 스펙을 작성하고 보관할 수 있는"** 최소 수준입니다.

### 레이어 2: dogfooding 품질에 필수 (Without this, dogfooding is painful)

이게 없으면 dogfooding은 되지만 매일 고통스럽습니다.

**병렬 작업 지원 — 단순 버전**
- `WorkSession` (스냅샷 핀만, 브랜치 없이)
- 낙관적 동시성 제어 (base_revision 기반 충돌 감지)
- 충돌 시 변경 사항 표시와 수동 머지 안내

**LLM 친화 인터페이스**
- `vspec ai-guide` 명령
- `--format=agent` 출력 모드 (JSON + suggested_next_actions)
- 에러 메시지에 다음 행동 제안 (앞서 논의한 self-teaching 원칙)

**기본 영향 분석**
- 구조적 diff (어느 필드가 변경됐는지)
- 변경 분류: COSMETIC / NON_BREAKING / BREAKING (규칙 기반, AI 없이)
- 활성 세션이 영향받는지 알림

**최소한의 협업**
- 코멘트 (유스케이스 단위만, 단계 단위는 나중에)
- 변경 이력 보기 (누가 언제 무엇을 바꿨는지)

여기까지가 **"매일 쓸 만한 vspec"**입니다.

### 레이어 3: MVP에서 빼도 되는 것 (Later, not now)

dogfooding 초기에는 없어도 됩니다.

- **Stakeholder, StakeholderInterest** — 코오번스럽지만 vspec 같은 단순 도구에선 처음엔 안 써도 됩니다. v1.1에서 추가.
- **Goal과 ActorGoalList** — 액터-목표 목록은 노션 표로도 됩니다. 잘 정리된 UseCase가 있으면 후순위.
- **SpecBranch, MergeRequest** — 처음에는 main만 있어도 됩니다. 작업이 충돌하기 시작하면 그때 추가.
- **Lock** — 활성 세션 표시(레이어 2)로 시작하고, 정식 락은 나중에.
- **AI 기반 의미적 영향 분석** — 처음에는 규칙 기반으로 충분. AI는 v1.1.
- **Review, Approval 워크플로** — 코드 리뷰처럼 정식 프로세스는 후순위. 처음엔 코멘트로.
- **Template, Glossary, Tag, ExternalLink, Attachment** — 모두 v1.1+.
- **Webhook, AuditLog** — 엔터프라이즈 기능, 후순위.
- **Multiple format 출력 (단계별 정제)** — Brief/Casual/Fully Dressed 토글은 일단 Fully Dressed만 지원.
- **Team 엔티티** — 처음엔 워크스페이스 멤버십만으로 충분.

## 세 가지 시간대 (Track A/B/C)

dogfooding 기준으로 MVP를 정의하면 자연스럽게 3단계 출시 전략이 나옵니다.

### Track A: "Solo Founder" (4-6주)

**목표**: 창업자(또는 솔로 PM) 한 명이 vspec으로 vspec의 스펙을 관리할 수 있다.

이 단계에서는 **동시성, 협업, 락 모두 무시**합니다. 한 명이 쓰니까요.

포함:
- 핵심 엔티티 (Workspace, Project, User, UseCase, Actor, Scenario, Step, Revision)
- 웹 UI 기본 CRUD
- CLI 기본 명령 (`vspec usecase create/show/list/edit`, `vspec scenario add`, 등)
- Gherkin export
- 단순 인증 (한 가지 방식만)

여기까지면 **"내 머릿속의 vspec 스펙을 vspec에 옮길 수 있다"**가 됩니다.

### Track B: "Small Team" (추가 3-4주)

**목표**: 창업자 + 1-2명의 협업자(개발자 또는 AI 에이전트)가 vspec으로 vspec을 만들 수 있다.

여기서 병렬 작업과 LLM 친화성이 들어옵니다.

추가:
- WorkSession (스냅샷 핀)
- 낙관적 동시성 (충돌 감지와 표시)
- 활성 세션 알림 (`vspec who PAY-001`, `vspec status`)
- 규칙 기반 변경 분류
- `vspec ai-guide`, `--format=agent`
- self-teaching 에러 메시지
- 단순 코멘트

이게 진짜 **MVP의 끝**입니다. 여기서 베타 출시 가능합니다.

### Track C: "Public Beta" (추가 2-3주)

**목표**: 외부 베타 사용자가 자기 프로덕트를 vspec으로 관리할 수 있다.

추가:
- 온보딩 흐름
- API 문서
- MCP 서버 (Cursor, Claude Desktop 통합)
- 기본 권한 관리
- 결제 (선택)

총 9-13주 정도 예상됩니다.

## 가장 중요한 결정: Snapshot은 MVP에 포함

레이어 2에서 결정해야 할 게 있습니다. **"WorkSession과 스냅샷 핀을 MVP에 넣을 것인가?"**

저는 **반드시 포함**해야 한다고 봅니다. 이유:

1. **이게 vspec의 진짜 차별점**입니다. 빠지면 그냥 또 하나의 스펙 도구가 됩니다.
2. **dogfooding하면서 가장 빨리 가치를 체감**할 수 있는 기능입니다. 창업자 본인이 Cursor로 vspec 코드를 짜면서 vspec 스펙을 핀하는 경험을 해야 합니다.
3. **이걸 늦게 넣으면 데이터 모델 변경 비용이 큽니다**. Revision 모델, 충돌 처리, API 시그니처 모두 영향받습니다.

반면 **SpecBranch와 MergeRequest는 MVP에서 빼도** 괜찮습니다. 이유:

1. WorkSession + 낙관적 동시성으로 작은 팀의 80% 시나리오는 커버됩니다.
2. 브랜치는 복잡도가 큽니다. UI, CLI, 머지 알고리즘, 충돌 해결 모두 필요합니다.
3. 진짜 필요해질 때(작업 충돌이 자주 일어날 때) 추가하는 게 자연스럽습니다.

## 구체적 MVP 기능 명세

위를 종합하면 MVP의 정확한 범위는 다음과 같습니다.

### 데이터 모델 (10개 엔티티)

```
Workspace, Project, User, Membership      (조직)
UseCase, Actor, Scenario, Step             (핵심 도메인)
Revision                                   (버전)
WorkSession                                (병렬 작업)
Comment                                    (협업, 유스케이스 단위만)
```

**의도적으로 빠진 것**: Stakeholder, Goal, Glossary, SpecBranch, Lock, Tag, Template, Review, Webhook, AuditLog, Attachment, ExternalLink

### 웹 UI 화면 (8개)

1. 로그인/회원가입
2. 워크스페이스 대시보드
3. 프로젝트 목록 + 생성
4. 유스케이스 목록 (검색·필터)
5. 유스케이스 상세/편집 (시나리오, 단계 포함)
6. 액터 관리
7. 활성 세션 모니터
8. 설정 (멤버, API 키)

### CLI 명령 (15개 내외)

```
vspec login / logout
vspec init                              # 프로젝트 초기화
vspec status                            # 현재 컨텍스트
vspec ai-guide                          # AI 에이전트 가이드

vspec usecase create / show / list / edit / delete
vspec scenario add / list / edit
vspec actor create / list

vspec session start / show / complete / list
vspec who <usecase>                     # 누가 작업 중인가

vspec export gherkin <usecase>
vspec diff <usecase> <rev1> <rev2>
```

### API (REST)

- `POST /sessions` / `GET /sessions/:id` / `POST /sessions/:id/complete`
- `GET/POST/PATCH/DELETE /usecases`
- `GET/POST /usecases/:id/scenarios`
- `GET/POST /scenarios/:id/steps`
- `GET/POST /actors`
- `GET /usecases/:id/revisions`
- `POST /usecases/:id/export/gherkin`
- `POST /changes/preview` / `POST /changes/commit`
- `GET /usecases/:id/activity` (코멘트, 변경 이력)

### LLM 친화 기능 (최소)

- `--format=agent` 옵션 (모든 read 명령)
- 모든 에러 메시지에 "권장 다음 행동" 포함
- `vspec ai-guide` 출력
- `vspec explain` 메타 명령

## MVP 검증 기준 — Self-test

MVP가 완성됐다고 판단하는 기준을 미리 정해두면 좋습니다. 이렇게 제안합니다.

**1. 자기 적용 가능 테스트**
- vspec의 유스케이스 30개 이상이 vspec에 등록되어 있다
- 각 유스케이스에서 Gherkin이 생성되고 실제 테스트로 작동한다
- 새 기능 개발 시 vspec에서 먼저 유스케이스를 만들고 시작한다

**2. 병렬 작업 테스트**
- 창업자가 한 유스케이스를 편집하는 동시에, AI 에이전트가 다른 유스케이스로 코드를 짠다
- 충돌이 발생하면 명확한 안내가 나온다
- 활성 세션 목록이 정확히 표시된다

**3. LLM 자가 학습 테스트**
- 신규 LLM 세션(아무 컨텍스트 없음)에 "vspec --help"만 보여주고 작업을 시키면 권장 워크플로를 따라간다
- 잘못된 명령을 입력했을 때 LLM이 에러 메시지만 보고 자동 교정한다

**4. 안정성 테스트**
- 동시 편집 시 데이터 손실이 없다
- 충돌 감지가 누락 없이 작동한다
- API 응답이 일관된 스키마를 따른다

이 4가지가 모두 통과하면 MVP 완료입니다.

## 의도적으로 안 하는 것들 (Anti-scope)

명시적으로 **MVP에서 빼는 것**을 정해두는 게 중요합니다. 안 그러면 슬며시 늘어납니다.

- ❌ 다이어그램 자동 생성 (시퀀스, 플로우)
- ❌ AI 기반 유스케이스 자동 생성
- ❌ AI 기반 의미적 변경 분석 (규칙 기반만)
- ❌ Figma, Jira, Linear 통합
- ❌ 다국어 지원 (영어 + 한국어만)
- ❌ 모바일 앱
- ❌ 정교한 권한 관리 (Owner/Editor/Viewer 3단계로 끝)
- ❌ 분석 대시보드
- ❌ 멀티 브랜치
- ❌ 정식 리뷰/승인 워크플로
- ❌ Webhook
- ❌ MCP 서버 (Track C로 미룸)

이 목록은 **자주 검토**해야 합니다. dogfooding하다 보면 자꾸 추가하고 싶어지는데, "지금 없어도 dogfooding은 되는가?"를 기준으로 거절합니다.

## 첫 6주 액션 플랜 (Track A)

구체적으로 6주를 어떻게 쓸지 제안합니다.

**Week 1: 기초**
- 데이터 모델 설계와 마이그레이션
- 인증 시스템
- Workspace/Project/User CRUD API
- 기본 인프라 (DB, 호스팅)

**Week 2: 핵심 도메인**
- UseCase, Actor, Scenario, Step API
- Revision 시스템 (스냅샷 기반)
- 기본 검증 로직 (코오번 규칙 일부)

**Week 3: 웹 UI 1차**
- 유스케이스 목록과 상세
- 시나리오·단계 편집
- 액터 관리

**Week 4: CLI 1차**
- 인증, 기본 명령
- usecase, scenario, actor 명령
- Gherkin export

**Week 5: dogfooding 시작**
- 창업자가 vspec의 유스케이스를 직접 vspec에 입력
- 발견되는 문제 즉시 수정
- 가장 큰 마찰점 식별

**Week 6: 정리**
- 발견된 버그 수정
- UX 개선 (특히 dogfooding 중 답답했던 부분)
- 문서화

Week 5가 가장 중요합니다. 이때부터는 vspec이 vspec의 개발 도구가 됩니다. 발견되는 모든 마찰점이 곧 우선순위 1입니다.

## 한 가지 제안: dogfooding을 더 빨리 시작

위 계획대로면 Week 5에야 dogfooding이 시작됩니다. 하지만 더 빨리 할 수 있는 방법이 있습니다.

**Week 2부터 종이/마크다운으로 dogfooding 시작**: 아직 도구가 없어도 코오번 방식으로 vspec의 유스케이스를 마크다운 파일로 작성합니다. 이때 작성한 30개 정도의 유스케이스가 Week 4의 import 테스트 데이터가 됩니다.

이렇게 하면:
- 도구가 준비되기 전부터 도메인 이해가 깊어집니다
- 도구 완성 시 즉시 이전 가능합니다
- 가장 자주 쓸 패턴이 미리 발견됩니다

## 요약

dogfooding 기준 MVP는 다음과 같이 정리됩니다.

**범위**: 10개 엔티티, 8개 화면, 15개 CLI 명령, 핵심 API + Gherkin export + WorkSession 기반 병렬 작업

**제외**: 브랜치, 락, 정교한 권한, AI 분석, 외부 통합, 모바일

**일정**: 9-13주 (Track A 6주 + Track B 4주 + Track C 3주)

**검증**: 자기 적용, 병렬 작업, LLM 자가 학습, 안정성 4가지 테스트

이 정도가 **"vspec으로 vspec을 만들 수 있는 최소 도구"**의 범위라고 봅니다. 더 작으면 dogfooding이 안 되고, 더 크면 출시가 늦어집니다.

---

다음으로 깊이 파볼 만한 방향:

1. **Week 1-2 데이터 모델의 구체적 스키마 설계** — 실제 마이그레이션 작성 직전 수준
2. **dogfooding용 vspec의 핵심 유스케이스 30개 도출** — 무엇을 마크다운으로 먼저 쓸지
3. **WorkSession과 낙관적 동시성의 구체적 알고리즘** — 충돌 감지·해결 흐름
4. **CLI 명령 트리의 정밀 설계** — 각 명령의 입출력 명세

어디로 가볼까요?

---

Track A도 동시성, 협업, 락 모두 고려해야한다. 그들도 병렬 AI 에이전트를 사용하기 때문이다. 최소 6개의 세션을 활성화 시켜놓고 쓰는 사용자가 많다.

그래서 다음 기능이 초기부터 있으면 좋겠다.

* Stakeholder, StakeholderInterest
* Goal과 ActorGoalList
* SpecBranch, MergeRequest, Lock
---

정확합니다. Solo Founder도 6+ 세션을 동시에 돌리는 환경이라면 그 자체가 **이미 분산 멀티 에이전트 시스템**입니다. "혼자라서 동시성 무시"는 잘못된 전제였습니다. 죄송합니다, 시장 현실을 잘못 봤습니다.

또한 Stakeholder, Goal, Branch가 처음부터 있어야 한다는 결정은 더 깊은 의미가 있습니다 — 이 엔티티들이 **나중에 추가하기 가장 어려운 것들**입니다. 데이터 모델의 뿌리에 가까워서, 뒤늦게 끼워 넣으면 마이그레이션이 지옥이 됩니다. **초기에 넣는 것이 오히려 비용이 작습니다.**

이 새 제약을 반영해서 MVP를 다시 설계해 보겠습니다.

## 결정의 영향: 무엇이 어떻게 바뀌나

먼저 이 결정이 미치는 파급을 정확히 파악해야 합니다. 세 가지 영역에 영향이 갑니다.

**1. 데이터 모델 복잡도**
- 엔티티가 10개에서 16-18개로 증가
- 관계 그래프가 훨씬 복잡 (StakeholderInterest, MergeRequest는 N:N)
- 마이그레이션 전략이 처음부터 필요

**2. 워크플로 복잡도**
- 단순 CRUD가 아니라 브랜치 → 머지 흐름
- 락 획득·해제 흐름
- 6+ 세션 동시 모니터링

**3. UI 복잡도**
- 브랜치 전환 UI
- 머지 충돌 해결 UI
- 다중 세션 상태 표시

이 세 가지를 균형 있게 처리하지 않으면 6주가 12주가 됩니다. 그래서 **핵심 트레이드오프**를 명확히 해야 합니다.

## 핵심 트레이드오프 — "기능은 다 넣되, 단순한 형태로"

새 제약을 받아들이되 일정을 지키려면, **각 기능의 "MVP 형태"를 의도적으로 단순화**해야 합니다. 엔티티는 존재하되 기능은 최소화하는 전략입니다.

이걸 "**Schema-Complete, Feature-Minimal**" 전략이라고 부르겠습니다. 데이터 모델은 미래를 향해 완전하게, 기능은 현재에 최소한으로.

각 새 엔티티를 이 관점에서 정의하겠습니다.

### Stakeholder / StakeholderInterest

**왜 처음부터 필요한가**: 코오번 방법론의 정체성을 표현하는 가장 큰 차별점입니다. 나중에 추가하면 모든 기존 유스케이스를 다시 들여다봐야 합니다. 또 vspec 자신의 유스케이스에서도 이해관계자(개발자, AI 에이전트, PM)가 다층적입니다.

**MVP 형태**:
- 엔티티 풀스펙으로 존재
- 유스케이스 편집 시 "이해관계자 이익" 섹션이 정식 필드로 노출
- 단, **자동 검증은 없음** ("모든 이해관계자 이익이 어느 단계에서 보장되는지" 같은 정합성 검사는 v1.1)
- 단, **이해관계자 카탈로그 재사용 UI는 단순화** (드롭다운만, 자동 추천 없음)

CLI:
```
vspec stakeholder create / list
vspec usecase add-stakeholder <id> --stakeholder <s> --interest "..."
```

이렇게 하면 엔티티는 완전하되, 정교한 UX는 후속 버전에서 추가합니다.

### Goal / ActorGoalList

**왜 처음부터 필요한가**: 백로그 역할을 합니다. vspec 개발 초기에는 "구현해야 할 유스케이스 후보"가 산더미입니다. 이걸 별도 도구(노션, 시트)로 관리하면 dogfooding이 깨집니다. vspec이 vspec의 백로그가 되어야 합니다.

**MVP 형태**:
- Goal 엔티티 풀스펙
- ActorGoalList는 **별도 엔티티가 아니라 뷰**로 구현 (Goal 테이블의 actor별 그룹화 쿼리)
- Goal → UseCase 승격 기능 (`vspec goal promote <goal-id>`)
- 단, **AI 기반 Goal 자동 생성, 누락 분석은 없음** (v1.1)

CLI:
```
vspec goal create --actor customer --description "주문 상태를 확인한다"
vspec goal list
vspec goal list --actor customer
vspec goal promote <id>    # UseCase로 승격
```

### SpecBranch / MergeRequest

**왜 처음부터 필요한가**: 이게 가장 어려운 결정이었습니다. 하지만 6+ 세션 동시 사용 환경에서는 **충돌이 일상**이 됩니다. WorkSession + 낙관적 동시성만으로는 잦은 충돌이 발생하고, 사용자는 매번 손으로 해결해야 합니다. 이건 dogfooding의 죽음입니다.

브랜치가 있으면 **격리가 기본값**이 되어 충돌 자체가 줄어듭니다.

**MVP 형태 — 핵심 단순화**:

이 부분은 의식적으로 단순화가 필요합니다. Git 같은 복잡한 브랜치 모델은 안 됩니다. 다음과 같이 단순화합니다.

- **브랜치는 1단계만** — main에서 분기, main으로 머지. 브랜치에서 또 분기 불가.
- **자동 브랜치 모드** — 세션 시작 시 브랜치 자동 생성을 옵션으로 제공 (`vspec session start --auto-branch`). 사용자가 브랜치를 의식 안 해도 됨.
- **린리어 히스토리만** — 머지는 fast-forward 또는 squash. 머지 커밋 없음.
- **충돌 해결은 단순 UI** — 충돌 시 "내 버전 / 그쪽 버전 / 둘 다 유지" 3가지 선택만.
- **MergeRequest는 가벼움** — 코드 리뷰 같은 정식 PR 흐름은 없음. "제안 → 확인 → 머지" 3단계.

CLI:
```
vspec branch create <name> [--from main]
vspec branch list
vspec branch checkout <name>
vspec branch diff <name> [main]
vspec branch merge <name> [--strategy fast-forward|squash]
vspec branch delete <name>

# 자주 쓸 short form
vspec session start --auto-branch  # 세션 시작 시 자동 브랜치
```

이렇게 하면 브랜치 개념은 존재하지만 **사용자가 안 의식해도 되는 수준**에서 작동합니다. 의식하고 싶은 파워 유저는 명시적 명령으로 제어합니다.

### Lock

**왜 처음부터 필요한가**: 브랜치가 있어도, **같은 브랜치 안에서 6개 에이전트가 동시 작업할 때** 락이 필요합니다. 특히 한 유스케이스를 여러 에이전트가 동시 편집하려는 시나리오를 막아야 합니다.

**MVP 형태**:
- 3단계 락(SOFT/SEMANTIC/HARD) **모두 구현**
- 단, **자동 락 획득은 없음** — 세션 시작 시 명시적 락만. (자동 락은 v1.1)
- 락 해제는 자동 (세션 종료 시) + 수동 (`vspec unlock`)
- 락 만료(timeout) 기본 30분, 갱신 가능

CLI:
```
vspec lock <usecase> --type semantic --reason "..."
vspec lock list
vspec unlock <usecase>
vspec who <usecase>   # 누가 락을 잡고 있는지
```

## 수정된 MVP 데이터 모델 (16개 엔티티)

```
조직 (4):
  Workspace, Project, User, Membership

핵심 도메인 (8):
  UseCase, Actor, Scenario, Step
  Stakeholder, StakeholderInterest
  Goal
  Revision

동시성·협업 (4):
  WorkSession
  SpecBranch, MergeRequest
  Lock

협업 보조 (1):
  Comment (유스케이스 단위)
```

빠진 것: Glossary, Tag, Template, Review, Webhook, AuditLog, Attachment, ExternalLink, Team — 모두 v1.1+.

## 수정된 일정 — 솔직한 재추정

새 기능을 추가하면서 솔직하게 일정을 재추정해야 합니다. **"기능은 다 넣고 일정은 그대로"는 불가능합니다.** 두 가지 옵션이 있습니다.

**옵션 1**: 일정을 늘림 (6주 → 10-12주)
**옵션 2**: 다른 곳을 더 줄임

저는 **하이브리드**를 권합니다 — 일정을 약간 늘리고 다른 곳도 줄입니다.

### Track A: "Solo Founder + Multi-Agent" (8-10주)

원래 Track A(6주)를 8-10주로 늘립니다. 다음을 포함합니다.

**Week 1-2: 데이터 모델 + 기초**
- 16개 엔티티의 스키마 설계와 마이그레이션
- 인증, 워크스페이스 CRUD
- 기본 API 골격

**Week 3-4: 핵심 도메인**
- UseCase, Actor, Scenario, Step (Stakeholder, Goal 포함)
- Revision 시스템 (스냅샷 기반)
- 기본 검증 (코오번 필수 필드)

**Week 5: 브랜치와 락**
- SpecBranch, MergeRequest (단순 형태)
- Lock 3단계
- WorkSession + 브랜치 자동 통합

**Week 6: CLI**
- 모든 핵심 명령 (usecase, scenario, actor, goal, stakeholder, branch, lock, session)
- self-teaching 에러 메시지
- `vspec ai-guide`
- `--format=agent`

**Week 7: 웹 UI**
- 유스케이스 편집 (모든 코오번 필드 지원)
- 브랜치 전환·머지 UI
- 세션 모니터
- 활성 락 표시

**Week 8: dogfooding 본격화**
- 창업자 + AI 에이전트들로 실제 사용
- 발견된 문제 즉시 수정
- UX 마찰점 제거

**Week 9-10 (버퍼)**: 안정화

이 일정이 더 현실적입니다.

### 줄여야 할 다른 곳

8-10주에 맞추려면 다음을 더 줄여야 합니다.

- **웹 UI 최소화**: 처음에는 CLI 중심. 웹 UI는 보기/편집/머지에만 집중. 검색·필터는 단순.
- **인증 단일화**: GitHub OAuth 하나만 (이메일+비번 제외).
- **권한**: Owner와 Editor 2단계만 (Viewer 제외).
- **다국어 제외**: 영어 우선, 한국어는 v1.1.
- **Comment 단순화**: 유스케이스 단위만, 스레드 없음, resolved 없음.
- **수정 흐름**: `vspec usecase edit`는 **로컬 마크다운 편집**으로만. 웹 UI WYSIWYG는 v1.1.

마지막 항목은 특히 중요한 결정입니다. 이어서 설명합니다.

## 추가 권장: 로컬 파일 우선 (File-First) 워크플로

6+ 세션을 동시에 돌리는 사용자라면 **거의 확실히 IDE/터미널 중심**입니다. 이들에게는 웹 UI 편집보다 **로컬 마크다운 파일 편집**이 압도적으로 자연스럽습니다.

이렇게 작동합니다.

```
프로젝트 디렉토리 구조:
  .vspec/
    config.json        # 프로젝트 설정
    .session           # 현재 세션
    cache/             # 로컬 캐시
  specs/
    PAY-001.md         # 유스케이스 마크다운
    PAY-002.md
    AUTH-001.md
    ...
```

각 `.md` 파일은 코오번 양식을 따르는 마크다운입니다.

```markdown
---
id: PAY-001
title: 결제를 완료한다
level: USER_GOAL
primary_actor: customer
status: APPROVED
revision: rev_abc123
---

# 결제를 완료한다

## 이해관계자와 이익
- **고객**: 빠르고 정확하게 결제를 완료한다
- **은행**: 정확히 차감하고 사기를 방지한다

## 전제조건
- 고객이 로그인되어 있다
- 결제 수단이 등록되어 있다

## 성공보장
- 결제가 승인되고 영수증이 발행된다

## 주 시나리오
1. **고객**이 결제를 요청한다
2. **시스템**이 결제 수단을 확인한다
3. **고객**이 결제를 승인한다
4. **시스템**이 거래를 처리한다

## 확장
### 3a. 인증 실패
- 3a1. **시스템**이 재시도를 요청한다
- 3a2. 3회 실패 시 결제를 취소한다
```

CLI는 Git처럼 작동합니다.

```
vspec pull           # 서버에서 로컬로 가져오기
vspec status         # 변경된 파일들
vspec diff           # 로컬 변경 사항
vspec push           # 서버로 푸시 (충돌 검사 자동)
```

**이게 왜 강력한가**:

1. **AI 에이전트가 익숙한 형태**: Cursor, Claude Code는 파일을 읽고 쓰는 데 최적화되어 있습니다. 마크다운 파일이라면 그냥 평소처럼 쓰면 됩니다.
2. **Git 통합 자연스러움**: 사용자가 원하면 `specs/` 디렉토리를 자기 Git 저장소에 넣을 수 있습니다. vspec과 Git이 양립합니다.
3. **로컬에서 빠름**: 6+ 세션이 매번 API 호출하면 느립니다. 로컬 파일은 즉시 읽기 가능.
4. **충돌 해결이 익숙**: 충돌 시 Git의 충돌 마커처럼 보여줍니다. 개발자라면 익숙.

이 결정은 **MVP를 더 작게 만듭니다**. 웹 UI에서 WYSIWYG 편집기를 만들지 않아도 됩니다. 웹 UI는 "보기 + 머지 결정 + 대시보드" 정도로 충분합니다.

## 동시성 알고리즘 — 6+ 세션 환경 설계

6개 세션이 동시에 돌아간다는 건 다음과 같습니다.

```
세션 1: PAY-001 작업, 브랜치 feature/payment-impl
세션 2: PAY-001 작업, 브랜치 feature/payment-refactor
세션 3: AUTH-001 작업, 메인 브랜치
세션 4: REF-002 작업, 브랜치 feature/refund
세션 5: 메인 브랜치, 다른 유스케이스 추가
세션 6: 메인 브랜치, 스펙 리뷰만 (읽기)
```

이 환경에서 충돌이 안 나려면 다음 규칙이 필요합니다.

**규칙 1: 세션은 브랜치를 자동 생성**

`vspec session start --auto-branch` 옵션을 **기본값**으로 하면, 세션마다 격리된 브랜치가 생성됩니다. 두 에이전트가 같은 유스케이스를 작업해도 다른 브랜치라서 안전합니다.

**규칙 2: 브랜치는 자동으로 SEMANTIC 락**

세션이 브랜치를 만들면 작업 대상 유스케이스에 자동으로 SEMANTIC 락이 걸립니다. 다른 사람이 main에서 같은 유스케이스의 의미를 바꾸려고 하면 경고가 뜹니다.

**규칙 3: 머지 시점이 진실의 순간**

브랜치에서 작업하는 동안은 충돌이 없습니다. 머지할 때 main의 현재 상태와 비교합니다. 이때 충돌이 있으면 사람이 결정합니다.

이렇게 하면 **6+ 세션이 거의 충돌 없이 굴러갑니다**. 충돌은 머지 시점에만 발생하고, 그때만 사람이 결정하면 됩니다.

## CLI에서의 실제 모습

위 모델이 CLI에서 어떻게 보이는지:

```
$ vspec session start --intent "결제 구현" --pin PAY-001

🎯 새 세션을 시작합니다.

자동으로 다음 작업이 수행됩니다:
  ✓ 브랜치 생성: session/payment-impl-2026-05-18-1430
  ✓ PAY-001 스펙 핀: rev_abc123 (현재 main)
  ✓ SEMANTIC 락 획득: PAY-001

세션 정보:
  ID: session_42
  브랜치: session/payment-impl-2026-05-18-1430
  핀된 유스케이스: PAY-001@rev_abc123

다른 활성 세션 (5개):
  - session_38 (Alice, cursor): AUTH-001 작업, 브랜치 #38
  - session_40 (Bob, claude-code): PAY-001 작업, 브랜치 #40
    ⚠️ 같은 유스케이스 작업 중. 머지 시점에 충돌 가능.
  - session_41 (Charlie, windsurf): REF-002 작업, 브랜치 #41
  ...

다음 단계:
  vspec usecase show PAY-001 --format agent
  → 스펙 확인 및 다음 행동 제안
```

이 출력 하나에 동시성 정보가 다 들어있습니다. AI 에이전트가 이걸 읽고 "같은 유스케이스를 다른 세션이 작업 중이니 조심해야겠다"를 학습합니다.

## 머지 시 흐름

머지가 가장 까다로운 부분입니다. 단순하게 설계해야 합니다.

```
$ vspec session complete

세션 #42 종료를 시작합니다.

📊 변경 사항 요약:
  - PAY-001: 단계 5,6 추가
  - PAY-001: 확장 3b 추가

⚙️ main 브랜치와 비교 중...

✅ 자동 머지 가능 (충돌 없음)

머지 전 확인:
  vspec session preview-merge

진행:
  vspec session complete --confirm
```

충돌이 있다면:

```
⚠️ 머지 충돌 감지

PAY-001에 충돌이 있습니다:
  - 당신: 시나리오 3b 추가
  - main: 시나리오 3b 추가 (session_40에서 다른 내용으로)

해결 방법:
  [1] 내 변경 유지: vspec session resolve --strategy=mine
  [2] main 따르기:  vspec session resolve --strategy=theirs
  [3] 수동 해결:   vspec session resolve --interactive
  [4] 보류:       vspec session pause

자세히 보기:
  vspec session show-conflict PAY-001
```

CLI 사용자가 충돌을 빠르게 해결할 수 있는 단순한 인터페이스입니다.

## 수정된 MVP 검증 기준

새 기능들이 들어갔으니 검증 기준도 다음을 추가합니다.

**5. 6+ 세션 동시 작업 테스트**
- 6개의 AI 에이전트 세션을 동시 실행
- 각각 다른 유스케이스 작업
- 충돌 없이 모두 머지 가능
- 같은 유스케이스 작업 시 충돌이 명확히 감지·해결

**6. 코오번 정합성 테스트**
- 모든 코오번 필수 필드(이해관계자, 보장 등)가 작성 가능
- 액터-목표 목록에서 유스케이스 승격 가능
- 모든 변경이 Revision에 기록

## 한 가지 큰 권고: AI 에이전트 통합 SDK는 MVP에 포함

이 모든 게 의미를 가지려면, **AI 에이전트들이 vspec을 자연스럽게 호출**해야 합니다. CLI만으로는 부족합니다. 다음 둘 중 하나는 MVP에 포함하기를 권합니다.

**옵션 A: MCP 서버**
Claude Desktop, Cursor, 기타 MCP 지원 클라이언트에서 vspec을 도구로 호출 가능.

**옵션 B: 표준 CLI 패턴 강화**
MCP 없이도, `vspec ai-guide`와 `--format=agent`를 매우 잘 만들어서 어떤 에이전트도 CLI로 자연스럽게 쓰게 함.

저는 **둘 다, 단 옵션 B 우선**을 권합니다. MCP는 진입 장벽이 높습니다(Claude Desktop이나 특정 환경에서만). CLI는 모든 환경에서 작동합니다. CLI를 self-teaching하게 만들고, 그 위에 MCP 서버를 얹는 순서가 좋습니다.

이걸 MVP에 포함하면 일정이 더 늘어납니다. 그래서:

**Track A 최종**: 10주

- Week 1-8: 위 계획대로
- Week 9: MCP 서버 + 에이전트 통합 가이드
- Week 10: 안정화와 dogfooding 마감

## 의도적 안 하기 (재확인)

10주에 맞추려면 다음을 명시적으로 빼야 합니다.

- ❌ 웹 UI WYSIWYG 편집기 (로컬 마크다운으로 대체)
- ❌ Glossary, Tag, Template
- ❌ 정식 Review/Approval 흐름
- ❌ Webhook, AuditLog
- ❌ ExternalLink, Attachment
- ❌ Team 엔티티 (멤버십만)
- ❌ AI 기반 의미적 변경 분석 (규칙 기반만)
- ❌ AI 기반 자동 추천 (Goal 추천, 누락 액터 발견 등)
- ❌ 다국어 (영어만, 한국어는 v1.1)
- ❌ 모바일
- ❌ 결제 (베타는 무료, 결제는 v1.1)
- ❌ 분석 대시보드
- ❌ 멀티 단계 브랜치 (1단계만)
- ❌ Goal 외 백로그 기능 (스프린트, 칸반 등)

이 목록은 자주 검토해야 합니다. **새 제약을 추가했으니 다른 곳에서 더 엄격해져야 합니다.**

## 요약: 수정된 MVP

**범위**: 16개 엔티티 (Stakeholder, Goal, Branch, Lock 포함)
**기능**: 풀스펙 엔티티, 미니멀 기능 ("Schema-Complete, Feature-Minimal")
**핵심 통찰**: 6+ 세션 환경은 분산 시스템 → 브랜치와 락이 처음부터 필요
**대신 줄인 것**: 웹 UI 편집 → 로컬 마크다운 파일 (File-First)
**일정**: 10주 (원래 6주에서 4주 추가)
**검증**: 6개 동시 세션 충돌 없음, 코오번 정합성, AI 자가 학습

이 모든 결정의 일관된 철학은: **"vspec의 사용자가 분산 멀티 에이전트 시스템을 운용한다는 사실을 데이터 모델의 1일차부터 받아들인다."**

이게 vspec의 진짜 정체성입니다. 다른 스펙 도구와의 결정적 차이입니다.

---

다음으로 깊이 파볼 만한 방향:

1. **데이터 모델의 정확한 스키마 설계** — 16개 엔티티의 DDL 수준 정의
2. **File-First 워크플로의 구체적 설계** — `.vspec/` 디렉토리, 마크다운 양식, 동기화 프로토콜
3. **6+ 세션 동시 시뮬레이션 시나리오** — 실제 발생 가능한 충돌 케이스와 해결책
4. **dogfooding용 vspec 유스케이스 30개 도출** — Week 1부터 마크다운으로 작성 시작

어디로 가볼까요?
---

좋아. 일단 유스케이스부터 도출해보자

---

좋습니다. 이게 dogfooding의 진짜 시작입니다. 이 작업이 곧 vspec의 첫 사용 사례가 됩니다.

먼저 코오번 방법론대로 **액터-목표 목록**부터 만들고, 거기서 핵심 유스케이스를 도출하는 순서로 가겠습니다. 이 순서 자체가 vspec이 권장하는 워크플로이기도 하니까요.

## 1단계: 액터 식별

vspec 시스템의 액터를 먼저 정리합니다.

### 주 액터 (Primary Actors)

**1. Human Developer / PM**
시스템과 직접 상호작용하는 사람. 유스케이스를 작성·검토·승인합니다.

**2. AI Coding Agent**
Cursor, Claude Code, Windsurf 등에서 동작하는 AI 에이전트. CLI 또는 MCP를 통해 vspec과 상호작용합니다. **인간 사용자의 위임으로** 작동하지만, 독립된 액터로 모델링합니다 (별도 세션, 별도 의사결정 패턴).

**3. Workspace Admin**
워크스페이스 관리자. 멤버 관리, 결제, 설정을 담당합니다.

### 지원 액터 (Supporting Actors)

**4. CI/CD System**
파이프라인에서 vspec API를 호출. 자동 테스트 검증, 스펙 변경 검출 등.

**5. External Auth Provider**
GitHub OAuth 등 외부 인증 시스템.

### 무대 뒤 액터 (Offstage Actors)

**6. Stakeholder (간접)**
vspec을 직접 쓰지 않지만 이익을 가진 자: 사용자의 조직, 규제 기관 등. (MVP에서는 모델링 안 함)

---

## 2단계: 이해관계자 식별

코오번식으로 vspec의 이해관계자도 정리합니다 (vspec이 보호해야 할 이익을 가진 자들).

| 이해관계자 | 핵심 이익 |
|----------|---------|
| Human Developer/PM | 명확한 스펙, 빠른 작업, AI와 매끄러운 협업 |
| AI Coding Agent | 안정된 스펙 컨텍스트, 명확한 완료 조건 |
| Workspace Admin | 데이터 보안, 비용 통제, 멤버 관리 |
| Vooster (당사) | 사용자 유지, 데이터 무결성, 시스템 안정성 |
| 사용자의 다운스트림 시스템 | 일관된 Gherkin/테스트 출력 |

---

## 3단계: 액터-목표 목록 (Actor-Goal List)

이제 각 액터가 vspec에 와서 이루고 싶은 목표를 나열합니다. **사용자 목표 수준(바다 수준)**으로 작성합니다.

### Human Developer / PM의 목표

| ID | 목표 | 수준 | 우선순위 |
|----|------|------|---------|
| HD-01 | 워크스페이스에 가입한다 | UG | P0 |
| HD-02 | 프로젝트를 생성한다 | UG | P0 |
| HD-03 | 액터를 정의한다 | UG | P0 |
| HD-04 | 이해관계자를 정의한다 | UG | P0 |
| HD-05 | 액터-목표 목록을 작성한다 | UG | P0 |
| HD-06 | 목표를 유스케이스로 승격한다 | UG | P0 |
| HD-07 | 유스케이스를 작성한다 | UG | P0 |
| HD-08 | 시나리오와 단계를 편집한다 | UG | P0 |
| HD-09 | 확장 흐름을 추가한다 | UG | P0 |
| HD-10 | 유스케이스 목록을 조회한다 | UG | P0 |
| HD-11 | 유스케이스 변경 이력을 본다 | UG | P0 |
| HD-12 | 두 버전의 유스케이스를 비교한다 | UG | P0 |
| HD-13 | Gherkin으로 내보낸다 | UG | P0 |
| HD-14 | 로컬 마크다운 파일과 동기화한다 | UG | P0 |
| HD-15 | 충돌을 해결한다 | UG | P0 |
| HD-16 | 다른 사람의 활성 작업을 확인한다 | UG | P0 |
| HD-17 | 브랜치를 만들고 머지한다 | UG | P0 |
| HD-18 | 유스케이스에 코멘트를 단다 | UG | P1 |
| HD-19 | 워크스페이스 멤버를 초대한다 | UG | P1 |
| HD-20 | API 키를 발급한다 | UG | P1 |

### AI Coding Agent의 목표

| ID | 목표 | 수준 | 우선순위 |
|----|------|------|---------|
| AI-01 | vspec 사용법을 학습한다 | UG | P0 |
| AI-02 | 작업 세션을 시작한다 | UG | P0 |
| AI-03 | 핀된 유스케이스를 조회한다 | UG | P0 |
| AI-04 | Gherkin 테스트를 생성한다 | UG | P0 |
| AI-05 | 스펙 변경을 제안한다 | UG | P0 |
| AI-06 | 변경의 영향을 확인한다 | UG | P0 |
| AI-07 | 다른 세션의 활동을 인지한다 | UG | P0 |
| AI-08 | 작업 세션을 종료한다 | UG | P0 |
| AI-09 | 충돌을 해결한다 | UG | P0 |

### Workspace Admin의 목표

| ID | 목표 | 수준 | 우선순위 |
|----|------|------|---------|
| WA-01 | 멤버를 초대·제거한다 | UG | P1 |
| WA-02 | 멤버 권한을 설정한다 | UG | P1 |
| WA-03 | API 키를 관리한다 | UG | P1 |
| WA-04 | 워크스페이스 설정을 변경한다 | UG | P1 |

### CI/CD System의 목표

| ID | 목표 | 수준 | 우선순위 |
|----|------|------|---------|
| CI-01 | API로 인증한다 | SF | P1 |
| CI-02 | Gherkin을 자동 동기화한다 | UG | P1 |
| CI-03 | 스펙 변경을 감지한다 | UG | P2 |

---

## 4단계: MVP 핵심 유스케이스 우선순위

P0 항목들이 MVP의 핵심입니다. 30개가 좀 넘는데, 일부는 통합 가능합니다. **dogfooding 가능 수준**으로 35개의 유스케이스를 도출했습니다.

이걸 다음 카테고리로 묶어 정리하겠습니다.

```
A. 인증·온보딩         (3개)
B. 프로젝트·도메인 설정   (4개)
C. 유스케이스 작성·관리  (8개)
D. 동시성·세션·브랜치   (8개)
E. 협업·변경 관리       (5개)
F. 출력·통합           (4개)
G. AI 에이전트 전용     (3개)
```

전체 35개입니다. 이걸 한 화면에 표로 정리하면:

| ID | 카테고리 | 주 액터 | 제목 | 수준 | MVP |
|---|---|---|---|---|---|
| **A. 인증·온보딩** ||||||
| UC-001 | 인증 | 개발자/PM | 워크스페이스에 가입한다 | UG | ✓ |
| UC-002 | 인증 | 개발자/PM | 로그인한다 | UG | ✓ |
| UC-003 | 인증 | 관리자 | 멤버를 초대한다 | UG | ✓ |
| **B. 프로젝트·도메인 설정** ||||||
| UC-004 | 프로젝트 | 개발자/PM | 프로젝트를 생성한다 | UG | ✓ |
| UC-005 | 도메인 | 개발자/PM | 액터를 정의한다 | UG | ✓ |
| UC-006 | 도메인 | 개발자/PM | 이해관계자를 정의한다 | UG | ✓ |
| UC-007 | 도메인 | 개발자/PM | 액터-목표 목록을 관리한다 | UG | ✓ |
| **C. 유스케이스 작성·관리** ||||||
| UC-008 | 유스케이스 | 개발자/PM | 목표를 유스케이스로 승격한다 | UG | ✓ |
| UC-009 | 유스케이스 | 개발자/PM | 유스케이스를 처음부터 작성한다 | UG | ✓ |
| UC-010 | 유스케이스 | 개발자/PM | 이해관계자 이익을 정의한다 | UG | ✓ |
| UC-011 | 유스케이스 | 개발자/PM | 주 성공 시나리오를 작성한다 | UG | ✓ |
| UC-012 | 유스케이스 | 개발자/PM | 확장 흐름을 추가한다 | UG | ✓ |
| UC-013 | 유스케이스 | 개발자/PM | 유스케이스 단계를 편집한다 | UG | ✓ |
| UC-014 | 유스케이스 | 개발자/PM | 유스케이스를 검색·필터링한다 | UG | ✓ |
| UC-015 | 유스케이스 | 개발자/PM | 유스케이스를 삭제·아카이브한다 | UG | ✓ |
| **D. 동시성·세션·브랜치** ||||||
| UC-016 | 세션 | 개발자/PM/AI | 작업 세션을 시작한다 | UG | ✓ |
| UC-017 | 세션 | 개발자/PM/AI | 활성 세션을 모니터링한다 | UG | ✓ |
| UC-018 | 세션 | 개발자/PM/AI | 작업 세션을 종료한다 | UG | ✓ |
| UC-019 | 브랜치 | 개발자/PM | 브랜치를 생성한다 | UG | ✓ |
| UC-020 | 브랜치 | 개발자/PM | 브랜치를 머지한다 | UG | ✓ |
| UC-021 | 브랜치 | 개발자/PM | 머지 충돌을 해결한다 | UG | ✓ |
| UC-022 | 락 | 개발자/PM/AI | 유스케이스에 락을 건다 | UG | ✓ |
| UC-023 | 락 | 개발자/PM | 누가 작업 중인지 확인한다 | UG | ✓ |
| **E. 협업·변경 관리** ||||||
| UC-024 | 버전 | 개발자/PM | 유스케이스 변경 이력을 본다 | UG | ✓ |
| UC-025 | 버전 | 개발자/PM | 두 버전을 비교한다 | UG | ✓ |
| UC-026 | 버전 | 개발자/PM | 이전 버전으로 되돌린다 | UG | ✓ |
| UC-027 | 변경 | 개발자/PM/AI | 변경의 영향을 분석한다 | UG | ✓ |
| UC-028 | 코멘트 | 개발자/PM | 유스케이스에 코멘트를 단다 | UG | ✓ |
| **F. 출력·통합** ||||||
| UC-029 | 동기화 | 개발자/PM/AI | 로컬 파일과 동기화한다 (pull/push) | UG | ✓ |
| UC-030 | Export | 개발자/PM/AI | Gherkin으로 내보낸다 | UG | ✓ |
| UC-031 | Export | 개발자/PM | 유스케이스를 마크다운으로 내보낸다 | UG | ✓ |
| UC-032 | API | 관리자 | API 키를 발급·관리한다 | UG | ✓ |
| **G. AI 에이전트 전용** ||||||
| UC-033 | AI | AI 에이전트 | vspec 사용법을 학습한다 | UG | ✓ |
| UC-034 | AI | AI 에이전트 | 구조화된 스펙을 조회한다 | UG | ✓ |
| UC-035 | AI | AI 에이전트 | 스펙 변경을 제안한다 | UG | ✓ |

---

## 5단계: 의도적으로 뺀 것들

명시적으로 MVP에서 빼는 것을 적어두는 게 중요합니다. (액터-목표 목록의 일부지만 의도적으로 제외)

- ❌ 유스케이스 템플릿 시스템 (v1.1)
- ❌ Glossary/Term 관리 (v1.1)
- ❌ Tag 시스템 (v1.1)
- ❌ 정식 Review/Approval 워크플로 (v1.1)
- ❌ Webhook 설정 (v1.1)
- ❌ 분석 대시보드 (v1.1)
- ❌ Audit 로그 조회 UI (백엔드만 기록, UI는 v1.1)
- ❌ 외부 도구 연동 (Jira/Linear/Figma — v1.2+)
- ❌ 다단계 브랜치 (v1.1, 1단계만 지원)
- ❌ MCP 서버 (Track C — v1.0 후반에)
- ❌ AI 기반 자동 추천 (Goal 자동 제안, 누락 액터 발견 등 — v1.1)
- ❌ AI 기반 의미적 변경 분석 (v1.1, MVP는 규칙 기반)

---

## 6단계: 카테고리별 짧은 해설

각 카테고리가 왜 이렇게 묶였는지 짧게 설명합니다.

### A. 인증·온보딩 (3개)

가장 기본 진입. GitHub OAuth 하나만 지원합니다. UC-003은 관리자 기능이지만 솔로 사용자도 결국 멤버를 초대하게 되니 P0.

### B. 프로젝트·도메인 설정 (4개)

코오번 방식의 핵심: **유스케이스 전에 액터와 이해관계자를 먼저 정의**합니다. UC-007 액터-목표 목록은 코오번 워크플로의 시작점이라 P0.

### C. 유스케이스 작성·관리 (8개)

가장 큰 카테고리. 코오번의 모든 필드(이해관계자 이익, 주 시나리오, 확장 흐름)가 각각 별도 유스케이스로 분리됩니다. 이게 사용자 목표 수준에서 맞습니다 — 사용자가 "이해관계자 이익을 정의하는 행위"와 "확장 흐름을 추가하는 행위"는 다른 의도로 시작합니다.

### D. 동시성·세션·브랜치 (8개)

vspec의 정체성. 6+ 세션 환경을 위한 핵심. UC-016~018은 세션 라이프사이클, UC-019~021은 브랜치, UC-022~023은 락.

### E. 협업·변경 관리 (5개)

버전, diff, 영향 분석, 코멘트. 모두 P0인 이유: dogfooding 첫날부터 "내가 어제 뭘 바꿨지?", "이 변경이 어디 영향을 주지?"가 필요합니다.

### F. 출력·통합 (4개)

vspec이 폐쇄형이 아니라 **외부로 흘러나가야 합니다**. Gherkin은 자동 테스트로, 마크다운은 문서로, 로컬 동기화는 에이전트로.

### G. AI 에이전트 전용 (3개)

인간 액터의 유스케이스와 별도로 모델링합니다. 같은 행위(예: 유스케이스 조회)라도 AI 에이전트의 의도와 사람의 의도가 다릅니다.
- AI: "내 구현의 완료 조건을 알고 싶다"
- 사람: "내가 작성한 것이 잘 됐는지 검토하고 싶다"

이걸 분리하면 AI 친화 출력(`--format=agent`, suggested_next_actions)을 자연스럽게 설계할 수 있습니다.

---

## 7단계: 다음 작업 — 풀스펙 작성 순서

35개를 동시에 풀스펙으로 쓸 수는 없습니다. **개발 순서대로 풀스펙화**하는 게 좋습니다. 이렇게 제안합니다.

### 1차 (Week 1-2 작성, 코어 도메인)
- UC-009: 유스케이스를 처음부터 작성한다 ⭐ (가장 중심)
- UC-005: 액터를 정의한다
- UC-006: 이해관계자를 정의한다
- UC-011: 주 성공 시나리오를 작성한다
- UC-012: 확장 흐름을 추가한다

이 5개가 vspec의 **핵심 가치**를 담습니다. 이것부터 풀스펙으로 써야 dogfooding이 시작됩니다.

### 2차 (Week 3, 동시성 핵심)
- UC-016: 작업 세션을 시작한다 ⭐
- UC-018: 작업 세션을 종료한다
- UC-019: 브랜치를 생성한다
- UC-020: 브랜치를 머지한다
- UC-021: 머지 충돌을 해결한다

이게 vspec의 **차별점**을 담습니다. 가장 어려운 부분.

### 3차 (Week 4, 통합·출력)
- UC-029: 로컬 파일과 동기화한다 ⭐
- UC-030: Gherkin으로 내보낸다
- UC-033: vspec 사용법을 학습한다 (AI)
- UC-034: 구조화된 스펙을 조회한다 (AI)
- UC-035: 스펙 변경을 제안한다 (AI)

이게 vspec이 **외부와 어떻게 연결되는가**를 담습니다.

### 4차 (Week 5, 나머지)
나머지 20개는 한 번에 풀스펙으로 작성. 이 단계에서는 패턴이 잡혀 있어 빠릅니다.

---

## 8단계: 작성 양식 제안

각 유스케이스의 풀스펙은 이 양식을 따르겠습니다 (vspec 자체 양식이기도 함):

```markdown
---
id: UC-009
title: 유스케이스를 처음부터 작성한다
level: USER_GOAL
primary_actor: Human Developer/PM
status: DRAFT
scope: vspec 시스템
---

## 이해관계자와 이익
- **개발자/PM**: 코오번 방식에 맞는 유스케이스를 빠르게 작성하고 싶다
- **AI 에이전트**: 이후 작업에 필요한 안정된 스펙이 생기길 원한다
- **Vooster**: 작성된 스펙이 손실 없이 보존되길 원한다

## 전제조건
- 사용자가 프로젝트에 접근 권한이 있다
- 프로젝트에 최소 하나의 액터가 정의되어 있다

## 성공보장
- 유스케이스가 생성되고 고유 ID가 부여된다
- 초기 revision이 기록된다
- 사용자가 즉시 시나리오 작성으로 이어갈 수 있다

## 최소보장
- 어떤 경우에도 부분적으로 손상된 유스케이스는 저장되지 않는다
- 작성 중 중단되어도 작성한 내용은 임시 저장된다

## 트리거
사용자가 `vspec usecase create` 명령 또는 웹 UI에서 "새 유스케이스" 버튼을 클릭한다.

## 주 성공 시나리오
1. 사용자가 유스케이스 작성을 시작한다
2. 시스템이 필수 정보를 요청한다 (제목, 주 액터, 수준)
3. 사용자가 제목을 입력한다
4. 시스템이 제목이 동사구인지 검증한다
5. 사용자가 주 액터를 선택한다
6. 사용자가 수준을 선택한다 (사용자 목표 / 하위 기능 / 요약)
7. 시스템이 유스케이스를 생성하고 ID를 부여한다
8. 시스템이 초기 revision을 기록한다
9. 시스템이 시나리오 작성 화면으로 안내한다

## 확장
### 4a. 제목이 동사구가 아님 (예: "버튼 클릭")
- 4a1. 시스템이 경고와 함께 동사구 예시를 제시한다
- 4a2. 사용자가 수정하거나 --force로 진행

### 5a. 사용 가능한 액터가 없음
- 5a1. 시스템이 액터 정의 화면으로 안내한다
- 5a2. 사용자가 액터를 정의하고 돌아온다

### 7a. 동일 제목의 유스케이스가 존재
- 7a1. 시스템이 경고하고 기존 유스케이스를 표시한다
- 7a2. 사용자가 새 제목으로 변경하거나 진행

### *a. 작성 도중 사용자가 중단
- *a1. 시스템이 자동 임시 저장한다
- *a2. 다음 접속 시 이어쓰기 옵션 제공
```

---

## 정리와 제안

지금까지 한 일:
- 6개 액터 식별 (주 3, 지원 2, 무대 뒤 1)
- 5개 이해관계자 식별
- 액터-목표 목록 총 36개 (P0=30, P1=6)
- MVP 유스케이스 35개 도출 (7개 카테고리)
- 의도적 제외 항목 명시
- 풀스펙 작성 순서 4차 분할
- 작성 양식 제안

지금 시점에서 결정해야 할 것:

1. **이 35개 목록이 합리적인가?** 빠진 것, 과한 것은?
2. **카테고리 분류와 우선순위가 맞나?**
3. **풀스펙 작성을 어떤 순서로 진행할까?** (1차 5개부터 같이 써볼지)
4. **양식이 OK한가?** (코오번 권장 양식에서 조정할 부분)

다음 단계 후보:

**A. 1차 5개 유스케이스의 풀스펙을 같이 작성**
- 가장 핵심인 UC-009, UC-005, UC-006, UC-011, UC-012부터
- 작성하면서 양식의 어색한 부분을 발견하고 다듬기

**B. 액터-목표 목록의 누락 점검**
- 35개가 정말 충분한지 더 도전적으로 검토
- 특히 에러 처리·복구 시나리오들

**C. 데이터 모델로 한 번 더 검증**
- 16개 엔티티가 35개 유스케이스를 모두 지원하는지 매핑
- 누락된 엔티티나 필드가 있는지 발견

어디로 갈까요?

---

codex 라는 코딩 에이전트를 사용해서 개발할거고, 이 에이전트에는 `goal`이라는 기능이 있어. 입력된 프롬프트의 완료조건이 만족될때까지 계속해서 반복해서 실행하는 기능이야.

이 기능을 사용해서, MVP 스펙을 전부 한번에 구현해내고싶거든? 일단 완료조건은 '모든 유스케이스에 대한 E2E 테스트가 존재하며, 통과하는가?'일거야.

완료조건이 만족되지 않았다면, 상황에 맞는 적절한 액션을 해야할거야. 코드베이스 스캐폴딩, 테스트 프레임워크 세팅 등 기반 액션이 필요할 수도 있고, 기능 및 테스트코드 작성이 필요할 수도 있지. 반드시 TDD 기법을 따르면 좋겠고, 코딩에이전트가 켄트벡처럼 사고하면 좋겠어.

이제 이 goal 기능을 사용해 무한 loop를 돌리기위한 세팅을 고민해보자.

goal에 입력할 프롬프트, 생성해둘 AGENTS.md, docs/* 파일 등을 고민해야해.
속도 및 비용 최적화를 위해 프롬프트 캐싱을 최대한 활용할 수 있는 구조로 고민해보자.

---

정말 야심찬 시도입니다. 이건 사실 **자율 개발 시스템 설계**에 가까운 일이고, 성공하면 개발 방법론 자체에 영향을 줄 만한 실험입니다.

먼저 솔직히 말씀드릴 것이 있습니다. 이 접근에는 두 가지 종류의 리스크가 있습니다.

**기술적 리스크**: 에이전트가 무한 루프에 갇히거나, 테스트를 우회하거나(예: 테스트를 약하게 수정), 부분 최적해에 빠지는 경우.

**비용 리스크**: 잘못 설계하면 토큰을 천문학적으로 태웁니다. 35개 유스케이스 × 깊은 컨텍스트 × 반복 횟수 = 쉽게 수억 토큰이 됩니다.

이 두 리스크를 모두 의식하면서 설계해 보겠습니다. 핵심 전략을 먼저 잡고, 구체적 파일을 설계하겠습니다.

## 1부: 전략적 결정 5가지

본격적인 파일 설계 전에, 결정해야 할 것들이 있습니다.

### 결정 1: 완료 조건의 재정의

"모든 유스케이스에 대한 E2E 테스트가 존재하며 통과한다"는 강력한 조건이지만, **에이전트가 쉽게 게임할 수 있습니다**. 다음 방식들로 우회 가능합니다.

- 테스트를 약하게 수정 ("expect(true).toBe(true)" 같은 의미 없는 통과)
- 일부 시나리오를 누락
- Mock으로 실제 로직 우회
- 테스트는 통과하지만 실제 기능은 작동 안 함

이걸 막으려면 완료 조건이 **다층적**이어야 합니다.

```
완료 조건 (모두 통과해야 함):

1. 구조 검증
   - 35개 유스케이스 각각에 대한 E2E 테스트 파일 존재
   - 각 테스트 파일이 정의된 최소 시나리오 수 충족
     (주 시나리오 1개 + 확장 시나리오 N개)

2. 기능 검증
   - E2E 테스트 100% 통과
   - 단위 테스트 90%+ 커버리지
   - 통합 테스트 통과

3. 정합성 검증
   - 테스트 코드의 정적 분석 통과 (mutation testing 권장)
   - 금지된 우회 패턴 부재 (expect(true) 같은)
   - 각 테스트가 최소 N개의 assertion 포함

4. 동작 검증
   - 빌드 성공
   - 린트 통과
   - 타입 체크 통과 (TypeScript 사용 시)
   - 자체 dogfooding 시나리오 통과 (vspec으로 vspec의 유스케이스 등록 가능)
```

특히 **4번이 핵심**입니다. 자기 자신으로 자기 자신을 등록할 수 있다는 건 강력한 통합 테스트입니다.

### 결정 2: 무한 루프가 아니라 "유한 사이클의 무한 반복"

진짜 무한 루프는 위험합니다. 다음 구조를 권합니다.

```
GOAL (전체 완료 조건)
  ↓
이터레이션 (한 번의 큰 사이클)
  ↓
  ├─ 진단: 현재 상태 파악
  ├─ 우선순위: 가장 막힌 곳 식별
  ├─ 계획: 다음 작업 결정
  ├─ TDD 사이클: Red → Green → Refactor
  ├─ 검증: 새 변경의 영향 확인
  └─ 회고: 무엇이 작동했고 무엇이 안 됐는지
  ↓
이터레이션 종료, 다음 이터레이션 시작
```

각 이터레이션은 **제한된 시간/토큰 예산**을 가집니다. 한 이터레이션이 무한정 길어지지 않게 합니다.

### 결정 3: TDD 사이클의 강제

켄트 벡 스타일 TDD를 강제하려면 다음을 의무화해야 합니다.

**Red-Green-Refactor를 한 사이클로**:

1. 실패하는 테스트 작성 (Red)
2. 테스트를 통과하는 최소 코드 작성 (Green)
3. 리팩토링 (Refactor)
4. 모든 기존 테스트 여전히 통과 확인

**핵심 강제 장치**: 매 사이클마다 **Git commit을 강제**합니다. 커밋 메시지에 단계를 명시하게 합니다.

```
red: UC-009 add failing test for usecase creation
green: UC-009 implement minimal usecase creation
refactor: UC-009 extract validation logic
```

이렇게 하면 git log만 봐도 TDD를 지켰는지 검증 가능합니다.

### 결정 4: 컨텍스트 분할로 캐싱 극대화

이게 비용 최적화의 핵심입니다. LLM의 프롬프트 캐싱은 **공통 프리픽스가 길수록** 효과적입니다. 따라서 컨텍스트를 다음과 같이 계층화합니다.

```
[캐시 레벨 1: 거의 안 바뀜]   ← 최대 캐시 활용
  - AGENTS.md (워크플로 규칙)
  - docs/architecture.md
  - docs/cockburn-method.md
  - docs/tech-stack.md

[캐시 레벨 2: 가끔 바뀜]
  - docs/usecases/UC-*.md (35개 유스케이스 풀스펙)
  - docs/data-model.md
  - docs/api-contract.md

[캐시 레벨 3: 자주 바뀜]
  - docs/state/progress.md (현재 진척도)
  - docs/state/next-task.md (다음 할 일)

[캐시 레벨 4: 매번 바뀜]
  - 현재 실행 결과, 테스트 출력 등
```

프롬프트 구성 시 항상 **1→2→3→4 순서**로 배치합니다. 이러면 1, 2는 대부분 캐시 히트가 됩니다.

### 결정 5: 에이전트의 자기 제어 능력 강화

에이전트가 헛돌지 않게 하려면 **자기 진단 도구**가 필요합니다. 다음을 미리 만들어 둡니다.

```
scripts/
  diagnose.sh        # 현재 상태 진단
  next-task.sh       # 다음 작업 추천
  verify-tdd.sh      # TDD 사이클 검증
  check-bypass.sh    # 우회 패턴 탐지
  update-state.sh    # 진척도 업데이트
```

에이전트는 이 스크립트들을 호출해서 자기 상태를 파악합니다. 이게 매번 LLM이 추론하는 것보다 정확하고 저렴합니다.

---

## 2부: 파일 구조 설계

위 전략을 반영해서 구체적 파일 구조를 설계합니다.

```
프로젝트 루트/
├── AGENTS.md                    # 에이전트의 마스터 가이드
├── GOAL.md                      # codex goal에 입력할 프롬프트
├── package.json
├── tsconfig.json
├── README.md
│
├── docs/
│   ├── 00-overview.md           # 전체 그림 (캐시 L1)
│   ├── 01-architecture.md       # 시스템 아키텍처 (캐시 L1)
│   ├── 02-tech-stack.md         # 기술 스택과 라이브러리 (캐시 L1)
│   ├── 03-cockburn-method.md    # 코오번 방법론 요약 (캐시 L1)
│   ├── 04-tdd-protocol.md       # TDD 프로토콜 (캐시 L1)
│   ├── 05-data-model.md         # 16개 엔티티 (캐시 L2)
│   ├── 06-api-contract.md       # API 스키마 (캐시 L2)
│   ├── 07-cli-spec.md           # CLI 명세 (캐시 L2)
│   ├── 08-file-format.md        # 마크다운/JSON 양식 (캐시 L2)
│   │
│   ├── usecases/                # 35개 유스케이스 풀스펙 (캐시 L2)
│   │   ├── _index.md
│   │   ├── UC-001-...md
│   │   ├── UC-002-...md
│   │   └── ...
│   │
│   ├── decisions/               # ADR (Architecture Decision Records)
│   │   └── ADR-NNN-*.md
│   │
│   └── state/                   # 자주 바뀌는 상태 (캐시 L3)
│       ├── progress.md          # 진척도 매트릭스
│       ├── next-task.md         # 다음 작업
│       ├── blockers.md          # 막힌 문제들
│       ├── iteration-log.md     # 이터레이션 기록
│       └── learnings.md         # 회고 누적
│
├── scripts/
│   ├── diagnose.sh
│   ├── next-task.sh
│   ├── verify-tdd.sh
│   ├── check-bypass.sh
│   ├── update-state.sh
│   ├── run-tests.sh
│   └── completion-check.sh      # 완료 조건 검증
│
├── src/                         # 실제 구현
├── tests/                       # 테스트
│   ├── e2e/                     # 유스케이스별 E2E
│   │   ├── UC-001.test.ts
│   │   └── ...
│   ├── integration/
│   └── unit/
│
└── .vspec/                      # 자체 dogfooding용
    └── ...
```

---

## 3부: 핵심 파일 콘텐츠

가장 중요한 파일들의 내용을 설계합니다.

### GOAL.md (codex goal에 입력할 프롬프트)

이게 가장 중요합니다. 짧고, 강제적이고, 명확해야 합니다.

```markdown
# Mission: Build vspec MVP via TDD

## Your Identity

You are a software engineer working in the style of Kent Beck. You think test-first.
You make small, verifiable changes. You favor simplicity. You refactor mercilessly
once tests pass. You never write production code without a failing test.

## The Goal

Build vspec MVP such that:

1. All 35 use cases defined in docs/usecases/ have passing E2E tests
2. All quality gates pass (see docs/04-tdd-protocol.md)
3. vspec can successfully manage its own use cases (self-dogfooding)

## Mandatory First Step (every iteration)

ALWAYS start each iteration by running:

    bash scripts/diagnose.sh

This tells you the current state. Do not skip this. Do not assume state.

## Mandatory Reading Order

Read these in order, every iteration. They are designed to maximize cache hits:

1. AGENTS.md - your working protocol
2. docs/state/next-task.md - what to work on now
3. docs/state/blockers.md - what is blocking progress
4. docs/usecases/<current-UC>.md - the use case you are implementing

Do NOT re-read documents you have already loaded in this conversation unless
diagnose.sh tells you they have changed.

## The TDD Loop (this is non-negotiable)

For every piece of behavior you implement:

1. RED: Write a failing test. Commit with message: "red: <UC-ID> <description>"
2. GREEN: Write minimum code to pass. Commit: "green: <UC-ID> <description>"
3. REFACTOR: Improve design. All tests still pass. Commit: "refactor: <UC-ID> <description>"

After each step, run: bash scripts/verify-tdd.sh

If verify-tdd.sh fails, you violated the protocol. Fix it before continuing.

## Forbidden Actions

- Writing production code without a failing test first
- Modifying tests to make them pass (other than fixing genuinely wrong assertions)
- Using `expect(true).toBe(true)` or any tautological assertions
- Skipping commits between TDD phases
- Reading files not in the mandatory reading list unless necessary for current task
- Working on more than one use case per iteration

## Completion Check

At the end of each iteration, run:

    bash scripts/completion-check.sh

This reports current completion status. When it returns 0 (success), the goal is met.

## When Stuck

If you cannot make progress on the current task:

1. Document the blocker in docs/state/blockers.md
2. Run bash scripts/next-task.sh to get a different task
3. Move on. Do not loop on a single problem.

## Updating State

At the END of every iteration, run:

    bash scripts/update-state.sh

This updates progress.md, next-task.md, and learnings.md based on git history.

## Now Begin

Run: bash scripts/diagnose.sh
```

이 프롬프트의 설계 의도:

- **짧음**: 토큰 절약
- **순서가 명확**: 에이전트가 헷갈리지 않음
- **금지 사항 명시**: 우회 차단
- **스크립트로 위임**: LLM 추론 비용 절감
- **막혔을 때 탈출구**: 무한 루프 방지

### AGENTS.md (워크플로 마스터 가이드)

이건 캐시 L1이라 길어도 됩니다. 한 번 캐시되면 계속 재사용됩니다.

```markdown
# AGENTS.md — Working Protocol for vspec Development

## You Are

A test-first software engineer. Your hero is Kent Beck. Your bible is:
"Test-Driven Development: By Example."

You believe:

- Tests are the design tool, not just verification
- The simplest thing that could possibly work is usually right
- Code that is not tested does not exist
- Duplication is the enemy; eliminate it through refactoring
- Make it work, make it right, make it fast — in that order

## Working Principles

### 1. Small Steps

Every commit is a small, complete unit. If you cannot commit, your step is too big.
Break it down.

### 2. Test First, Always

Production code exists to make failing tests pass. If you find yourself writing
production code without a failing test, stop. Write the test first.

### 3. One Use Case Per Iteration

Each iteration focuses on exactly one use case. Do not jump between use cases.

### 4. Boring Solutions

Choose the most boring solution that works. Cleverness is a debt.

### 5. Refactor Mercilessly After Green

Once tests pass, look for duplication, unclear names, and complexity. Improve
them. Run tests after every refactor.

## Workflow Per Iteration

### Phase 1: Orient (5-10% of iteration)
```

bash scripts/diagnose.sh
cat docs/state/next-task.md

```

Understand:
- What is done
- What is in progress
- What the current task is

### Phase 2: Read Spec (10-15% of iteration)

Read the use case spec for current task:

```

cat docs/usecases/<UC-ID>-\*.md

```

Identify:
- The success scenario steps
- The extension scenarios
- The preconditions and guarantees
- Required entities and their relationships

### Phase 3: Test Plan (5-10% of iteration)

Before writing tests, plan them. Write to docs/state/test-plan.md:

- Which E2E tests will exist for this use case
- What setup each needs
- What assertions each makes

This plan informs your TDD cycles.

### Phase 4: TDD Cycles (60-70% of iteration)

For each test in your plan:

1. RED phase:
   - Write the test
   - Run it, confirm it fails
   - Git commit with "red: <UC-ID> <test-name>"

2. GREEN phase:
   - Write minimum production code
   - Run test, confirm it passes
   - Run ALL tests, confirm none broken
   - Git commit with "green: <UC-ID> <description>"

3. REFACTOR phase (only if there is duplication or unclear code):
   - Improve the code
   - Run ALL tests after each change
   - Git commit with "refactor: <UC-ID> <description>"

### Phase 5: Verify (5-10% of iteration)

```

bash scripts/verify-tdd.sh
bash scripts/check-bypass.sh
bash scripts/run-tests.sh

```

If any fails, fix before proceeding.

### Phase 6: Record (5% of iteration)

```

bash scripts/update-state.sh

```

Then add a brief learning to docs/state/learnings.md if you discovered anything
important.

## Tech Stack (do not deviate)

- Language: TypeScript
- Runtime: Node.js 20+
- Test framework: Vitest
- HTTP: Express or Fastify (choose one in first iteration, then stick)
- Database: PostgreSQL via Prisma
- CLI: oclif or commander (choose one, then stick)

See docs/02-tech-stack.md for details.

## Code Style

- Functional > OO when possible
- Pure functions > stateful
- Explicit > implicit
- Names that reveal intent
- No comments explaining what; only why

## Anti-Patterns to Avoid

- God objects
- Manager classes that just delegate
- Premature abstractions
- Test that mocks everything
- Test that asserts implementation details
- "TODO" comments without an actual TODO file entry

## When You Are Stuck

If you have spent more than 3 TDD cycles without progress on a single test:

1. Stop.
2. Write the problem to docs/state/blockers.md with:
   - What you are trying to do
   - What you have tried
   - What is going wrong
3. Move to a different task via scripts/next-task.sh
4. Come back later with fresh context.

## When Tests Are Hard to Write

Hard-to-test code is a design smell. If you cannot easily test something:

- Is the function doing too much? Split it.
- Are dependencies hard-wired? Inject them.
- Is state hidden? Make it explicit.

The test is showing you the design problem. Listen to it.

## Final Note

You are not racing. You are building correctly. Each commit is a tiny, verified
step. The system grows as a series of small, correct moves.

Now go to GOAL.md and follow its instructions.
```

### docs/04-tdd-protocol.md

TDD를 강제하는 구체적 프로토콜.

```markdown
# TDD Protocol (Enforced)

This protocol is enforced by `scripts/verify-tdd.sh`. Violations stop iteration.

## The Cycle
```

                  ┌─────────┐
                  │   RED   │  Write a failing test
                  └────┬────┘
                       ↓
                  ┌─────────┐
                  │  GREEN  │  Make it pass (minimum)
                  └────┬────┘
                       ↓
              ┌─────────────────┐
              │   REFACTOR      │  Clean up (optional but encouraged)
              │   (optional)    │
              └────┬────────────┘
                   ↓
                Repeat

```

## Mandatory Commit Pattern

Each phase ends with a commit. The pattern is enforced:

```

red: <UC-ID> <test description>
green: <UC-ID> <implementation description>
refactor: <UC-ID> <refactoring description>

```

Examples:
- `red: UC-009 fail when title is empty`
- `green: UC-009 reject empty title with 400`
- `refactor: UC-009 extract title validator`

Other commit prefixes allowed:
- `setup:` initial setup, scaffolding
- `docs:`  documentation only
- `chore:` maintenance, dependencies
- `fix:`   fixing a regression in a previous commit (test must exist)

## Validation Rules

`verify-tdd.sh` checks:

1. Every commit message matches the pattern
2. Every `green:` commit is preceded by a `red:` commit (within last 5 commits)
3. Every `green:` commit makes at least one previously-failing test pass
4. No commit reduces test count
5. No commit weakens an assertion (mutation-tested sample)

## Banned Test Patterns

`check-bypass.sh` detects and rejects:

- `expect(true).toBe(true)` and equivalents
- `expect(x).toBe(x)` (tautology)
- Tests with no assertions
- Tests using `.skip` or `.todo` in main branch
- Tests with mocked subject under test
- Tests with hardcoded responses bypassing implementation

## Coverage Requirements

- Each use case: ≥1 E2E test covering main scenario
- Each use case: ≥1 E2E test per extension (3a, 4a, etc.)
- Overall unit test coverage: ≥90% statements, ≥85% branches
- Critical paths (auth, sessions, merges): 100% branch coverage

## Refactor Triggers

Always refactor when:
- A function exceeds 20 lines
- A file exceeds 200 lines
- Duplication exists in 3+ places
- A name does not reveal intent
- A test reveals awkward design

## Self-Dogfooding Test

The final completion test:

```

bash scripts/dogfood-test.sh

```

This script:
1. Starts a fresh vspec instance
2. Imports docs/usecases/*.md as actual use cases
3. Creates a session, makes a change, merges
4. Verifies all data is consistent
5. Verifies Gherkin export produces valid Gherkin

If this passes, the system genuinely works.
```

### scripts/diagnose.sh

에이전트가 매번 호출하는 자가 진단.

```bash
#!/bin/bash
# diagnose.sh — Tell the agent what state the codebase is in.

set -e

echo "=== VSPEC DEVELOPMENT STATE ==="
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

echo "=== Iteration Counter ==="
ITER=$(git log --oneline | wc -l)
echo "Total commits so far: $ITER"
echo ""

echo "=== Last 10 Commits ==="
git log --oneline -10
echo ""

echo "=== Test Status ==="
if [ -f package.json ]; then
  echo "Running tests..."
  if npm test --silent > /tmp/test_output.txt 2>&1; then
    echo "✓ All tests passing"
    grep -E "Tests:|Test Files:" /tmp/test_output.txt || true
  else
    echo "✗ Tests failing"
    echo "First failures:"
    grep -E "FAIL|✗|Error" /tmp/test_output.txt | head -20
  fi
else
  echo "⚠ No package.json yet — need scaffolding"
fi
echo ""

echo "=== Use Case Progress ==="
TOTAL_UC=35
COMPLETED=0
IN_PROGRESS=0
NOT_STARTED=0

for f in docs/usecases/UC-*.md; do
  [ -f "$f" ] || continue
  UC_ID=$(basename "$f" | grep -oE "UC-[0-9]+")
  TEST_FILE="tests/e2e/${UC_ID}.test.ts"
  if [ -f "$TEST_FILE" ]; then
    if grep -q "describe\|test\|it" "$TEST_FILE"; then
      # Test exists, check if passing
      if npx vitest run "$TEST_FILE" --silent > /dev/null 2>&1; then
        COMPLETED=$((COMPLETED+1))
      else
        IN_PROGRESS=$((IN_PROGRESS+1))
      fi
    else
      IN_PROGRESS=$((IN_PROGRESS+1))
    fi
  else
    NOT_STARTED=$((NOT_STARTED+1))
  fi
done

echo "Completed: $COMPLETED / $TOTAL_UC"
echo "In progress: $IN_PROGRESS"
echo "Not started: $NOT_STARTED"
echo ""

echo "=== Current Blockers ==="
if [ -f docs/state/blockers.md ]; then
  cat docs/state/blockers.md
else
  echo "No blockers documented"
fi
echo ""

echo "=== Files Changed Since Last Commit ==="
git status --short
echo ""

echo "=== Recommended Next Action ==="
bash scripts/next-task.sh
```

### scripts/next-task.sh

다음 작업을 추천. 에이전트의 의사결정 부담을 줄임.

```bash
#!/bin/bash
# next-task.sh — Recommend the next concrete task.

# Priority logic:
# 1. If no scaffolding, scaffold first
# 2. If test framework not setup, set it up
# 3. If a use case is in progress (test exists but failing), continue it
# 4. Otherwise, start the next not-started use case in priority order

if [ ! -f package.json ]; then
  echo "TASK: Initialize project scaffolding."
  echo "  - Run: npm init -y"
  echo "  - Install: typescript, vitest, prisma, fastify (or equivalent)"
  echo "  - Read: docs/02-tech-stack.md"
  exit 0
fi

if [ ! -f vitest.config.ts ] && [ ! -f vitest.config.js ]; then
  echo "TASK: Setup test framework."
  echo "  - Configure Vitest"
  echo "  - Write tests/setup.ts"
  echo "  - Verify with a smoke test"
  exit 0
fi

# Look for an in-progress use case (failing tests exist)
for f in docs/usecases/UC-*.md; do
  UC_ID=$(basename "$f" | grep -oE "UC-[0-9]+")
  TEST_FILE="tests/e2e/${UC_ID}.test.ts"
  if [ -f "$TEST_FILE" ]; then
    if ! npx vitest run "$TEST_FILE" --silent > /dev/null 2>&1; then
      echo "TASK: Continue $UC_ID."
      echo "  - Read: $f"
      echo "  - Test file: $TEST_FILE"
      echo "  - Make failing tests pass via Green phase"
      exit 0
    fi
  fi
done

# Pick the next not-started use case
PRIORITY_ORDER=(
  "UC-001" "UC-002" "UC-004"           # Foundation: auth, project
  "UC-005" "UC-006" "UC-007"           # Domain setup: actors, stakeholders, goals
  "UC-008" "UC-009" "UC-010"           # Use case core
  "UC-011" "UC-012" "UC-013"           # Scenarios, extensions, steps
  "UC-016" "UC-017" "UC-018"           # Sessions
  "UC-019" "UC-020" "UC-021"           # Branches and merges
  "UC-022" "UC-023"                     # Locks
  "UC-024" "UC-025" "UC-026" "UC-027"  # Versioning, impact
  "UC-029" "UC-030"                     # Sync, export
  "UC-033" "UC-034" "UC-035"           # AI agent specific
  "UC-014" "UC-015" "UC-028"           # Search, archive, comments
  "UC-003" "UC-031" "UC-032"           # Invites, markdown export, API keys
)

for UC_ID in "${PRIORITY_ORDER[@]}"; do
  TEST_FILE="tests/e2e/${UC_ID}.test.ts"
  if [ ! -f "$TEST_FILE" ]; then
    SPEC_FILE=$(ls docs/usecases/${UC_ID}-*.md 2>/dev/null | head -1)
    echo "TASK: Start $UC_ID."
    echo "  - Read: $SPEC_FILE"
    echo "  - Create: $TEST_FILE"
    echo "  - Begin RED phase: write the first failing test"
    exit 0
  fi
done

echo "TASK: All use cases have tests. Run completion-check.sh."
exit 0
```

### scripts/completion-check.sh

```bash
#!/bin/bash
# completion-check.sh — Are we done?

PASS=true

echo "=== COMPLETION CHECK ==="

# 1. Structural: all UC test files exist
echo "[1/4] Structural check..."
MISSING=0
for f in docs/usecases/UC-*.md; do
  UC_ID=$(basename "$f" | grep -oE "UC-[0-9]+")
  if [ ! -f "tests/e2e/${UC_ID}.test.ts" ]; then
    echo "  ✗ Missing test for $UC_ID"
    MISSING=$((MISSING+1))
    PASS=false
  fi
done
if [ $MISSING -eq 0 ]; then
  echo "  ✓ All 35 UC test files present"
fi

# 2. Functional: all tests pass
echo "[2/4] Functional check..."
if npm test --silent; then
  echo "  ✓ All tests passing"
else
  echo "  ✗ Some tests failing"
  PASS=false
fi

# 3. Integrity: no bypass patterns
echo "[3/4] Integrity check..."
if bash scripts/check-bypass.sh; then
  echo "  ✓ No bypass patterns detected"
else
  echo "  ✗ Bypass patterns detected"
  PASS=false
fi

# 4. Dogfooding: vspec can manage itself
echo "[4/4] Dogfooding check..."
if bash scripts/dogfood-test.sh; then
  echo "  ✓ Self-dogfooding successful"
else
  echo "  ✗ Self-dogfooding failed"
  PASS=false
fi

echo ""
if [ "$PASS" = true ]; then
  echo "🎉 GOAL ACHIEVED. All checks passed."
  exit 0
else
  echo "⚠ Goal not yet achieved. Continue iterating."
  exit 1
fi
```

### docs/state/progress.md (자동 업데이트되는 진척도)

이 파일은 `update-state.sh`가 갱신합니다. 에이전트는 이걸 읽고 다음 작업을 결정합니다.

```markdown
# Progress Matrix

Last updated: <auto>

## Overall

- Iterations: <N>
- Commits: <N>
- Use cases: <X> / 35 complete
- Test coverage: <X>%

## By Use Case

| ID     | Title                   | Status        | Tests | Notes                   |
| ------ | ----------------------- | ------------- | ----- | ----------------------- |
| UC-001 | 워크스페이스에 가입한다 | ✓ DONE        | 7/7   |                         |
| UC-002 | 로그인한다              | ⚙ IN PROGRESS | 3/5   | Stuck on OAuth callback |
| UC-003 | ...                     | ○ NOT STARTED | 0/0   |                         |
| ...    |                         |               |       |                         |

## By Phase

- [✓] Scaffolding
- [✓] Auth foundation
- [⚙] Domain entities
- [○] Session management
- [○] Branch/merge
- [○] Locks
- [○] AI agent interface
```

---

## 4부: 캐싱 최적화 전략 — 구체적 방법

위 구조가 캐싱에 어떻게 도움이 되는지 구체적으로 보겠습니다.

### 캐시 친화적 프롬프트 조립 순서

매 LLM 호출 시 이 순서로 프롬프트를 조립합니다.

```
[System Message] (고정, 캐시됨)
  + AGENTS.md (전체)

[User Message Part 1] (거의 고정)
  + docs/00-overview.md
  + docs/01-architecture.md
  + docs/02-tech-stack.md
  + docs/03-cockburn-method.md
  + docs/04-tdd-protocol.md

[User Message Part 2] (이터레이션마다 같음)
  + docs/05-data-model.md
  + docs/06-api-contract.md
  + docs/07-cli-spec.md
  + docs/08-file-format.md

[User Message Part 3] (현재 작업하는 UC만)
  + docs/usecases/UC-<current>.md

[User Message Part 4] (자주 바뀜)
  + docs/state/progress.md
  + docs/state/next-task.md
  + 최근 git log 10줄
  + 최근 테스트 실행 결과

[User Message Part 5] (현재 요청)
  + "Continue per AGENTS.md. Current task: <next-task>"
```

이렇게 하면 Part 1-2는 거의 항상 캐시 히트, Part 3는 UC 전환 시에만 캐시 미스, Part 4-5만 실제 새 토큰입니다.

**예상 절감**: 정확한 수치는 모델/제공자에 따라 다르지만, 일반적으로 캐시 히트는 미스 대비 비용이 크게 낮습니다 (Anthropic의 경우 약 10%, OpenAI도 비슷한 수준). 이 구조라면 평균 70-80%의 토큰이 캐시 히트가 되어 비용이 큰 폭으로 절감됩니다.

### 컨텍스트 윈도우 관리

긴 작업 중 컨텍스트가 부풀어 오르는 걸 막아야 합니다.

```
이터레이션 종료 시 컨텍스트 리셋:
  - 이전 시도들의 출력 버림
  - 새 이터레이션은 깨끗한 컨텍스트로 시작
  - 단, 상태는 docs/state/*에 영속

이걸 통해:
  - 컨텍스트 윈도우 부족 방지
  - 캐시 효율 최대화 (같은 시작점에서 다시 출발)
  - LLM의 혼란 누적 방지
```

### 변경 빈도에 따른 파일 분리

같은 정보라도 변경 빈도가 다르면 다른 파일에 둬야 합니다. 예를 들어:

❌ 나쁨:

```
docs/everything.md (35개 UC + 진척도 + 다음 작업 모두 포함)
```

이러면 진척도 한 줄 바뀌어도 전체가 캐시 무효화.

✓ 좋음:

```
docs/usecases/UC-001.md         (UC만, 거의 안 바뀜)
docs/state/progress.md          (진척도만, 자주 바뀜)
docs/state/next-task.md         (다음 작업만, 자주 바뀜)
```

---

## 5부: 안전 장치들

자율 시스템의 가장 큰 리스크는 통제 불능입니다. 다음을 미리 깔아둡니다.

### 1. 비용 상한 (Kill Switch)

```bash
# scripts/cost-monitor.sh
# 매 이터레이션 시작 시 호출

TOTAL_TOKENS_USED=$(cat .cost/total.txt 2>/dev/null || echo 0)
LIMIT=10000000  # 1천만 토큰 = 약 $30 (모델에 따라 다름)

if [ $TOTAL_TOKENS_USED -gt $LIMIT ]; then
  echo "⛔ COST LIMIT REACHED ($TOTAL_TOKENS_USED tokens)"
  echo "Manual review required. Stopping."
  exit 1
fi
```

### 2. 회귀 방지

이터레이션이 진척도를 후퇴시키지 못하게:

```bash
# scripts/verify-no-regression.sh
PREV_PASSING=$(cat .state/passing_tests.txt 2>/dev/null || echo 0)
CURRENT_PASSING=$(npm test --silent 2>&1 | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+")

if [ $CURRENT_PASSING -lt $PREV_PASSING ]; then
  echo "⛔ REGRESSION: was $PREV_PASSING, now $CURRENT_PASSING"
  echo "Rolling back to last good commit..."
  git reset --hard HEAD~1
  exit 1
fi

echo $CURRENT_PASSING > .state/passing_tests.txt
```

### 3. 인간 체크포인트

특정 주요 마일스톤에서 강제로 멈추고 인간 확인 요청:

```
이터레이션 진행 중 다음 시점에 정지:
  - 최초 빌드 성공 시
  - 첫 UC E2E 통과 시
  - 데이터 모델이 처음 정의됐을 때
  - 누적 비용이 $10에 도달했을 때

`.state/needs_human_review` 파일을 생성하면
다음 이터레이션이 시작되지 않음
```

### 4. 변경 다양성 모니터링

같은 파일만 계속 수정하면 막혀 있다는 신호:

```bash
# scripts/check-progress-diversity.sh
# 최근 5개 커밋이 모두 같은 파일을 수정하면 경고

RECENT_FILES=$(git diff --name-only HEAD~5 HEAD | sort -u | wc -l)
if [ $RECENT_FILES -lt 2 ]; then
  echo "⚠ Low file diversity. May be stuck. Consider next-task.sh."
fi
```

### 5. 정기 회고

```bash
# 매 N 이터레이션마다 회고를 강제

if [ $((ITER % 10)) -eq 0 ]; then
  echo "📝 Iteration $ITER. Time for retrospective."
  echo "Required: Update docs/state/learnings.md with:"
  echo "  - What worked in last 10 iterations"
  echo "  - What did not work"
  echo "  - What you would change going forward"
fi
```

---

## 6부: 실행 흐름 시뮬레이션

설계한 시스템이 어떻게 작동할지 시뮬레이션해 보겠습니다.

### 이터레이션 1 (스캐폴딩)

```
1. codex goal 시작
2. AGENTS.md 로드 → 캐시
3. GOAL.md 로드 → 캐시
4. bash scripts/diagnose.sh 실행
   → "package.json 없음"
5. bash scripts/next-task.sh
   → "TASK: Initialize scaffolding"
6. 에이전트가 npm init, tsconfig, vitest 설치
7. 첫 스모크 테스트 (`expect(1+1).toBe(2)`) 작성
8. 테스트 통과 확인
9. git commit "setup: initial scaffolding"
10. bash scripts/update-state.sh
11. 이터레이션 종료
```

비용: 비교적 낮음 (Part 1-2 캐시 미스이지만 한 번뿐)

### 이터레이션 2 (UC-001 시작)

```
1. AGENTS.md, GOAL.md → 캐시 히트 ✓
2. docs/00-08 → 캐시 히트 ✓
3. bash scripts/diagnose.sh
   → "UC-001 not started"
4. bash scripts/next-task.sh
   → "TASK: Start UC-001"
5. docs/usecases/UC-001-...md → 캐시 미스 (첫 로드)
6. RED 단계:
   - tests/e2e/UC-001.test.ts 작성
   - 첫 실패 테스트
   - git commit "red: UC-001 fail without email"
7. GREEN 단계:
   - 최소 코드 작성
   - 테스트 통과
   - git commit "green: UC-001 accept signup with valid email"
8. 다음 시나리오... (반복)
9. 이터레이션 종료
```

비용: Part 1-2가 캐시 히트로 매우 저렴. Part 3(UC-001)만 새 토큰.

### 이터레이션 N (막힌 상황)

```
1. diagnose.sh → "UC-020 in progress, 3 cycles failed"
2. AGENTS.md 규칙: 3 사이클 후 막히면 blocker 기록 후 다른 작업
3. 에이전트가 blockers.md에 기록
4. next-task.sh → "UC-021로 이동" 추천
5. UC-021 작업 시작
```

이렇게 무한 루프를 피합니다.

---

## 7부: 솔직한 우려와 권고

이 시스템을 설계하면서 우려되는 점들을 솔직히 말씀드립니다.

### 우려 1: 완전 자율은 아직 어렵다

35개 유스케이스를 **완전 자율로** 완성하는 건 현 시점에 매우 도전적입니다. 특히:

- 데이터 모델 설계의 미묘한 결정들
- 동시성 알고리즘 (브랜치/머지)
- 보안 결정 (인증, 권한)

이 영역은 인간 개입이 필요할 가능성이 높습니다. **체크포인트를 많이 두는 것**이 안전합니다.

### 우려 2: 비용 예측의 불확실성

캐싱을 잘 써도, 35개 UC × 평균 10 이터레이션 × 큰 컨텍스트는 상당한 비용이 됩니다. 정확한 수치는 사용하는 모델과 작업의 복잡도에 따라 크게 달라집니다. **점진적 실행을 권합니다**:

1. 먼저 UC 1-3개로 시스템을 검증
2. 패턴이 잡히면 5-10개씩 확장
3. 비용/품질 메트릭을 매번 점검

### 우려 3: 자가 검증의 한계

에이전트가 자기 코드를 자기가 테스트합니다. **사각지대가 생길 수 있습니다.** 권고:

- 주요 마일스톤에서 인간 코드 리뷰
- 외부 정적 분석 도구 도입 (SonarQube, CodeQL)
- 별도 인간이 작성한 "검증용 시나리오" 준비

### 권고: 점진적 자율성

처음부터 완전 자율이 아니라, **자율성을 점진적으로 늘립니다**.

- **레벨 1** (Day 1-3): 스캐폴딩과 1-2개 UC를 자율 실행. 매일 인간이 결과 검토.
- **레벨 2** (Day 4-7): 5-10개 UC를 자율로. 인간은 주요 결정만 검토.
- **레벨 3** (Day 8+): 나머지를 자율로. 인간은 완료 확인만.

이 단계적 접근이 가장 안전하고 효과적입니다.

---

## 정리

### 만들 파일들 요약

```
필수 (Day 0에 준비):
  GOAL.md
  AGENTS.md
  docs/00-overview.md
  docs/01-architecture.md
  docs/02-tech-stack.md
  docs/03-cockburn-method.md
  docs/04-tdd-protocol.md
  docs/05-data-model.md
  docs/06-api-contract.md
  docs/07-cli-spec.md
  docs/08-file-format.md
  docs/usecases/UC-001 ~ UC-035 (35개)
  scripts/diagnose.sh
  scripts/next-task.sh
  scripts/verify-tdd.sh
  scripts/check-bypass.sh
  scripts/update-state.sh
  scripts/completion-check.sh
  scripts/cost-monitor.sh
  scripts/dogfood-test.sh
  docs/state/progress.md (초기값)
  docs/state/next-task.md (초기값)
  docs/state/blockers.md (빈 파일)
  docs/state/learnings.md (빈 파일)
```

### 핵심 통찰

1. **GOAL.md는 짧게, AGENTS.md는 자세히** — 캐시 효율 차이.
2. **스크립트가 LLM 추론을 대체** — 자가 진단·다음 작업 추천을 스크립트로.
3. **TDD를 git commit 패턴으로 강제** — 사후 검증 가능.
4. **변경 빈도로 파일 분리** — 캐싱 극대화.
5. **무한 루프가 아니라 유한 사이클의 반복** — 막히면 탈출.
6. **점진적 자율성** — 처음부터 100% 자율은 위험.

### 다음 작업 후보

여기서 어디로 갈까요?

**A. GOAL.md와 AGENTS.md를 다듬어 실제 작동 가능한 수준으로 완성**

**B. docs/04-tdd-protocol.md와 scripts/verify-tdd.sh 등 강제 장치들을 상세 설계**

**C. 35개 유스케이스 중 1-3개를 풀스펙으로 작성해서 양식 검증**

**D. 캐싱 성능을 실측할 수 있는 작은 PoC 설계** — 실제로 절감 효과 확인

저는 **C → D → A → B 순서**를 권합니다. 유스케이스가 실제로 어떻게 생겼는지 봐야 다른 모든 것이 구체화됩니다. 어떻게 진행할까요?
