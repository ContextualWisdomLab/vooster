---
vspec_format: 1
type: usecase
id: UC-009
key: VSPEC-009
title: Author a use case from scratch
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Author a use case from scratch

> The flagship authoring flow. A developer/PM creates a brand-new `UseCase` end-to-end — supplying a verb-phrase title, picking a primary actor, choosing a level, and accepting a freshly-allocated project key. The system seeds an initial `Revision` so the use case is immediately pinnable by AI agent sessions.

## Stakeholders and Interests

- **Developer / PM**: captures a new goal as a structured, fully-dressed contract in one fluent command and is guided when fields are missing or look wrong. _(Protected by: steps 2, 3, and extension 2a.)_
- **AI Coding Agent**: can pin the new use case by `KEY-NNN` immediately, knowing a stable initial revision exists. _(Protected by: step 7.)_
- **Workspace Admin**: trusts that key allocation is collision-free even under concurrent creation. _(Protected by: extension 5c.)_
- **Vooster**: maintains Cockburn fidelity by warning on non-verb-phrase titles and requiring a primary actor at creation time. _(Protected by: extensions 2a and 3b.)_

## Preconditions

- The developer/PM is authenticated and has `EDITOR` or `OWNER` membership.
- A current project is bound (via `.vspec/config.json` or `--project`).
- At least one `Actor` exists in the project to serve as primary actor.

## Trigger

The developer/PM runs `vspec usecase create --title "<verb phrase>" --primary-actor <actor>`.

## Main Success Scenario

1. **Developer / PM** invokes the create command with a title, primary actor, and optional level/scope flags.
2. **System** runs the verb-phrase heuristic on the title and accepts it.
3. **System** resolves the primary actor name against the project's `Actor` registry.
4. **System** applies defaults: `level = USER_GOAL`, `format = BRIEF`, `status = DRAFT`, `scope = <project key lowercased>`, `priority = P2`.
5. **System** allocates the next sequential `key` within the project (e.g. `VSPEC-016`) inside a transaction with a unique constraint on `(project_id, key)`.
6. **System** persists the `UseCase` row and writes a first `Revision` snapshot on the current branch.
7. **System** returns the new key, a `vspec usecase show` hint, and suggested next actions (`add-stakeholder`, `scenario add`).
8. **Developer / PM** opens the new use case to begin authoring stakeholders and the main scenario.

## Extensions

### 2a. Title fails the verb-phrase heuristic

- 2a1. **System** flags titles starting with a noun, "the", or UI verbs ("clicks", "presses").
- 2a2. **System** prints suggested rewrites and the `--force` override.
- 2a3. **Developer / PM** either rewrites the title or re-runs with `--force`.
- (Outcome: FAILURE — use case ends without `--force`; rejoins main at step 3 with `--force`.)

### 3b. Primary actor is missing or unknown

- 3b1. **System** reports that the named actor does not exist in the project's `Actor` registry.
- 3b2. **System** suggests `vspec actor list` and `vspec actor create --name <n>` (UC-005).
- (Outcome: FAILURE — use case ends.)

### 5c. Duplicate key collision under concurrent creation

- 5c1. **System** catches the unique-constraint violation when two creators race for the same next key.
- 5c2. **System** retries the allocation up to three times with the next available key.
- 5c3. **System** surfaces a 409 only if all retries fail and instructs the user to retry.
- (Outcome: PARTIAL — rejoins main at step 6 on successful retry; FAILURE otherwise.)

### 3a. `--from <goal-id>` provided

- 3a1. **System** delegates to UC-008 (Promote a goal) instead of creating from raw flags.
- 3a2. **System** carries over the goal's actor, level, and description.
- (Outcome: SUCCESS — rejoins main at step 5.)

### \*a. Authorization fails

- \*a1. **System** returns 403 with a pointer to `vspec login` or `vspec member set-role`.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

A `UseCase` row exists with the supplied title, a unique project-scoped `key`, `current_revision_id` pointing at a freshly-written `Revision`, and `status = DRAFT`. The use case is immediately listable by UC-014 and pinnable by sessions.

## Minimal Guarantee

If any step after key allocation fails, the transaction rolls back: no `UseCase` row, no `Revision`, no consumed key. Authentication credentials are never logged or echoed.

## Notes

- API: `POST /v1/projects/:projectId/usecases`.
- CLI: `vspec usecase create` (see `docs/07-cli-spec.md`).
- Key allocation: see `docs/05-data-model.md` for the `(project_id, key)` unique constraint.
- Sibling flows: UC-008 (promote from goal), UC-010 (interests), UC-011 (main scenario), UC-012 (extensions).
