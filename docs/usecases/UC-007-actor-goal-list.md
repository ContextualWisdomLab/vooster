---
vspec_format: 1
type: usecase
id: UC-007
key: VSPEC-007
title: Manage the actor-goal list
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Manage the actor-goal list

> A developer or PM works the Cockburn backlog phase: they enumerate Goals — short verb phrases describing what each actor wants to do — group them by actor, set their priority and level, and weed out duplicates or out-of-scope items. Goals identified here later get *promoted* to full UseCases (see UC-008). This use case covers the CRUD lifecycle of Goal rows during that backlog work: create, list, update, reject, and view by actor.

## Stakeholders and Interests

- **Developer / PM**: can capture a goal in seconds during a discovery session and revisit the list grouped by actor to spot gaps and duplicates. _(Protected by: step 4 and step 5)_
- **Vooster**: goals are always bound to an existing Actor row (no free-text "owners"), use the Cockburn level enum, and the IDENTIFIED → IN_DESIGN → PROMOTED/REJECTED state machine is enforced server-side. _(Protected by: step 3 and step 7)_
- **Reviewers**: when a goal is rejected, the rejection sticks (it is not silently deleted), so the team has an audit trail of "we considered this and said no." _(Protected by: step 7 and Minimal Guarantee)_
- **Future Use Case Authors**: every Goal carries enough metadata (actor, level, priority, description) to seed a UseCase via promotion without re-asking the originator. _(Protected by: Success Guarantee)_

## Preconditions

- The requester is authenticated and is a member of the workspace owning the project.
- A current project context is set.
- At least one Actor exists in the project (so goals can be attributed).

## Trigger

The user invokes one of the goal subcommands — most commonly `vspec goal create --actor <a> --description "<text>"`, `vspec goal list --actor <a>`, or `vspec goal reject <id>`.

## Main Success Scenario

1. **Developer / PM** chooses an operation: create, list, update, or reject a goal.
2. **System** resolves the active project and verifies the requester is a member.
3. **System** resolves the referenced Actor (for create or filtered list) and confirms it is non-archived in the project.
4. **Developer / PM** submits the operation payload (description and level for create, filters for list, field changes for update, or an id for reject).
5. **System** validates inputs against the schema: description non-empty, level in the enum, priority in `{P0,P1,P2,P3}`, status transitions legal.
6. **System** executes the operation: inserts a new Goal, returns the filtered list grouped by actor, patches the Goal in place, or sets `status = REJECTED`.
7. **System** writes a Revision (`entity_type = GOAL`) for any mutating operation and returns the resulting Goal(s).

## Extensions

### 3a. Referenced Actor does not exist or is archived

- 3a1. **System** returns 422 naming the missing actor.
- 3a2. **System** suggests `vspec actor list` to find a valid name or `vspec actor create` to add one.
- (Outcome: FAILURE — use case ends; no Goal is created or updated.)

### 5a. Description is empty or just whitespace

- 5a1. **System** returns 400 with the rule that goal descriptions are verb phrases.
- 5a2. **Developer / PM** resubmits with a real verb phrase.
- (Outcome: PARTIAL — rejoins main at step 6.)

### 5b. Illegal status transition (e.g., REJECTED → IDENTIFIED)

- 5b1. **System** returns 422 explaining the legal transitions: IDENTIFIED → IN_DESIGN → PROMOTED, and any state → REJECTED.
- (Outcome: FAILURE — use case ends; the Goal's status is unchanged.)

### 6a. Reject on a Goal whose status is already PROMOTED

- 6a1. **System** refuses, explaining the linked UseCase must be deprecated first (`vspec usecase archive`).
- (Outcome: FAILURE — use case ends.)

### 6b. Create produces a description that is a near-duplicate of an existing Goal for the same actor

- 6b1. **System** still creates the Goal but warns with the candidate duplicate id and `vspec goal show` for comparison.
- (Outcome: SUCCESS — use case ends; warning surfaced via `warnings[]` in the agent payload.)

### *a. Project has been archived between auth check and write

- *a1. **System** aborts the operation with 409.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

After a create, a Goal row exists with the requested description, actor, level, priority, and `status = IDENTIFIED`, plus a Revision (version 1). After an update, the patched Goal reflects the new field values and a new Revision is appended. After a reject, the Goal's `status = REJECTED` and a Revision records the change. A list operation returns goals grouped by actor with their current status and priority.

## Minimal Guarantee

No mutating operation leaves a half-written Goal: either the row and its Revision are both written or neither is. Rejected goals are preserved (never hard-deleted) so the backlog history is intact. List operations are read-only and never modify data, even on partial failure.

## Notes

- API endpoints: `POST /v1/projects/:projectId/goals`, `GET /v1/projects/:projectId/goals`, `PATCH /v1/goals/:id`. Promotion lives in UC-008 (`POST /v1/goals/:id/promote`).
- CLI: `vspec goal create`, `vspec goal list`, `vspec goal show`, `vspec goal reject` (and `vspec goal promote`, covered by UC-008).
- This is the *backlog* phase of the Cockburn method; see `docs/03-cockburn-method.md` § "Goals vs. Use Cases" for the philosophy.
- See UC-008 for the promotion step that turns a Goal into a UseCase.
