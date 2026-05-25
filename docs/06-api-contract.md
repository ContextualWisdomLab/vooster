# 06 — API Contract

REST over HTTPS. JSON request/response. All routes prefixed with `/v1`.

> **MVP implementation status.** Headings marked **🔵 Planned** are part of the target design but are **not yet implemented** in the 5/30 MVP. Unmarked endpoints are implemented (some request/response shapes may still differ from this contract — verify against code). Full audit: `docs/findings/2026-05-24T1100-spec-impl-audit.md`.

## Conventions

- Auth via `Authorization: Bearer <api-key>` **or** session cookie.
- Optional session context via `X-Vspec-Session: <session-id>`.
- Optional agent context via `X-Vspec-Agent: <agent-type>:<identifier>`.
- All write endpoints require `base_revision` for optimistic concurrency.
- All list endpoints support `?cursor=&limit=` (cursor pagination).
- All responses include `X-Vspec-Request-Id`.
- Errors follow RFC 7807 _Problem Details_:

```json
{
  "type": "https://vspec.dev/errors/conflict",
  "title": "Optimistic concurrency conflict",
  "status": 409,
  "detail": "Use case PAY-001 has been modified since base_revision rev_abc.",
  "instance": "/v1/usecases/PAY-001",
  "current_revision": "rev_xyz",
  "impact": { ... },
  "suggested_next_actions": [
    { "command": "vspec usecase show PAY-001", "reason": "Inspect current state." }
  ]
}
```

`suggested_next_actions` is included on **every** 4xx response.

---

## Auth

### `POST /v1/auth/github/start`

Returns a redirect URL to GitHub. State token cookie set.

### `GET /v1/auth/github/callback?code=...&state=...`

Completes OAuth. Sets session cookie. Returns the `User`.

### `POST /v1/auth/logout`

Clears session.

### `POST /v1/api-keys`

```json
Request:  { "name": "ci pipeline", "scopes": ["read", "write"] }
Response: { "id": "...", "name": "...", "token": "vsp_..." }  // shown ONCE
```

### `GET /v1/api-keys`

Lists keys (without tokens).

### `DELETE /v1/api-keys/:id`

Revokes.

---

## Workspaces, Projects, Memberships

### `POST /v1/workspaces` 🔵 Planned

```json
Request:  { "name": "...", "slug": "..." }
Response: Workspace
```

### `GET /v1/workspaces` 🔵 Planned

### `GET /v1/workspaces/:id` 🔵 Planned

### `PATCH /v1/workspaces/:id` 🔵 Planned

### `POST /v1/workspaces/:id/invitations`

```json
Request:  { "email": "...", "role": "EDITOR" }
Response: Invitation
```

### `POST /v1/workspaces/:id/projects`

### `GET /v1/workspaces/:id/projects`

### `GET /v1/projects/:id` 🔵 Planned

### `PATCH /v1/projects/:id`

---

## Actors

### `POST /v1/projects/:projectId/actors`

```json
Request:  { "name": "Customer", "type": "PRIMARY", "is_human": true }
```

### `GET /v1/projects/:projectId/actors`

### `GET /v1/actors/:id`

### `PATCH /v1/actors/:id` — body must include `base_revision`.

### `DELETE /v1/actors/:id` — soft delete (`archived_at`).

---

## Stakeholders

Mirror of Actors:

### `POST /v1/projects/:projectId/stakeholders`

### `GET /v1/projects/:projectId/stakeholders`

### `PATCH /v1/stakeholders/:id`

### `DELETE /v1/stakeholders/:id`

---

## Goals

### `POST /v1/projects/:projectId/goals`

```json
Request: { "actor_id": "...", "description": "...", "level": "USER_GOAL", "priority": "P0" }
```

### `GET /v1/projects/:projectId/goals?actor_id=&status=&level=`

### `PATCH /v1/goals/:id`

### `POST /v1/goals/:id/promote`

Creates a `UseCase` seeded from the goal. Returns the new `UseCase`.

