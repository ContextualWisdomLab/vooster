---
vspec_format: 1
type: usecase
id: UC-008
key: VSPEC-008
title: Promote a goal to a use case
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Promote a goal to a use case

> An identified Goal from the Actor-Goal List has matured enough to deserve a fully-dressed specification. The developer/PM promotes it, creating a seeded `UseCase` and marking the original Goal as `PROMOTED` so the backlog-to-spec evolution remains traceable.

## Stakeholders and Interests

- **Developer / PM**: turns a backlog entry into a real, editable use case in one command without re-typing the actor, level, or description. _(Protected by: step 4.)_
- **AI Coding Agent**: gains an immediately addressable `KEY-NNN` to pin against once the use case lands. _(Protected by: success guarantee.)_
- **Vooster**: keeps the backlog-to-spec link auditable (`Goal.linked_usecase_id`) and prevents the same goal from being promoted twice. _(Protected by: step 3 and extension 3a.)_

## Preconditions

- The developer/PM is authenticated and has `EDITOR` or `OWNER` membership in the workspace.
- A current project is selected (via `vspec project switch` or `--project`).
- A `Goal` exists in `IDENTIFIED` or `IN_DESIGN` status and is not yet linked to a use case.

## Trigger

The developer/PM runs `vspec goal promote <goal-id>`.

## Main Success Scenario

1. **Developer / PM** invokes the promote command against an existing goal.
2. **System** loads the goal and validates its status is `IDENTIFIED` or `IN_DESIGN` and `linked_usecase_id` is null.
3. **System** allocates the next `key` (e.g. `VSPEC-016`) within the project's key space.
4. **System** creates a `UseCase` seeded with the goal's `actor_id` as `primary_actor_id`, the goal's `description` as `title`, the goal's `level`, and `format = BRIEF`.
5. **System** writes a first `Revision` snapshot on the project's current branch with `change_summary = "Promoted from goal <goal-id>"`.
6. **System** updates the goal: sets `status = PROMOTED` and `linked_usecase_id` to the new use case.
7. **System** returns the new use case key plus suggested next actions (add stakeholders, write main scenario).

## Extensions

### 2a. Goal is already promoted

- 2a1. **System** detects `linked_usecase_id` is non-null.
- 2a2. **System** returns 409 with a pointer to the existing use case key.
- (Outcome: FAILURE — use case ends.)

### 2b. Goal status is REJECTED

- 2b1. **System** rejects the promotion as semantically invalid.
- 2b2. **System** suggests reopening the goal via `vspec goal edit <id> --status in-design`.
- (Outcome: FAILURE — use case ends.)

### 4a. Title fails the verb-phrase heuristic

- 4a1. **System** still creates the use case but emits a warning.
- 4a2. **System** includes `vspec usecase set <key> --field title` in suggested next actions.
- (Outcome: PARTIAL — rejoins main at step 5.)

### \*a. Network or server error during creation

- \*a1. **System** aborts before mutating either the goal or the use case (transactional write).
- \*a2. **System** returns exit code 5 with a retry hint.
- (Outcome: FAILURE — use case ends; no partial state.)

## Success Guarantee

A new `UseCase` row exists with a fresh project-scoped `key` and one initial `Revision`. The originating `Goal` has `status = PROMOTED` and `linked_usecase_id` pointing at the new use case. Both writes happen atomically.

## Minimal Guarantee

On failure, neither the goal nor the use case is partially mutated: the goal retains its prior status and no orphaned `UseCase` or `Revision` rows remain.

## Notes

- API: `POST /v1/goals/:id/promote` (see `docs/06-api-contract.md`).
- CLI: `vspec goal promote <id>` (see `docs/07-cli-spec.md`).
- Downstream: UC-009 covers authoring from scratch; UC-010 fills in stakeholder interests; UC-011 adds the main success scenario.
