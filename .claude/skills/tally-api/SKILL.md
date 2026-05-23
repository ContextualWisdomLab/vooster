---
name: tally-api
description: Tally API를 사용하여 폼 생성, 폼 목록 조회, 폼 상세 조회, 제출(응답) 데이터 조회, 질문 목록 조회 등을 수행하는 skill. "tally 폼 만들어줘", "폼 목록 보여줘", "설문 응답 조회", "tally form create", "tally submissions", "폼 제출 데이터", "설문 결과" 등 Tally 폼 관련 모든 요청에 이 skill을 사용한다.
---

# Tally API — 폼 생성 및 데이터 조회

Tally API를 사용하여 폼 생성, 조회, 제출 데이터 관리 등을 수행한다.

## 디렉토리 구조

```
tally-api/
├── SKILL.md
├── scripts/
│   ├── api_client.py         # 공통 HTTP 클라이언트
│   ├── setup_token.py        # API Key 저장 및 검증
│   ├── list_forms.py         # 폼 목록 조회
│   ├── get_form.py           # 폼 상세 조회
│   ├── create_form.py        # 폼 생성
│   ├── list_submissions.py   # 제출 데이터 목록 조회
│   ├── get_submission.py     # 개별 제출 상세 조회
│   ├── list_questions.py     # 폼 질문 목록 조회
│   └── submit_response.py    # 폼 응답 제출 (⚠️ 명시적 요청 시에만)
├── data/
│   └── token.txt             # API Key (자동 생성)
└── references/
    └── api-endpoints.md      # API 엔드포인트 레퍼런스
```

모든 스크립트는 `<skill-directory>/scripts/` 경로에 있다.

## 플로우

### 1. API Key 확인

`data/token.txt` 파일을 읽어 API Key가 있는지 확인한다. 파일이 없거나 비어있으면 **API Key 발급 안내**를 진행한다.

#### API Key 발급 안내 (Key가 없을 때)

사용자에게 아래 내용을 안내하고, API Key 입력을 기다린다:

