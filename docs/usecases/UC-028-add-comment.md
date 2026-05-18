---
vspec_format: 1
type: usecase
id: UC-028
key: VSPEC-028
title: Comment on a use case
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Comment on a use case

> Reviewers and collaborators need a lightweight discussion channel attached to a use case — to flag concerns, propose edits, or record a decision — without rewriting the spec itself. MVP supports use-case-level comments only: add, list, edit, resolve, and (own-only) delete, with a markdown body.

## Stakeholders and Interests

- **Developer / PM**: posts review notes against a specific use case and resolves them once addressed, keeping discussion attached to the artifact. _(Protected by: steps 2, 4, and 5.)_
- **AI Coding Agent**: can read open comments via `vspec comment list` and treat unresolved ones as blockers when pinning a use case for implementation. _(Protected by: success guarantee.)_
- **Workspace Admin**: trusts that a user can never silently delete or edit another user's comment. _(Protected by: extensions 4a and 5b.)_
- **Vooster**: keeps the collaboration surface intentionally minimal in MVP (UC level only) and routes future expansions (step-level, thread-level) through new use cases. _(Protected by: precondition that `target_type = USECASE`.)_

## Preconditions

- The developer/PM is authenticated and holds at least `EDITOR` membership on the workspace.
- A current project is bound.
- The target use case key resolves to a non-archived `UseCase`.

## Trigger

The developer/PM runs one of `vspec comment add|list|resolve|edit|delete`.

## Main Success Scenario

1. **Developer / PM** invokes a comment subcommand against a use case key or comment ID.
2. **System** resolves the use case (or comment) and authorizes the caller for the requested operation.
3. **System** validates the request: a non-empty markdown `body` for `add` and `edit`; ownership for `edit` and `delete`; an existing target for `resolve`.
4. **System** writes the change: inserts a new `Comment` row (`add`), updates `body` and `updated_at` (`edit`), sets `resolved = true` and `resolved_at` (`resolve`), or removes the row (`delete`).
5. **System** returns the affected `Comment` payload plus suggested next actions (`vspec comment list <KEY-NNN>`, `vspec usecase show <KEY-NNN>`).
6. **Developer / PM** continues reviewing or hands off to another collaborator.

## Extensions

### 3a. `add` or `edit` called with an empty or whitespace-only body

- 3a1. **System** returns 422 (`empty_body`) without writing.
- 3a2. **System** prints a `--body "<text>"` example in the next-actions hint.
- (Outcome: FAILURE — use case ends.)

### 3b. Target use case does not exist

- 3b1. **System** returns 404 naming the missing key.
- 3b2. **System** suggests `vspec usecase list` to discover valid keys.
- (Outcome: FAILURE — use case ends.)

### 4a. `resolve` on an already-resolved comment

- 4a1. **System** treats the call as an idempotent no-op and returns 200 with the existing resolved payload.
- 4a2. **System** does not update `resolved_at` on the second call.
- (Outcome: SUCCESS — rejoins main at step 5 with no state change.)

### 4b. `delete` of another user's comment

- 4b1. **System** returns 403 (`not_owner`) and refuses the deletion.
- 4b2. **System** notes that only the original `author_id` may delete; admins are not exempted in MVP.
- (Outcome: FAILURE — use case ends.)

### 5b. `edit` of another user's comment

- 5b1. **System** returns 403 (`not_owner`) and refuses the edit.
- (Outcome: FAILURE — use case ends.)

### *a. Network or server error

- *a1. **System** exits with code 5 and a retry hint; no `Comment` row is written or removed.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

After `add` a `Comment` row exists with the supplied markdown `body`, `author_id` set to the caller, `target_type = USECASE`, `resolved = false`, and `created_at` set. After `edit`, `resolve`, or `delete` the row reflects the requested change and the caller's ownership constraints were honored.

## Minimal Guarantee

On any failure no `Comment` row is inserted, mutated, or removed. Authorship and resolution status of every existing comment is preserved exactly.

## Notes

- API: `POST /v1/usecases/:id/comments`, `GET /v1/usecases/:id/comments`, `PATCH /v1/comments/:id`, `DELETE /v1/comments/:id` (see `docs/06-api-contract.md`).
- CLI: `vspec comment add|list|resolve|edit|delete` (see `docs/07-cli-spec.md`).
- Data model: `Comment.target_type` enum is restricted to `USECASE` in MVP (`docs/05-data-model.md`); step-level and scenario-level comments are deliberately deferred.
- Body is markdown; the server stores it verbatim and never renders it.
