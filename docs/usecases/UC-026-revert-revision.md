---
vspec_format: 1
type: usecase
id: UC-026
key: VSPEC-026
title: Revert a use case to a previous revision
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Revert a use case to a previous revision

> A regression slipped into a use case and the developer/PM wants to restore an earlier snapshot. The system creates a **new forward Revision** that re-applies the chosen snapshot, leaving the history append-only. Before writing, it runs impact analysis and refuses to proceed if the revert would re-introduce a `BREAKING` change unless `--force` is passed.

## Stakeholders and Interests

- **Developer / PM**: rolls back a bad edit without losing the audit trail and is warned before the revert breaks pinned agent sessions. _(Protected by: steps 4 and 6 and extension 4a.)_
- **AI Coding Agent**: keeps its pinned revision intact; any session impacted by the revert is reported up front instead of silently invalidated. _(Protected by: step 4 and extension 4a.)_
- **Workspace Admin**: trusts that history is never rewritten — every revert is itself a new `Revision` row with proper authorship. _(Protected by: step 6.)_
- **Vooster**: keeps Cockburn fidelity by re-routing reverts through the same severity rules and lock checks as a normal edit. _(Protected by: steps 3 and 4.)_

## Preconditions

- The developer/PM is authenticated and holds at least `EDITOR` membership.
- A current project and branch are bound.
- The target use case exists and is not archived.

## Trigger

The developer/PM runs `vspec revert UC-XXX --to <rev>`.

## Main Success Scenario

1. **Developer / PM** invokes `vspec revert <KEY-NNN> --to <rev>` optionally passing `--force` and `--summary`.
2. **System** resolves the use case key, authorizes the caller, and loads the target revision's `snapshot`.
3. **System** confirms there is no competing `HARD` lock held by another user or session on the use case or its children.
4. **System** runs impact analysis comparing the current head to the target snapshot and computes severity, affected sessions, and affected branches.
5. **System** previews the planned revert to the caller, including the severity, listed affected sessions, and a warning if the downstream Gherkin export would change.
6. **System** writes a new `Revision` for the use case (and any child entities whose state differs) restoring the target snapshot, with `parent_revision_id` pointing at the prior head and `change_summary = "Revert to <rev>"`.
7. **System** advances the branch's `head_revision_ids` map to the new revisions and returns the new revision ID plus suggested next actions (`vspec history`, `vspec session list --status=active`).

## Extensions

### 2a. Target revision not found or belongs to a different use case

- 2a1. **System** returns 404 naming the missing revision and the expected `entity_id`.
- 2a2. **System** suggests `vspec history <KEY-NNN>` to discover valid revision IDs.
- (Outcome: FAILURE — use case ends.)

### 3a. Use case is HARD-locked by another user or session

- 3a1. **System** returns 409 with the holder's identity, lock reason, and `expires_at`.
- 3a2. **System** suggests waiting, contacting the holder, or running `vspec who <KEY-NNN>`.
- (Outcome: FAILURE — use case ends.)

### 4a. Revert would re-introduce a BREAKING change without `--force`

- 4a1. **System** lists each BREAKING change the revert would re-apply and each affected active session.
- 4a2. **System** refuses to write and instructs the caller to rerun with `--force` if they accept the impact.
- 4a3. **Developer / PM** either abandons the revert or reruns with `--force --summary "<reason>"`.
- (Outcome: PARTIAL — rejoins main at step 6 only on a `--force` rerun; otherwise FAILURE.)

### 5a. Downstream Gherkin export would change

- 5a1. **System** emits a warning that pinned CI feature files will drift on next sync.
- 5a2. **System** still proceeds (this is informational, not blocking).
- (Outcome: PARTIAL — rejoins main at step 6 with warning recorded in output.)

### \*a. Network or server error mid-write

- \*a1. **System** rolls back the transaction so no partial revision is persisted.
- \*a2. **System** exits with code 5 and a retry hint.
- (Outcome: FAILURE — use case ends; no state change.)

## Success Guarantee

A new `Revision` exists on the current branch whose `snapshot` matches the target revision's snapshot. The use case's `current_revision_id` points at this new revision. Prior history is intact and append-only. Impact analysis ran before the write and (if BREAKING) the caller consented via `--force`.

## Minimal Guarantee

On any failure, no new `Revision` row is created, no branch head is advanced, and no lock is released or acquired. The append-only history invariant is preserved.

## Notes

- API: `POST /v1/usecases/:id/revert` (see `docs/06-api-contract.md`).
- CLI: `vspec revert <KEY-NNN> --to <rev>` (see `docs/07-cli-spec.md`).
- Severity rules: re-uses the rule table in `docs/05-data-model.md`.
- Sibling flows: UC-024 (history), UC-025 (diff), UC-027 (impact analysis).
