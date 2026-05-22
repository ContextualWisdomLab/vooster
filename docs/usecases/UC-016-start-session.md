---
vspec_format: 1
type: usecase
id: UC-016
key: VSPEC-016
title: Start a work session
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: ai-coding-agent
---

# Start a work session

> An AI coding agent (or its human operator) is about to begin a unit of work that may touch one or more use cases. To prevent the spec from shifting underneath the agent mid-task, it opens a `WorkSession` that pins the current head revision of every relevant use case. Optionally it asks vspec to allocate an isolated `SpecBranch` and to acquire SEMANTIC locks on the pinned entities so concurrent agents cannot break its in-flight contract.

## Stakeholders and Interests

- **AI Coding Agent**: obtains an immutable spec snapshot for every entity it cares about so its tests and code remain valid for the duration of the session. _(Protected by: step 4 and Success Guarantee.)_
- **Developer / PM**: can later inspect which agent is doing what, against which revisions, on which branch, via `vspec session list` / `vspec who`. _(Protected by: step 6.)_
- **Other Active Sessions**: are warned (not blocked) about overlapping intent, and are protected against silent semantic clobbering when `--auto-branch` is used. _(Protected by: step 5 and extension 4a.)_
- **Vooster**: every active session has a typed agent identity (`agent_type`), a stable owner, and a 1:1 mapping to its locks and branch — no anonymous or orphan sessions. _(Protected by: step 2 and Minimal Guarantee.)_

## Preconditions

- The caller is authenticated and has `EDITOR` or `OWNER` membership in the workspace owning the target project.
- A current project is selected (via `vspec project switch` or `--project`).
- The use case keys passed to `--pin` (if any) exist and are not archived in the current project.

## Trigger

The agent runs `vspec session start --intent "<text>" [--pin <KEY,KEY,...>] [--auto-branch] [--agent-type cursor|claude-code|windsurf|codex|other]`.

## Main Success Scenario

1. **AI Coding Agent** invokes `session start` with an intent, an optional pin list, an optional `--auto-branch` flag, and an `--agent-type`.
2. **System** validates membership, resolves the `agent_type` (defaulting to `OTHER` when unrecognized), and reads the agent identifier from `X-Vspec-Agent` or the CLI flag.
3. **System** resolves each `--pin` key to its current head revision on the project's default branch (`main`) and assembles the `pinned_revisions` map.
4. **System** creates a `WorkSession` row with `status=ACTIVE`, `started_at=now()`, and the resolved `pinned_revisions`.
5. **System** writes the session id to `.vspec/session.json` so subsequent CLI calls inherit it.
6. **System** returns the new session, the resolved revision ids, and `suggested_next_actions` pointing at `vspec usecase show <KEY> --session <id>` and `vspec session complete`.

## Extensions

### 3a. A requested pin target is archived

- 3a1. **System** detects `archived_at` is non-null on the resolved use case.
- 3a2. **System** aborts before any row is written and returns 422 with the offending key and `vspec usecase restore <KEY>` as a suggested next action.
- (Outcome: FAILURE — use case ends; no session is created.)

### 3b. A requested pin target is HARD-locked by another session

- 3b1. **System** loads the active `Lock` rows for the target use case.
- 3b2. **System** detects a `HARD` lock held by a different session and refuses the pin to avoid an immediately-stale snapshot.
- 3b3. **System** returns 409 listing the holding session and `vspec who <KEY>` as a suggested next action.
- (Outcome: FAILURE — use case ends; no session is created.)

### 4a. `--auto-branch` requested and branch name collides

- 4a1. **System** computes the candidate branch name `session/<intent-slug>-<timestamp>`.
- 4a2. **System** finds an existing `SpecBranch` with the same name (sub-second collision on a busy workspace).
- 4a3. **System** appends a short random suffix to the timestamp and retries up to three times.
- 4a4. **System** continues into step 5 with the de-collided name; otherwise returns 409.
- (Outcome: PARTIAL — rejoins main at step 5.)

### 4b. `--auto-branch` requested and SEMANTIC lock acquisition fails on one pin

- 4b1. **System** has created the branch and started acquiring SEMANTIC locks on each pinned use case.
- 4b2. **System** detects a competing HARD or SEMANTIC lock on one target.
- 4b3. **System** rolls back the branch, releases any locks already acquired in this call, and returns 409 with the conflicting session id.
- (Outcome: FAILURE — use case ends; no branch, locks, or session persist.)

### 2a. `--agent-type` value is unrecognized

- 2a1. **System** stores `agent_type=OTHER` and records the raw label in `agent_identifier`.
- 2a2. **System** emits a warning in the response and continues.
- (Outcome: PARTIAL — rejoins main at step 3.)

### \*a. Transactional write fails mid-creation

- \*a1. **System** aborts before persisting any of `WorkSession`, `SpecBranch`, or `Lock` rows (single DB transaction).
- \*a2. **System** returns exit code 5 with a retry hint.
- (Outcome: FAILURE — use case ends; no partial state.)

## Success Guarantee

A `WorkSession` row exists with `status=ACTIVE` and a resolved `pinned_revisions` map covering every requested `--pin`. When `--auto-branch` was requested, exactly one `SpecBranch` row exists (`status=ACTIVE`, `owner_type=AGENT`, `owner_id=<session.id>`, `base_revision_ids` matching the pins) and one SEMANTIC `Lock` row per pinned use case. Reads through this session id return the pinned revisions regardless of subsequent edits on `main`.

## Minimal Guarantee

On any failure no orphaned session, branch, or lock rows persist. The local `.vspec/session.json` is only written after the server confirms creation. The default branch `main` is not advanced and no other session's pins are disturbed.

## Notes

- API: `POST /v1/sessions` (see `docs/06-api-contract.md`).
- CLI: `vspec session start` (see `docs/07-cli-spec.md`).
- Concurrency model authority: `docs/01-architecture.md` (Work Sessions, Locks).
- Data model: `WorkSession`, `SpecBranch`, `Lock` in `docs/05-data-model.md`.
- Companion: UC-018 closes the session, UC-022 acquires additional locks mid-session, UC-023 inspects who is working on a use case.
