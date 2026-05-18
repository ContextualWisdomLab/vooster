---
vspec_format: 1
type: usecase
id: UC-005
key: VSPEC-005
title: Define an actor
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Define an actor

> A developer or PM registers an Actor in the project — the entity that *does* things in use cases. The actor has a unique name within the project, a Cockburn type (PRIMARY, SUPPORTING, or OFFSTAGE), a human/non-human flag, and optional aliases. Once defined, the actor can be referenced as the primary actor of a use case or as the doer of a step.

## Stakeholders and Interests

- **Developer / PM**: gets a typed, validated actor immediately available to use case authoring, with name conflicts caught up front. _(Protected by: step 3 and Success Guarantee)_
- **Vooster**: actor names are unique per project, types are constrained to the Cockburn enum, and one canonical "System" actor exists in every project for system steps. _(Protected by: step 3 and step 4)_
- **AI Coding Agents**: actor references in steps resolve deterministically to a single Actor row, so generated Gherkin attributes actions to the correct identity. _(Protected by: step 6)_
- **Other Authors**: when they read a step like `**Customer** submits the order`, they can look up exactly who that is, including alternate names the team uses. _(Protected by: step 5)_

## Preconditions

- The requester is authenticated and is a member of the workspace owning the project.
- A current project context is set (via `vspec project switch` or `--project=<key>`).
- The chosen actor name is non-empty and does not collide with an existing non-archived actor in the project.

## Trigger

The user invokes `vspec actor create --name <n> --type <t> [--human]` or submits the actor form in the project UI.

## Main Success Scenario

1. **Developer / PM** submits a name, type (PRIMARY/SUPPORTING/OFFSTAGE), an `is_human` flag, an optional description, and zero or more aliases.
2. **System** resolves the active project from context and verifies the requester is a member.
3. **System** validates the name is non-empty, slug-safe, and unique among non-archived actors in the project.
4. **System** validates the type against the Actor type enum.
5. **System** inserts the Actor row with `archived_at = null` and the provided aliases.
6. **System** creates an initial Revision (`entity_type = ACTOR`, `version_number = 1`) snapshotting the new actor.
7. **System** returns the Actor with a recommendation to add stakeholders or create goals next.

## Extensions

### 3a. Actor name collides with an existing non-archived actor

- 3a1. **System** returns 422 referencing the existing actor's id.
- 3a2. **System** offers `vspec actor edit` (to amend the existing one) or `--add-alias` (to attach the new name as an alias).
- (Outcome: FAILURE — use case ends; no Actor is created.)

### 3b. Actor name collides with an archived actor

- 3b1. **System** returns 409 explaining the name is held by an archived actor.
- 3b2. **System** suggests `vspec actor restore` or a different name.
- (Outcome: FAILURE — use case ends.)

### 4a. Type value is not in the enum

- 4a1. **System** returns 400 listing the three valid type values.
- 4a2. **Developer / PM** resubmits with a valid type.
- (Outcome: PARTIAL — rejoins main at step 5.)

### 1a. Name is "System" and an Actor with that name already exists project-wide

- 1a1. **System** returns 422 explaining "System" is reserved as the canonical system actor.
- 1a2. **System** points to `vspec actor show System` to inspect the built-in actor.
- (Outcome: FAILURE — use case ends.)

### *a. Requester has read-only access (e.g., archived membership)

- *a1. **System** returns 403 with a hint to contact the workspace owner.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

An Actor row exists in the project with the requested name, type, `is_human` flag, and aliases. An initial Revision (version 1) snapshots the state. The actor is immediately available as `--primary-actor` for `vspec usecase create` and as the doer of any step.

## Minimal Guarantee

A failed create leaves no Actor row and no Revision. The name namespace within the project is not consumed by failed attempts. Existing actors are never modified by a failed create call.

## Notes

- API endpoint: `POST /v1/projects/:projectId/actors`.
- CLI: `vspec actor create`, `vspec actor list`, `vspec actor edit`, `vspec actor archive`.
- See UC-006 for defining a stakeholder (the "cares about" counterpart).
- Cockburn distinction: actors *do*, stakeholders *care*. See `docs/03-cockburn-method.md`.