---

## Use Cases

### `POST /v1/projects/:projectId/usecases`

```json
Request: {
  "title": "Submit an order",
  "primary_actor_id": "...",
  "level": "USER_GOAL",
  "scope": "checkout-system",
  "trigger": "Customer reaches the checkout page.",
  "preconditions": ["Cart is non-empty.", "Customer is authenticated."],
  "success_guarantee": "Order is recorded; payment captured.",
  "minimal_guarantee": "No partial order is persisted.",
  "format": "FULLY_DRESSED",
  "priority": "P0"
}
```

Response: `UseCase` with a freshly-allocated `key` (e.g. `PAY-001`).

### `GET /v1/projects/:projectId/usecases?status=&level=&actor_id=&q=&cursor=&limit=`

`q` is full-text on `title` and `trigger`.

Each item includes project-overview summary counts:

```json
{
  "items": [
    {
      "key": "PAY-001",
      "title": "Submit an order",
      "level": "USER_GOAL",
      "status": "DRAFT",
      "primary_actor": "Customer",
      "scenario_count": 2,
      "extension_count": 1,
      "trigger_excerpt": ""
    }
  ],
  "next_cursor": null
}
```

### `GET /v1/usecases/:id?revision=&session=&format=`

`format` ∈ `human` | `json` | `agent`.

### `PATCH /v1/usecases/:id`

Body must include `base_revision`.

### `DELETE /v1/usecases/:id`

Soft delete.

### `POST /v1/usecases/:id/stakeholder-interests`

```json
Request: { "stakeholder_id": "...", "interest": "...", "protection_mechanism": "..." }
```

### `DELETE /v1/usecases/:id/stakeholder-interests/:siId`

---

## Scenarios & Steps

### `POST /v1/usecases/:id/scenarios`

```json
Request: { "type": "EXTENSION", "extension_point": "3a", "parent_step_number": 3, "condition": "Card is declined", "outcome": "FAILURE" }
```

### `GET /v1/usecases/:id/scenarios` 🔵 Planned

### `PATCH /v1/scenarios/:id` 🔵 Planned

### `DELETE /v1/scenarios/:id` // main success scenario cannot be deleted 🔵 Planned

### `POST /v1/scenarios/:id/steps`

```json
Request: { "step_number": 1, "actor_id": "...", "action": "submits the order", "is_system_step": false }
```

### `PATCH /v1/steps/:id`

### `DELETE /v1/steps/:id` 🔵 Planned

---

## Revisions

### `GET /v1/usecases/:id/revisions?branch=&cursor=&limit=`

### `GET /v1/revisions/:id` 🔵 Planned

### `POST /v1/usecases/:id/revert`

```json
Request: { "revision_id": "..." }
```

Creates a new revision restoring the snapshot.

### `GET /v1/usecases/:id/diff?from=&to=`

Returns a structured diff (entity-aware, not text).

---

## Sessions

### `POST /v1/sessions`

```json
Request: {
  "project_id": "...",
  "intent": "Implement refund flow.",
  "agent_type": "CODEX",
  "agent_identifier": "codex-build-2026-05-18-1430",
  "pin_usecase_keys": ["PAY-001", "REF-002"],
  "auto_branch": true
}
```

Response: `WorkSession` with pinned revisions resolved.

### `GET /v1/sessions?status=&user_id=&project_id=`

### `GET /v1/sessions/:id` 🔵 Planned

### `POST /v1/sessions/:id/complete`

```json
Request: { "summary": "...", "merge": true }
```

### `POST /v1/sessions/:id/abandon` 🔵 Planned

### `POST /v1/sessions/:id/pin` 🔵 Planned

```json
Request: { "usecase_key": "AUTH-003" }
```

---

## Branches & Merges

### `POST /v1/projects/:projectId/branches`

```json
Request: { "name": "feature/3ds", "from": "main", "owner_type": "HUMAN" }
```

### `GET /v1/projects/:projectId/branches?status=` 🔵 Planned