> **Tally API Key 발급 가이드**
>
> 1. [Tally](https://tally.so) 로그인
> 2. 우측 상단 프로필 아이콘 클릭 → **Settings** 선택
> 3. 좌측 메뉴에서 **API keys** 클릭
> 4. **Create API key** 클릭
> 5. 생성된 API Key 복사 (한 번만 표시되므로 바로 복사할 것)
>
> 준비되면 API Key를 알려주세요.

사용자가 API Key를 제공하면 저장 및 검증:

```bash
python3 <skill-dir>/scripts/setup_token.py --token "<API_KEY>"
```

### 2. 폼 목록 조회

```bash
python3 <skill-dir>/scripts/list_forms.py [--page 1] [--limit 50] [--workspace-id "<ID>"]
```

- `--page`: 페이지 번호 (기본값: 1)
- `--limit`: 페이지당 개수 (기본값: 50, 최대: 500)
- `--workspace-id`: 특정 워크스페이스의 폼만 조회

### 3. 폼 상세 조회

```bash
python3 <skill-dir>/scripts/get_form.py --form-id "<FORM_ID>"
```

폼의 모든 블록, 설정, 상태 정보를 반환한다.

### 4. 폼 생성

```bash
python3 <skill-dir>/scripts/create_form.py --title "<제목>" [--workspace-id "<ID>"] [--status DRAFT|PUBLISHED] [--blocks-json "<파일경로>"] [--fields-json "<파일경로>"]
```

- `--title`: 폼 제목 (필수)
- `--workspace-id`: 소속 워크스페이스
- `--status`: DRAFT (기본값) 또는 PUBLISHED
- `--blocks-json`: Tally 원본 블록 형식 JSON 파일 경로
- `--fields-json`: 간단한 필드 정의 JSON 파일 경로. 예: `[{"type":"INPUT_TEXT","title":"이름"}]`
- 둘 다 생략하면 제목만 있는 빈 폼이 생성된다

#### 폼 제작 규칙

폼을 생성할 때 아래 규칙을 따른다.

**블록 구조:**

- **핵심 규칙: DROPDOWN_OPTION/CHECKBOX를 제외한 모든 블록은 `groupUuid == uuid`, `groupType == type`으로 설정한다.** 예: DIVIDER 블록은 `groupType: "DIVIDER"`, TEXT 블록은 `groupType: "TEXT"`, HEADING_3은 `groupType: "HEADING_3"`, INPUT_TEXT는 `groupType: "INPUT_TEXT"`.
- 텍스트 입력 질문은 **TITLE + INPUT 쌍**으로 구성한다. TITLE 블록이 질문 라벨이고, 그 아래 INPUT 블록이 실제 입력 필드다.
- **DROPDOWN/CHECKBOXES 질문은 부모 블록이 없다.** TITLE 블록 뒤에 `DROPDOWN_OPTION` 또는 `CHECKBOX` 자식 블록들만 배치한다. 자식 블록들은 동일한 `groupUuid`를 공유하며, 각각 `index`, `text`, `isFirst`, `isLast` 필드가 필수다.

**TITLE 블록 gotchas:**

- TITLE 블록의 `payload`에는 `safeHTMLSchema`만 넣는다. `description`, `isRequired` 등 다른 필드를 넣으면 API가 거부한다.
- `safeHTMLSchema`에는 **라벨 텍스트 하나만** 넣는다: `[["질문 제목"]]`. 여러 원소를 넣으면(`[["제목"], ["설명"]]`) Tally가 전부 한 줄로 이어 붙여서 라벨로 렌더링한다.
- 질문에 부연 설명(description, 예시, 안내문)을 추가하려면 **TITLE 블록과 INPUT 블록 사이에 별도 TEXT 블록**을 삽입한다:
  ```
  TITLE    → safeHTMLSchema: [["질문 제목"]]
  TEXT     → safeHTMLSchema: [["부연 설명 텍스트"]]   ← 별도 블록
  TEXTAREA → payload: { isRequired: true }
  ```
- `isRequired`는 INPUT/TEXTAREA 등 입력 블록의 payload에만 넣는다.
- `FORM_TITLE` 블록의 `groupType`은 `"TEXT"`여야 한다 (`"FORM_TITLE"`이 아님). payload에 `title` 필드도 필요하다.

**DROPDOWN 예시:**

```json
[
  {
    "uuid": "<uuid>", "type": "TITLE",
    "groupUuid": "<title-group>", "groupType": "QUESTION",
    "payload": {"safeHTMLSchema": [["좋아하는 색상"]]}
  },
  {
    "uuid": "<uuid>", "type": "DROPDOWN_OPTION",
    "groupUuid": "<shared-group>", "groupType": "DROPDOWN",
    "payload": {"index": 0, "text": "빨강", "isFirst": true, "isLast": false}
  },
  {
    "uuid": "<uuid>", "type": "DROPDOWN_OPTION",
    "groupUuid": "<shared-group>", "groupType": "DROPDOWN",
    "payload": {"index": 1, "text": "파랑", "isFirst": false, "isLast": true}
  }
]
```

**CHECKBOXES 예시 (복수선택):**

```json
[
  {
    "uuid": "<uuid>", "type": "TITLE",
    "groupUuid": "<title-group>", "groupType": "QUESTION",
    "payload": {"safeHTMLSchema": [["사용 도구 (복수선택)"]]}
  },
  {
    "uuid": "<uuid>", "type": "CHECKBOX",
    "groupUuid": "<shared-group>", "groupType": "CHECKBOXES",
    "payload": {"index": 0, "text": "Claude Code", "isFirst": true, "isLast": false}
  },
  {
    "uuid": "<uuid>", "type": "CHECKBOX",
    "groupUuid": "<shared-group>", "groupType": "CHECKBOXES",
    "payload": {"index": 1, "text": "Cursor", "isFirst": false, "isLast": true}
  }
]
```

**레이아웃:**

- **상단**: `FORM_TITLE` → `DIVIDER` → 로고/이미지 → 소개 텍스트 (맥락 설명)
- **중단**: 섹션별 `HEADING_3`으로 구분, `TEXT` 블록으로 상세 설명
- **하단**: `DIVIDER`로 구분 후 질문 블록 배치 → 마무리 안내 텍스트
- 섹션 전환 시 빈 `TEXT` 블록(`safeHTMLSchema: []`)을 여백으로 활용

**질문 설계:**

- **기본 정보 → 연락처 → 심화 질문** 순서로 배치한다 (성함 → 회사 → 직급 → 연락처 → 서술형)
- 기본 정보와 연락처 사이, 연락처와 서술형 사이에 `DIVIDER`로 구분한다
- 필수 질문은 `isRequired: true`, 선택 질문은 제목에 "(선택)" 명시 + `isRequired: false`
- 짧은 답변은 `INPUT_TEXT`, 긴 답변은 `TEXTAREA` 사용
- 연락처 수집 시 적절한 타입 사용: `INPUT_EMAIL`, `INPUT_PHONE_NUMBER`

**콘텐츠 원칙:**

- 폼 상단에 모임/서비스의 맥락을 충분히 설명하여, 응답자가 "왜 이 폼을 작성하는지" 이해한 상태로 입력하게 한다
- 개인정보 수집 시 활용 목적과 파기 시점을 명시한다
- 마지막에 감사 메시지를 넣는다

### 5. 폼 질문 목록 조회

```bash
python3 <skill-dir>/scripts/list_questions.py --form-id "<FORM_ID>"
```

폼에 포함된 모든 질문을 조회한다. 제출 데이터의 필드 매핑을 확인할 때 유용하다.

### 6. 제출(응답) 데이터 조회

#### 목록 조회

```bash
python3 <skill-dir>/scripts/list_submissions.py --form-id "<FORM_ID>" [--page 1] [--limit 50] [--filter all|completed|partial] [--start-date "2024-01-01T00:00:00Z"] [--end-date "2024-12-31T23:59:59Z"]
```

- `--filter`: all (기본값), completed, partial
- `--start-date` / `--end-date`: ISO 8601 형식 날짜 필터

#### 개별 상세 조회

```bash
python3 <skill-dir>/scripts/get_submission.py --form-id "<FORM_ID>" --submission-id "<SUBMISSION_ID>"
```

### 7. 폼 응답 제출

> **⚠️ 주의: 사용자가 명시적으로 "폼에 데이터를 제출해줘", "응답을 넣어줘" 등 제출을 요청한 경우에만 사용한다. 폼 조회, 데이터 분석 등 다른 작업 중에 절대로 자동 제출하지 않는다.**

공개 폼에 응답을 제출한다. API Key 없이 동작한다.

```bash
python3 <skill-dir>/scripts/submit_response.py --form-id "<FORM_ID>" --responses-json "<파일경로>"
```

- `--form-id`: 대상 폼 ID (필수)
- `--responses-json`: 응답 데이터 JSON 파일 경로 (필수). `{fieldUuid: value}` 형식

**필드 UUID 확인 방법:**
1. `get_form.py`로 폼 블록 구조를 조회한다
2. INPUT 계열 블록의 `uuid`가 필드 키, DROPDOWN/CHECKBOX는 `groupUuid`가 키이고 값은 옵션 `uuid` 배열

**응답 JSON 예시:**
```json
{
  "input-uuid-1": "홍길동",
  "input-email-uuid": "hong@example.com",
  "dropdown-group-uuid": ["selected-option-uuid"],
  "textarea-uuid": "긴 텍스트 답변"
}
```

### 8. 결과 해석

제출 데이터의 `fields` 배열은 질문 ID 기반이다. 사람이 읽을 수 있도록 표시하려면:

1. 먼저 `list_questions.py`로 질문 목록을 가져온다
2. 질문 ID와 라벨을 매핑하여 응답 데이터를 보기 좋게 정리한다

## Invariants

- **폼 응답 제출(`submit_response.py`)은 사용자가 명시적으로 요청한 경우에만 실행한다. 조회/분석 등 다른 작업 중 절대 자동 실행하지 않는다.**
- API Key는 `data/token.txt`에 저장하며 절대 커밋하지 않는다
- TITLE 블록의 `payload`에는 `safeHTMLSchema`만 넣는다 — `description`, `isRequired` 등을 포함하면 API가 거부한다
- DROPDOWN/CHECKBOX 옵션 블록들은 부모 블록 없이, 동일한 `groupUuid`를 공유하는 자식 블록으로 배치한다
- `isRequired`는 INPUT/TEXTAREA 등 입력 블록에만 설정한다 — TITLE 블록에 넣지 않는다
- Rate limit: **분당 100회** — 대량 조회 시 페이지네이션을 활용한다

## 주의사항

- `data/` 디렉토리에는 API Key가 저장되므로 커밋하지 않는다.
- Tally API Rate Limit: **분당 100회**. 대량 조회 시 페이지네이션을 활용한다.
- API Key는 생성한 사용자의 권한을 상속받는다.
