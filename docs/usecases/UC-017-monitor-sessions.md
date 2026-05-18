---
vspec_format: 1
type: usecase
id: UC-017
key: VSPEC-017
title: Monitor active sessions
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Monitor active sessions

> A developer/PM supervising a fleet of parallel AI coding agents needs a single-pane view of who is doing what right now: which agent, what kind, what intent, which use cases are pinned, which branch is in flight, how long it has been idle, and where locks are colliding. This view is the difference between confidently running six agents in parallel and discovering an hour later that two of them silently overlapped.

## Stakeholders and Interests

- **Developer / PM**: gets a real-time, accurate picture of all active work in the workspace, including idle-vs-zombie sessions and current lock conflicts, in one command. _(Protected by: steps 4–6.)_
- **AI Coding Agent**: is visible to the supervisor with its declared intent and pinned set, so its work is not accidentally duplicated by another agent. _(Protected by: step 4.)_
- **Workspace Admin**: can identify abandoned-looking sessions whose heartbeats are stale and decide whether to abandon them. _(Protected by: extension 4a.)_
- **Vooster**: monitoring leaks no cross-workspace data — a caller without membership cannot enumerate sessions in a workspace they do not belong to. _(Protected by: step 2.)_

## Preconditions

- The caller is authenticated.
- The caller has selected a workspace (or specifies one via `--workspace`).

## Trigger

The developer/PM runs `vspec session list [--mine|--workspace] [--status=]` or `vspec watch` for a live view.

## Main Success Scenario

1. **Developer / PM** runs `vspec session list --workspace`.
2. **System** verifies the caller has at least `EDITOR` membership in the requested workspace.
3. **System** queries all `WorkSession` rows for that workspace's projects, filtered by `status` (default `ACTIVE`) and optional `--mine`.
4. **System** for each session resolves: owning user, `agent_type`, `agent_identifier`, `intent`, the pinned use case keys (resolved from `pinned_revisions`), the attached `SpecBranch.name` if any, idle time computed from the most recent revision authored by the session, and the count of `Lock` rows held.
5. **System** computes lock conflict markers by joining each pinned use case to any other session pinning or locking the same entity.
6. **System** returns a table (human) or list (json/agent) sorted by `started_at` descending, with one row per session plus a footer summary of total conflicts.

## Extensions

### 2a. Caller has no membership in the requested workspace

- 2a1. **System** denies the request with 403 and does not disclose the existence of sessions in that workspace.
- 2a2. **System** suggests `vspec workspace list` as the next action.
- (Outcome: FAILURE — use case ends.)

### 4a. Session is marked ACTIVE but its last heartbeat is older than the configured TTL

- 4a1. **System** detects the session's most recent activity timestamp (latest authored revision or pin call) exceeds the heartbeat TTL (default 30 minutes — same as default lock TTL).
- 4a2. **System** flags the row with a `ZOMBIE` marker in the returned data and includes `vspec session abandon <id>` in `suggested_next_actions`.
- 4a3. **System** does not auto-abandon the session — abandonment is an explicit human or admin action.
- (Outcome: PARTIAL — rejoins main at step 5.)

### 3a. No sessions match the filter

- 3a1. **System** returns an empty list with `total: 0`.
- 3a2. **System** includes `vspec session start --intent "..."` in `suggested_next_actions`.
- (Outcome: SUCCESS — use case ends; empty result is a valid answer.)

### *a. `vspec watch` invoked instead of `session list`

- *a1. **System** streams the same snapshot every 2 seconds via Server-Sent Events on the same underlying query.
- *a2. **System** terminates the stream on SIGINT and returns exit code 0.
- (Outcome: SUCCESS — use case ends after stream is closed.)

## Success Guarantee

The caller receives an accurate snapshot of all sessions in scope, including derived fields (pinned keys, branch name, idle time, lock count, conflict markers, ZOMBIE flag where applicable). No write occurs.

## Minimal Guarantee

Read-only operation: no session, branch, or lock state is mutated even if the listing transiently fails. Cross-workspace data is never returned to a non-member.

## Notes

- API: `GET /v1/sessions?status=&user_id=&project_id=` (see `docs/06-api-contract.md`).
- CLI: `vspec session list`, `vspec watch` (see `docs/07-cli-spec.md`).
- Heartbeat TTL is shared with the default lock TTL (30 minutes); see `docs/05-data-model.md` Lock entity.
- Companion: UC-023 zooms in on a single use case; UC-018 closes a session that was found to be done.
