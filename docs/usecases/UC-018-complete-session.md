---
vspec_format: 1
type: usecase
id: UC-018
key: VSPEC-018
title: Complete a work session
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: ai-coding-agent
---

# Complete a work session

> An AI coding agent has finished the unit of work it started under a `WorkSession`. It tells vspec the session is done: vspec marks it `COMPLETED`, releases all locks the session was holding, and — when the session owned an auto-branch — opens a `MergeRequest` back into `main` with a precomputed impact analysis. The session no longer pins any revisions, so other sessions are free to touch those entities.

## Stakeholders and Interests

- **AI Coding Agent**: declares "I am done" in one call and reliably hands its work over to the merge pipeline without leaking locks. _(Protected by: steps 4 and 5.)_
- **Developer / PM**: receives an open MR with attached impact whenever an agent finishes work on a branch — no agent work disappears silently. _(Protected by: step 6.)_
- **Other Active Sessions**: get the locks back so their own pins on the same entities become writable, with no manual cleanup. _(Protected by: step 4 and Minimal Guarantee.)_
- **Vooster**: no session ever stays in `ACTIVE` after its agent has signaled completion; impact is always computed at close time, not at merge time, so the user sees consequences before approving. _(Protected by: step 6 and Success Guarantee.)_

## Preconditions

- The caller is authenticated and is either the session's owner or a workspace `OWNER`.
- The session referenced exists and is in `status=ACTIVE`.
- If the session has an attached branch, the branch is in `status=ACTIVE`.

## Trigger

The agent runs `vspec session complete [--summary "<text>"] [--no-merge]`.

## Main Success Scenario

1. **AI Coding Agent** invokes `session complete` (current session inferred from `.vspec/session.json`).
2. **System** loads the session and verifies caller authorization and `status=ACTIVE`.
3. **System** marks the session `status=COMPLETED` and stamps `ended_at=now()`.
4. **System** releases every `Lock` where `held_by_session_id = <session.id>` and `auto_release = true`.
5. **System** computes the change impact for the session's branch (if any) versus `main`: affected sessions, affected branches, severity per touched entity.
6. **System** when the session owned a branch and `--no-merge` was not passed, opens a `MergeRequest` (`source_branch_id=<session.branch_id>`, `target_branch_id=<main.id>`, `strategy=FAST_FORWARD` if possible else `SQUASH`, `status=OPEN`, attached impact, attached conflicts array).
7. **System** clears the local `.vspec/session.json` and returns the session, the released lock ids, and (when applicable) the new MR id with `suggested_next_actions` pointing at `vspec merge show <id>`.

## Extensions

### 4a. One or more locks fail to release (e.g. row already deleted by TTL expiry)

- 4a1. **System** logs the per-lock failure with the lock id.
- 4a2. **System** continues releasing remaining locks; a partial release does not abort completion.
- 4a3. **System** includes a `warnings` entry per failed release in the response.
- (Outcome: PARTIAL — rejoins main at step 5; session is still marked COMPLETED.)

### 6a. Branch has structural or semantic conflicts versus `main`

- 6a1. **System** opens the MR with `status=OPEN` and `conflicts=[...]` populated.
- 6a2. **System** does not auto-merge even if `--strategy=fast-forward` would otherwise apply.
- 6a3. **System** returns the MR with `suggested_next_actions` pointing at `vspec merge resolve <id>`.
- (Outcome: PARTIAL — rejoins main at step 7; merge is deferred to UC-021.)

### 6b. `--no-merge` was passed

- 6b1. **System** skips MR creation entirely and leaves the branch in `status=ACTIVE`.
- 6b2. **System** returns the session with `suggested_next_actions` pointing at `vspec merge open <branch>` for later.
- (Outcome: PARTIAL — rejoins main at step 7.)

### 2a. Session is already COMPLETED or ABANDONED

- 2a1. **System** detects `status != ACTIVE` and returns 409 with the current status.
- 2a2. **System** suggests `vspec session show <id>` as the next action.
- (Outcome: FAILURE — use case ends; no state change.)

### \*a. Transactional failure mid-completion

- \*a1. **System** ensures the session status flip and lock releases happen in one transaction; if it aborts, the session stays ACTIVE and no locks are released.
- \*a2. **System** returns exit code 5 with a retry hint.
- (Outcome: FAILURE — use case ends; no partial state.)

## Success Guarantee

The session row has `status=COMPLETED` and `ended_at` set. Every `Lock` with `auto_release=true` previously held by the session is gone (or logged as already-gone). When the session owned a branch and `--no-merge` was not passed, exactly one `MergeRequest` exists for that branch with `status=OPEN`, a populated `impact`, and a populated (possibly empty) `conflicts` array. The local `.vspec/session.json` no longer references the completed session id.

## Minimal Guarantee

On failure the session either stays fully `ACTIVE` with its locks intact, or transitions cleanly to `COMPLETED` with locks released — never a mixed state where some locks remain and the session is closed. No half-formed MergeRequest is left behind.

## Notes

- API: `POST /v1/sessions/:id/complete` (see `docs/06-api-contract.md`).
- CLI: `vspec session complete` (see `docs/07-cli-spec.md`).
- Impact analysis rules: severity table in `docs/05-data-model.md`.
- Companion: UC-016 opens the session, UC-020 performs the actual merge once the MR is reviewed.
