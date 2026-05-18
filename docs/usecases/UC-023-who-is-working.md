---
vspec_format: 1
type: usecase
id: UC-023
key: VSPEC-023
title: See who is working on a use case
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# See who is working on a use case

> Before editing a use case, anyone (human or agent) should be able to ask "is somebody on this right now?" in one command. vspec returns the active sessions that pin this use case, the active locks on it, and any open merge requests whose source or target branch touches it. The output is shaped to drive the next action — pin, lock, wait, or take it.

## Stakeholders and Interests

- **Developer / PM**: avoids stepping on an agent's in-flight work and avoids stalling a teammate by accidentally taking a HARD lock. _(Protected by: steps 3 and 4.)_
- **AI Coding Agent**: can self-coordinate by asking this before opening its own session, especially in workflows where multiple agents are launched against the same project. _(Protected by: step 4 and Success Guarantee.)_
- **Branch Owner**: their open MR touching the queried use case is surfaced so the caller knows their changes are about to land. _(Protected by: step 5.)_
- **Vooster**: the answer is consistent across CLI and API; an empty answer is itself a useful answer (with suggested next actions), not a 404. _(Protected by: extension 4a.)_

## Preconditions

- The caller is authenticated and has at least read access to the project (membership in the workspace).
- The queried key uses the form `KEY-NNN`.

## Trigger

The developer/PM runs `vspec who <KEY-NNN>` or hits `GET /v1/usecases/:id/who`.

## Main Success Scenario

1. **Developer / PM** invokes `who` with a use case key.
2. **System** resolves the key to a use case id within the current project and verifies it exists.
3. **System** queries active `WorkSession` rows whose `pinned_revisions` map contains the use case id and whose `status=ACTIVE`.
4. **System** queries active `Lock` rows on the use case where `expires_at > now()`.
5. **System** queries open `MergeRequest` rows whose source or target branch has the use case in its `head_revision_ids` map and whose `status=OPEN`.
6. **System** assembles the response: list of sessions (with owner, agent_type, intent, started_at), list of locks (with holder, level, expires_at), list of MRs (with id, source branch, conflict count).
7. **System** returns the bundle with `suggested_next_actions` derived from the result — if locks exist suggest `vspec lock list`; if MRs exist suggest `vspec merge show <id>`; if all lists are empty suggest `vspec session start --pin <KEY>`.

## Extensions

### 2a. The use case key does not exist in the current project

- 2a1. **System** returns 404 with the canonical key format and `vspec usecase search <q>` as a suggested next action.
- (Outcome: FAILURE — use case ends; nothing to report.)

### 2b. The use case is archived

- 2b1. **System** still answers (archived use cases can still have stale locks or open MRs touching them).
- 2b2. **System** includes an `archived: true` flag on the response and suggests `vspec usecase restore <KEY>` if any active work is found.
- (Outcome: PARTIAL — rejoins main at step 3.)

### 4a. No active sessions, locks, or open MRs touch the use case

- 4a1. **System** returns an empty bundle: `sessions: []`, `locks: []`, `merge_requests: []`.
- 4a2. **System** includes `vspec session start --intent "..." --pin <KEY>` in `suggested_next_actions` so the caller can immediately take it.
- (Outcome: SUCCESS — use case ends; empty result is the answer "the coast is clear.")

### 3a. A returned session has a heartbeat older than the TTL

- 3a1. **System** annotates the session entry with a `ZOMBIE` marker (same logic as UC-017 extension 4a).
- 3a2. **System** suggests `vspec session abandon <id>` for the offender.
- (Outcome: PARTIAL — rejoins main at step 5.)

### *a. Caller has no membership in the workspace

- *a1. **System** denies with 403 and does not disclose whether the use case key exists.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

The caller receives a bundle of three lists (sessions, locks, merge_requests) reflecting the current concurrency state of the named use case, plus next-action suggestions tailored to that state. No write occurs.

## Minimal Guarantee

Read-only operation: no session, lock, or MR state is mutated. The response never leaks data from workspaces the caller does not belong to.

## Notes

- API: `GET /v1/usecases/:id/who` (see `docs/06-api-contract.md`).
- CLI: `vspec who <KEY-NNN>` (see `docs/07-cli-spec.md`).
- The session view in this UC is per-use-case; UC-017 provides the workspace-wide session view.
- ZOMBIE detection rule is shared with UC-017 (same heartbeat TTL).
- Companion: UC-022 takes the lock the caller may want next; UC-016 starts the session with the pin.
