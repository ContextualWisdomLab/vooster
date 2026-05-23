---
vspec_format: 1
type: usecase
id: UC-004
key: VSPEC-004
title: Create a project
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Create a project

> Inside an existing workspace, a developer or PM creates a Project — the container for actors, stakeholders, goals, and use cases. The project gets a short uppercase key (used to prefix human-readable IDs like `PAY-001`), a default `main` SpecBranch, and an initial empty state ready for actor and use case authoring.

## Stakeholders and Interests

- **Developer / PM**: gets a working project with a sensible default branch in one command, without having to learn the branch model first. _(Protected by: step 6 and Success Guarantee)_
- **Vooster**: project keys are globally namespaced within a workspace and never silently collide; every project has exactly one `main` branch from creation. _(Protected by: step 3 and step 5)_
- **Other Workspace Members**: visible/invisible status of the project respects the chosen visibility, and no half-initialized project shows up in their list. _(Protected by: step 7 and Minimal Guarantee)_

## Preconditions

- The requester is authenticated and is a member (OWNER or EDITOR) of the target workspace.
- The workspace exists and is not archived.
- The requester has chosen a project name and a 2–8 character uppercase key.

## Trigger

The user invokes `vspec project create --name "<name>" --key <KEY>` or submits the new-project form in the workspace UI.

## Main Success Scenario

1. **Developer / PM** submits a project name, a key, and optional visibility.
2. **System** verifies the requester has OWNER or EDITOR membership in the workspace.
3. **System** validates the key against the pattern `^[A-Z][A-Z0-9]{1,7}$` and checks it is unique within the workspace.
4. **System** begins a transaction.
5. **System** inserts the Project row with `default_branch_id = null`.
6. **System** inserts a SpecBranch named `main` with `owner_type = HUMAN`, `owner_id = requester.id`, and `base_branch_id = null`, then updates the Project's `default_branch_id` to point to it.
7. **System** commits the transaction and returns the Project with a recommendation to create actors next.

## Extensions

### 2a. Requester is not a workspace member

- 2a1. **System** returns 403 with a hint to request an invitation.
- (Outcome: FAILURE — use case ends; no Project is created.)

### 3a. Key fails pattern validation

- 3a1. **System** returns 400 with the regex and three example keys.
- 3a2. **Developer / PM** resubmits with a conforming key.
- (Outcome: PARTIAL — rejoins main at step 4.)

### 3b. Key is already in use within the workspace

- 3b1. **System** returns 422 listing the existing project that holds the key.
- 3b2. **System** suggests `vspec project show <KEY>` so the user can verify intent.
- (Outcome: FAILURE — use case ends; no Project is created.)

### 6a. Transaction fails partway (e.g., database error inserting SpecBranch)

- 6a1. **System** rolls back the transaction, leaving no Project and no SpecBranch.
- 6a2. **System** returns 500 with a request id for support.
- (Outcome: FAILURE — use case ends; database is unchanged.)

### \*a. Workspace has been archived between auth check and commit

- \*a1. **System** detects the archived state and aborts the transaction.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

A Project exists with the requested name, key, and visibility. A SpecBranch named `main` exists, references the Project, and is set as the Project's `default_branch_id`. The requester can immediately call actor, stakeholder, goal, and usecase creation endpoints scoped to the new project.

## Minimal Guarantee

A failed create never leaves an orphan Project (without a `main` branch) or an orphan SpecBranch (without a Project). The key namespace within the workspace is not consumed by failed attempts. No revision rows are written for failed projects.

## Notes

- API endpoint: `POST /v1/workspaces/:id/projects`.
- CLI: `vspec project create`, `vspec project switch`, `vspec project show`.
- See UC-005 and UC-006 for the recommended next steps (defining actors and stakeholders).
- See UC-019 for creating additional non-main branches.
