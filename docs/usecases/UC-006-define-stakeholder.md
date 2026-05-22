---
vspec_format: 1
type: usecase
id: UC-006
key: VSPEC-006
title: Define a stakeholder
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Define a stakeholder

> A developer or PM registers a Stakeholder in the project — the entity that _cares_ about outcomes but does not necessarily _act_. The stakeholder has a unique name within the project and a type (INTERNAL, EXTERNAL, or REGULATORY). Stakeholders are the rows that get attached to use cases via StakeholderInterest, ensuring every use case explicitly names whose interest each scenario protects.

## Stakeholders and Interests

- **Developer / PM**: gets a typed stakeholder ready to be linked to use cases, with the Cockburn actor-vs-stakeholder distinction enforced. _(Protected by: step 3 and Success Guarantee)_
- **Vooster**: stakeholder names are unique per project, and the entity is kept distinct from Actor in both the data model and the CLI surface so the Cockburn method is not eroded. _(Protected by: step 4)_
- **Auditors and Reviewers**: at review time every use case lists named stakeholders whose interests are checked off, rather than free-text "the user" mentions. _(Protected by: step 5)_

## Preconditions

- The requester is authenticated and is a member of the workspace owning the project.
- A current project context is set.
- The chosen stakeholder name is non-empty and does not collide with an existing non-archived stakeholder in the project.

## Trigger

The user invokes `vspec stakeholder create --name <n> --type <internal|external|regulatory>` or submits the stakeholder form in the project UI.

## Main Success Scenario

1. **Developer / PM** submits a name, type, and optional description.
2. **System** resolves the active project from context and verifies the requester is a member.
3. **System** validates the name is non-empty and unique among non-archived stakeholders in the project.
4. **System** validates the type against the Stakeholder type enum (INTERNAL/EXTERNAL/REGULATORY).
5. **System** inserts the Stakeholder row with `archived_at = null`.
6. **System** creates an initial Revision (`entity_type = STAKEHOLDER`, `version_number = 1`).
7. **System** returns the Stakeholder with a recommendation to attach it to use cases via `vspec usecase add-stakeholder`.

## Extensions

### 3a. Stakeholder name collides with an existing non-archived stakeholder

- 3a1. **System** returns 422 referencing the existing stakeholder's id.
- 3a2. **System** offers `vspec stakeholder edit` to amend the existing row.
- (Outcome: FAILURE — use case ends; no Stakeholder is created.)

### 4a. Type value is not in the enum

- 4a1. **System** returns 400 with the three accepted values.
- 4a2. **Developer / PM** resubmits with a valid type.
- (Outcome: PARTIAL — rejoins main at step 5.)

### 1a. Submitter tries to attach a stakeholder to a step (confusing it with an actor)

- 1a1. **System** detects the misuse during validation of the related request and rejects it.
- 1a2. **System** explains: actors _do_, stakeholders _care_ — use `vspec actor create` instead.
- (Outcome: FAILURE — use case ends; no Stakeholder is created on this path.)

### \*a. Project has been archived between auth check and insert

- \*a1. **System** detects the archived state and aborts.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

A Stakeholder row exists in the project with the requested name, type, and description. An initial Revision snapshots the state. The stakeholder can immediately be attached to any use case via `POST /v1/usecases/:id/stakeholder-interests`.

## Minimal Guarantee

A failed create leaves no Stakeholder row and no Revision. Existing Stakeholders are not modified. The name namespace is not consumed by failed attempts.

## Notes

- API endpoint: `POST /v1/projects/:projectId/stakeholders`.
- CLI: `vspec stakeholder create`, `vspec stakeholder list`, `vspec stakeholder edit`, `vspec stakeholder archive`.
- Distinct from UC-005 (define an actor). A person can be modeled as both, but each role is its own row.
- See UC-010 (define interest) for attaching a stakeholder to a specific use case with an interest statement.
