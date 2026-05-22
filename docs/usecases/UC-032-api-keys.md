---
vspec_format: 1
type: usecase
id: UC-032
key: VSPEC-032
title: Issue and manage API keys
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: workspace-admin
---

# Issue and manage API keys

> The credential lifecycle for non-interactive callers. A workspace admin creates an API key with explicit scopes (`read`, `write`), receives the bearer token exactly once at creation, and later lists or revokes keys. Tokens are argon2id-hashed at rest so a database leak cannot reveal them. CI jobs and AI coding agents use these keys to authenticate the CLI and direct REST calls.

## Stakeholders and Interests

- **Workspace Admin**: provisions a scoped credential for a CI job or AI agent and revokes it cleanly when the engagement ends. _(Protected by: steps 3–5 and step 7.)_
- **CI/CD System**: authenticates with a stable bearer token that is narrow in scope (e.g. `read` only) and survives across runs until revoked. _(Protected by: step 4 and Success Guarantee.)_
- **AI Coding Agent**: receives a `write`-scoped key only when explicitly intended, and never receives admin scopes (MVP has no admin scope). _(Protected by: extension 2a.)_
- **Vooster**: never stores a recoverable token — argon2id hash only — so even a full DB exfiltration cannot impersonate a key. _(Protected by: step 5 and Minimal Guarantee.)_

## Preconditions

- The caller is authenticated and holds `OWNER` membership in the workspace (key issuance is admin-only in MVP).
- The workspace exists and is not suspended.
- For revocation, the target key id belongs to the same workspace.

## Trigger

The admin runs `vspec api-key create --name "<text>" --scopes read,write`, `vspec api-key list`, or `vspec api-key revoke <id>`.

## Main Success Scenario

1. **Workspace Admin** invokes the API-key command (`create`, `list`, or `revoke`).
2. **System** validates the caller's `OWNER` role and (for `create`) parses the requested scope set against the allowed set `{read, write}`.
3. **System** for `create`: generates a high-entropy token (`vsp_` + base62) and computes its argon2id hash.
4. **System** for `create`: persists the `ApiKey` row with `name`, `scopes`, `hash`, `created_by`, `created_at`, and `revoked_at=null`; the plaintext token is never written to disk on the server side.
5. **System** for `create`: returns the token to the CLI exactly once with an explicit "this is the only time the token is shown" banner; for `list`, returns metadata only; for `revoke`, sets `revoked_at=now()`.
6. **System** records an audit event (key created / revoked) and emits a `suggested_next_actions` block (e.g. `vspec api-key list` after creation).
7. **Workspace Admin** stores the token in their secret manager or rotates the credential where it was used.

## Extensions

### 2a. The request specifies an unknown or admin-level scope

- 2a1. **System** rejects scopes outside `{read, write}` (MVP does not support `admin`).
- 2a2. **System** returns 422 with the offending scope and the allowed set.
- (Outcome: FAILURE — use case ends; no key is created.)

### 5a. The token is generated but the response is dropped (caller never sees it)

- 5a1. **Workspace Admin** discovers the token was not captured.
- 5a2. **System** has no way to re-display the plaintext token (only the hash is stored).
- 5a3. **Workspace Admin** revokes the unviewable key and re-runs `create`.
- (Outcome: PARTIAL — failure for the original token; re-issuance succeeds via a fresh create call.)

### 5b. Revocation of an already-revoked key

- 5b1. **System** observes `revoked_at` is already non-null.
- 5b2. **System** treats the call as idempotent: returns 200 with the existing `revoked_at`, no new audit event.
- (Outcome: SUCCESS — rejoins main at step 6.)

### 2b. The caller has `EDITOR` (not `OWNER`) membership

- 2b1. **System** returns 403 with `vspec member set-role` as a suggested next action (to be run by an owner).
- (Outcome: FAILURE — use case ends.)

### \*a. The target key id does not belong to the current workspace

- \*a1. **System** returns 404 (does not leak existence across workspaces).
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

For `create`: an `ApiKey` row exists with a `argon2id`-hashed token, the declared scopes, and a non-null `created_at`; the plaintext token was returned to the caller exactly once. For `revoke`: the row's `revoked_at` is set, and any subsequent bearer-token auth using the revoked secret returns 401. For `list`: the response includes all non-deleted keys for the workspace with their metadata but no token material.

## Minimal Guarantee

No plaintext token is ever persisted on the server (DB, logs, or audit trail) at any time. A failed `create` leaves no `ApiKey` row. A failed `revoke` does not corrupt the key's existing `revoked_at` (idempotent re-revocation is a no-op).

## Notes

- API: `POST /v1/api-keys`, `GET /v1/api-keys`, `DELETE /v1/api-keys/:id` (see `docs/06-api-contract.md`).
- CLI: `vspec api-key create | list | revoke` (see `docs/07-cli-spec.md`).
- Auth: tokens are `Authorization: Bearer <token>` per `docs/06-api-contract.md`; sessions are an alternative for human callers.
- Companion: UC-001 (signup), UC-002 (login), UC-003 (invite member — sets the role required for key issuance).
