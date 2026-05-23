---
vspec_format: 1
type: usecase
id: UC-019
key: VSPEC-019
title: Create a branch
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Create a branch

> A developer/PM wants to make a coordinated set of spec changes in isolation from `main` so other agents and humans can keep working without seeing in-progress edits. They create a `SpecBranch` rooted at `main` (the only legal base in MVP) and record an immutable snapshot of every relevant entity's current revision as the branch's `base_revision_ids`. Subsequent edits write new revisions on the branch; `main` is untouched until a merge lands.

## Stakeholders and Interests

- **Developer / PM**: gets an isolated working surface in one command with a clear name and a recorded base point. _(Protected by: steps 4 and 5.)_
- **AI Coding Agent**: can later be assigned to this branch (via `--branch` or by starting a session whose pins resolve on it) and trust that no `main` edits will reach it until merge. _(Protected by: Success Guarantee.)_
- **Other Branch Owners**: see the new branch in `vspec branch list` so they can avoid overlapping intent. _(Protected by: step 6.)_
- **Vooster**: every branch has a typed owner (`HUMAN` or `AGENT`), a non-null `base_revision_ids` snapshot, and a unique name per project; no branch-of-a-branch is ever created (MVP rule). _(Protected by: step 3 and extension 3a.)_

## Preconditions

- The caller is authenticated and has `EDITOR` or `OWNER` membership in the workspace owning the project.
- A current project is selected.
- The base branch (`main` in MVP) exists.

## Trigger

The developer/PM runs `vspec branch create <name> [--from main]`.

## Main Success Scenario

1. **Developer / PM** invokes `branch create` with a name and optional `--from` (default `main`).
2. **System** validates membership and editor role for the project.
3. **System** verifies the requested `--from` value is `main` (single-level branches are an MVP invariant).
4. **System** resolves the base branch's current `head_revision_ids` map and copies it into the new branch's `base_revision_ids` (immutable snapshot of the branch point).
5. **System** creates the `SpecBranch` row with `status=ACTIVE`, `owner_type=HUMAN`, `owner_id=<caller.user.id>`, `head_revision_ids` initialized equal to `base_revision_ids`, and the chosen `name`.
6. **System** returns the branch with `suggested_next_actions` pointing at `vspec branch checkout <name>` and `vspec usecase edit <KEY>`.

## Extensions

### 2a. Caller lacks editor role

- 2a1. **System** denies the request with 403.
- 2a2. **System** suggests `vspec member list` so the caller can identify an editor.
- (Outcome: FAILURE — use case ends; no branch created.)

### 3a. `--from` references a non-main branch

- 3a1. **System** rejects with 422 referencing the MVP single-level-branch rule.
- 3a2. **System** suggests `vspec branch create <name> --from main` as the next action.
- (Outcome: FAILURE — use case ends.)

### 5a. Branch name collides with an existing branch in the project

- 5a1. **System** detects the unique-name violation on `(project_id, name)`.
- 5a2. **System** returns 422 and suggests a de-collided name.
- (Outcome: FAILURE — use case ends; no branch created.)

### 4a. Base branch has an open MergeRequest in flight against it

- 4a1. **System** detects one or more `MergeRequest` rows with `target_branch_id=<main.id>` and `status=OPEN`.
- 4a2. **System** still creates the branch but emits a warning listing the in-flight MR ids so the caller knows their base snapshot may be superseded soon.
- 4a3. **System** records the warning in the response `warnings` array.
- (Outcome: PARTIAL — rejoins main at step 5.)

### \*a. Transactional failure while snapshotting `base_revision_ids`

- \*a1. **System** ensures the branch row and the `base_revision_ids` snapshot are written in one transaction; on failure neither persists.
- \*a2. **System** returns exit code 5 with a retry hint.
- (Outcome: FAILURE — use case ends; no partial state.)

## Success Guarantee

A `SpecBranch` row exists with `status=ACTIVE`, a non-null `base_revision_ids` snapshot equal to `main`'s head at branch time, `head_revision_ids` initialized identically, and a unique `name` within the project. The branch is visible in `vspec branch list`.

## Minimal Guarantee

On any failure no branch row exists and `main`'s head is unchanged. Other branches and sessions are unaffected.

## Notes

- API: `POST /v1/projects/:projectId/branches` (see `docs/06-api-contract.md`).
- CLI: `vspec branch create`, `vspec branch checkout` (see `docs/07-cli-spec.md`).
- The auto-branch variant for sessions is covered by UC-016.
- Single-level branches: see `docs/01-architecture.md` (Branches).
- Companion: UC-020 merges this branch back to main.
