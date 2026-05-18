---
vspec_format: 1
type: usecase
id: UC-022
key: VSPEC-022
title: Lock a use case
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: ai-coding-agent
---

# Lock a use case

> An AI coding agent (or human) is about to make changes whose intermediate states would mislead concurrent readers, or it wants to declare loudly that this use case is being actively worked on. It acquires a `Lock` at one of three levels — `SOFT` (informational), `SEMANTIC` (blocks meaning-changing edits, allows cosmetic ones), `HARD` (blocks all writes). The lock has a default 30-minute TTL, is renewable, and auto-releases when the holding session ends.

## Stakeholders and Interests

- **AI Coding Agent**: declares an exclusive zone for the duration of a tightly-scoped edit and trusts that vspec will reject concurrent conflicting writes. _(Protected by: steps 3 and 4.)_
- **Other Sessions**: get a clear 409 (with the holder's session id) rather than a silent overwrite or a confusing merge conflict downstream. _(Protected by: step 3 and extension 3a.)_
- **Developer / PM**: can see who holds what via `vspec who` / `vspec lock list` and can intervene to release a stale lock. _(Protected by: Success Guarantee.)_
- **Vooster**: locks always have a finite TTL, a typed level, a holding user (and optionally session), and an `auto_release` flag — no eternal locks, no anonymous locks. _(Protected by: step 4 and extension 5a.)_

## Preconditions

- The caller is authenticated and has `EDITOR` or `OWNER` membership in the project.
- The target use case exists and is not archived.
- The caller's current session id is known (via `X-Vspec-Session` or `.vspec/session.json`); if absent, the lock is held by the user without a session.

## Trigger

The agent runs `vspec lock <KEY-NNN> --type soft|semantic|hard [--reason "<text>"] [--ttl <minutes>]` or `vspec lock renew <KEY-NNN>` to extend an existing one.

## Main Success Scenario

1. **AI Coding Agent** invokes `lock` with a target key, a `--type`, a `--reason`, and an optional `--ttl` (default 30 minutes).
2. **System** resolves the target use case id and verifies it exists and is not archived.
3. **System** checks for competing active locks on the same target: a request for `SEMANTIC` fails if any other session holds `SEMANTIC` or `HARD`; a request for `HARD` fails if any other session holds any lock; `SOFT` always succeeds but emits a warning if any other lock exists.
4. **System** creates the `Lock` row with `target_type`, `target_id`, `lock_type`, `held_by_user_id=<caller>`, `held_by_session_id=<current session or null>`, `reason`, `acquired_at=now()`, `expires_at=acquired_at + ttl`, `auto_release=true`.
5. **System** returns the lock with `suggested_next_actions` pointing at `vspec lock renew <KEY>` (before expiry) and `vspec unlock <KEY>`.

## Extensions

### 3a. A competing lock of equal or higher level exists

- 3a1. **System** detects an active `Lock` row on the same target held by a different session at a level that blocks the request (per the matrix in step 3).
- 3a2. **System** returns 409 with the holding session id, the holder's user id, the current lock's `expires_at`, and `vspec who <KEY>` as a suggested next action.
- (Outcome: FAILURE — use case ends; no lock created.)

### 1a. Renewal requested on an already-expired lock

- 1a1. **System** detects `expires_at < now()` on the named lock.
- 1a2. **System** rejects the renewal (an expired lock is functionally released; renewal is not equivalent to reacquisition because another holder may have arrived in the gap).
- 1a3. **System** returns 409 with `vspec lock <KEY> --type ...` as a suggested next action to reacquire.
- (Outcome: FAILURE — use case ends; caller must reacquire from scratch.)

### 1b. Renewal requested on a lock the caller does not own

- 1b1. **System** detects `held_by_user_id != caller.id` and `held_by_session_id != caller.session_id`.
- 1b2. **System** returns 403.
- (Outcome: FAILURE — use case ends.)

### 5a. Caller's session ends (or is abandoned) while the lock is active

- 5a1. **System** during session completion (UC-018) or abandonment finds locks where `held_by_session_id = <session.id>` and `auto_release = true`.
- 5a2. **System** deletes them in the same transaction as the session status flip.
- (Outcome: SUCCESS — the lock cleanly auto-releases without operator intervention.)

### *a. Background TTL sweep finds an expired lock

- *a1. **System** lazily marks the lock as expired on next access (no background job in MVP).
- *a2. **System** treats expired locks as absent when evaluating step 3.
- (Outcome: SUCCESS — expired locks no longer block new acquisitions.)

## Success Guarantee

A `Lock` row exists with the requested `lock_type`, a finite `expires_at`, the caller as `held_by_user_id`, and the caller's current session (if any) as `held_by_session_id`. The lock is visible in `vspec lock list` and `vspec who <KEY>`.

## Minimal Guarantee

On any failure no orphan lock row exists. An expired lock never blocks a fresh acquisition. Locks held by a session are always cleaned up when the session ends.

## Notes

- API: `POST /v1/locks`, `DELETE /v1/locks/:id` (see `docs/06-api-contract.md`).
- CLI: `vspec lock`, `vspec unlock`, `vspec lock renew`, `vspec lock list` (see `docs/07-cli-spec.md`).
- Lock semantics (SOFT/SEMANTIC/HARD): `docs/01-architecture.md` (Locks).
- Auto-release on session end: `docs/05-data-model.md` (Lock entity, `auto_release` field).
- Companion: UC-016's `--auto-branch` mode acquires SEMANTIC locks automatically; UC-018 releases them.
