# Tally API Endpoints Reference

Base URL: `https://api.tally.so`

## Forms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /forms | 폼 목록 조회 (page, limit, workspaceIds) |
| POST | /forms | 폼 생성 (title, status, workspaceId, blocks) |
| GET | /forms/{formId} | 폼 상세 조회 |
| PATCH | /forms/{formId} | 폼 수정 |
| DELETE | /forms/{formId} | 폼 삭제 |

## Questions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /forms/{formId}/questions | 폼 질문 목록 조회 |

## Submissions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /forms/{formId}/submissions | 제출 목록 조회 (page, limit, filter, startDate, endDate) |
| GET | /forms/{formId}/submissions/{submissionId} | 제출 상세 조회 |
| DELETE | /forms/{formId}/submissions/{submissionId} | 제출 삭제 |

## Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /webhooks | 웹훅 목록 조회 |
| POST | /webhooks | 웹훅 생성 |
| PATCH | /webhooks/{webhookId} | 웹훅 수정 |
| DELETE | /webhooks/{webhookId} | 웹훅 삭제 |

## Workspaces

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /workspaces | 워크스페이스 목록 조회 |
| POST | /workspaces | 워크스페이스 생성 |
| GET | /workspaces/{workspaceId} | 워크스페이스 상세 조회 |
| PATCH | /workspaces/{workspaceId} | 워크스페이스 수정 |
| DELETE | /workspaces/{workspaceId} | 워크스페이스 삭제 |

## User

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /me | 현재 인증된 사용자 정보 |

## Form Status Values

- `BLANK` — 빈 폼
- `DRAFT` — 초안
- `PUBLISHED` — 게시됨
- `DELETED` — 삭제됨
