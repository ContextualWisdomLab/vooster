---
vspec_format: 1
type: usecase
id: UC-034
key: VSPEC-034
title: Fetch a structured spec (AI agent)
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: ai-coding-agent
---

# Fetch a structured spec (AI agent)

> The agent-native read path. An AI coding agent runs `vspec usecase show UC-XXX --format=agent` to obtain a JSON envelope containing the use case's structured `data`, the resolution `context` (project, branch, session, revision), and `suggested_next_actions[]`. When an active session pins the use case, the pinned revision overrides any `--revision` flag so the agent's view never silently drifts mid-task.

## Stakeholders and Interests

- **AI Coding Agent**: receives parseable JSON with explicit revision identity so its prompts, tests, and code can be hashed against a known snapshot. _(Protected by: steps 3–5 and Success Guarantee.)_
- **Developer / PM**: knows that any agent reading specs leaves a session pin trail, so concurrent edits won't silently break the agent's in-flight work. _(Protected by: step 3 and extension 4a.)_
- **CI/CD System**: same endpoint with a read-scoped API key produces the same payload, enabling pre-flight checks without elevated credentials. _(Protected by: step 2 and extension *a.)_
- **Vooster**: every agent read goes through one typed contract (`{ data, context, suggested_next_actions, warnings, format_version }`) so agent integrations cannot diverge from the canonical shape. _(Protected by: step 4 and Success Guarantee.)_

## Preconditions

- The caller is authenticated (session cookie or `Bearer` API key with `read` scope).
- The use case key resolves to a non-archived `UseCase` in the caller's accessible projects.
- If `--session` is set, the `WorkSession` exists, is `ACTIVE`, and is owned by the caller.

## Trigger

The agent runs `vspec usecase show <KEY-NNN> --format=agent [--revision <rev_id>] [--session <id>]`.

## Main Success Scenario

1. **AI Coding Agent** invokes `usecase show` with the key and `--format=agent`.
2. **System** authenticates the caller and confirms read access to the target project.
3. **System** resolves the effective revision: a `--session`-pinned revision takes precedence over `--revision`, which takes precedence over the current branch head.
4. **System** loads the use case, all scenarios, steps, stakeholder interests, and the primary actor at the resolved revision.
5. **System** assembles the response envelope: `data` (the structured use case), `context` (`project_key`, `branch`, `session_id`, `revision`), `suggested_next_actions` (e.g. `vspec change propose`, `vspec export gherkin`), `warnings`, and `format_version: 1`.
6. **System** returns the JSON envelope on stdout with a `X-Vspec-Request-Id` echoed in the metadata.
7. **AI Coding Agent** parses the envelope and proceeds with its task (typically read-then-propose via UC-035).

## Extensions

### 3a. `--revision` references a revision that does not exist for this use case

- 3a1. **System** returns 404 with the requested revision id and `vspec history <KEY-NNN>` as a suggested next action.
- (Outcome: FAILURE — use case ends.)

### 3b. `--session` is set and the session pins this use case

- 3b1. **System** ignores any `--revision` argument and uses the pinned revision.
- 3b2. **System** records this in `context.revision` and adds a warning when `--revision` was supplied but overridden.
- (Outcome: SUCCESS — rejoins main at step 4.)

### 4a. `--session` is set but does not pin this use case

- 4a1. **System** falls back to the resolution order in step 3 (revision flag, then branch head).
- 4a2. **System** adds a warning to the `warnings[]` array noting that this read is not pinned and is therefore vulnerable to concurrent edits.
- 4a3. **System** suggests `vspec session pin <KEY-NNN>` in `suggested_next_actions`.
- (Outcome: SUCCESS — rejoins main at step 5.)

### 2a. The caller is unauthenticated

- 2a1. **System** returns 401 with `vspec login` (for humans) and key-creation guidance (for agents).
- (Outcome: FAILURE — use case ends.)

### *a. The use case is archived

- *a1. **System** returns 404 (does not distinguish archived from missing without elevated permission).
- *a2. **System** suggests `vspec usecase list --status=` for an authorized human caller.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

The caller receives a complete `--format=agent` JSON envelope whose `context.revision` identifies exactly which snapshot was returned, whose `data` is the structured use case at that snapshot, and whose `suggested_next_actions` names the next safe command. When a session pins the use case, the envelope is byte-stable across concurrent edits on the branch.

## Minimal Guarantee

The response shape conforms to `format_version: 1` even on partial failures: errors come back as RFC 7807 problem documents with `suggested_next_actions` attached, never as half-built payloads. No write of any kind occurs as a side effect of a read.

## Notes

- API: `GET /v1/usecases/:id?revision=&session=&format=agent` (see `docs/06-api-contract.md`).
- CLI: `vspec usecase show <KEY> --format=agent` (see `docs/07-cli-spec.md`).
- Envelope contract: `docs/07-cli-spec.md` § "`--format=agent` payload".
- Companion: UC-016 (start session — establishes the pin), UC-035 (propose a change — typical next step), UC-033 (ai-guide — explains this flow).