### `GET /v1/branches/:id` 🔵 Planned

### `POST /v1/branches/:id/preview-merge` 🔵 Planned

```json
Request: { "target": "main" }
Response: { "strategy": "SQUASH", "conflicts": [...], "impact": {...} }
```

### `POST /v1/merges`

```json
Request: { "source_branch_id": "...", "target_branch_id": "...", "strategy": "SQUASH" }
```

### `POST /v1/merges/:id/resolve`

```json
Request: { "resolutions": [{ "entity_id": "...", "strategy": "MINE" | "THEIRS" | "MANUAL", "value"?: {...} }] }
```

### `POST /v1/merges/:id/approve` 🔵 Planned

### `POST /v1/merges/:id/abort` 🔵 Planned

---

## Locks

### `POST /v1/locks`

```json
Request: { "target_type": "USECASE", "target_id": "...", "lock_type": "SEMANTIC", "reason": "...", "ttl_minutes": 30 }
```

### `GET /v1/locks?target_type=&target_id=` 🔵 Planned

### `DELETE /v1/locks/:id`

Releases an owned active lock and returns the released lock.

### `GET /v1/usecases/:id/who`

Returns active sessions and locks for the use case.

---

## Impact Analysis

### `POST /v1/changes/preview`

```json
Request: {
  "entity_type": "USECASE",
  "entity_id": "...",
  "base_revision": "rev_abc",
  "changes": { "fields": { ... }, "scenarios": { ... } }
}
Response: { "preview_id": "...", "severity": "BREAKING", "impact": {...}, "expires_at": "..." }
```

### `POST /v1/changes/commit`

```json
Request: { "preview_id": "...", "confirmed": true }
```

---

## Exports

### `POST /v1/usecases/:id/export/gherkin?format=feature`

Returns `text/plain` Gherkin.

### `POST /v1/usecases/:id/export/markdown`

Returns `text/markdown` in the format described by `docs/08-file-format.md`.

---

## Comments

### `POST /v1/usecases/:id/comments`

### `GET /v1/usecases/:id/comments`

### `PATCH /v1/comments/:id` // edit / resolve

### `DELETE /v1/comments/:id`

---

## Sync (file ↔ server)

These power `vspec pull` / `vspec push`.

### `POST /v1/projects/:projectId/sync/pull`

```json
Request: { "branch": "main", "since": "rev_xyz" }
Response: { "files": [{ "path": "specs/PAY-001.md", "content": "...", "revision": "rev_..." }], "cursor": "..." }
```

### `POST /v1/projects/:projectId/sync/push`

```json
Request: {
  "branch": "main",
  "files": [{ "path": "specs/PAY-001.md", "content": "...", "base_revision": "rev_xyz" }]
}
Response: { "results": [{ "path": "...", "status": "OK" | "CONFLICT", "current_revision": "...", "impact": {...} }] }
```

---

## Status Codes

| Code | Use                                              |
| ---- | ------------------------------------------------ |
| 200  | OK                                               |
| 201  | Created                                          |
| 204  | No content (delete success)                      |
| 400  | Validation error (Zod)                           |
| 401  | Missing/invalid auth                             |
| 403  | Authenticated but not authorized                 |
| 404  | Not found                                        |
| 409  | Optimistic concurrency / lock conflict           |
| 422  | Domain rule violation (e.g. missing stakeholder) |
| 429  | Rate limited                                     |
| 500  | Server error                                     |

---

## Pagination

```
GET /v1/projects/:id/usecases?cursor=eyJpZCI6Ii4uIn0&limit=50

Response includes:
  "items": [...],
  "next_cursor": "..." | null
```

`cursor` is opaque base64-encoded JSON. Default `limit` = 50, max 200.

---

## OpenAPI 🔵 Planned

`/v1/openapi.json` returns the generated OpenAPI 3.1 document. The Fastify
plugin `@fastify/swagger` produces it from Zod schemas via `zod-to-json-schema`.
