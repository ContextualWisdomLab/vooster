---
vspec_format: 1
type: usecase
id: UC-015
key: VSPEC-015
title: Archive or restore a use case
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Archive or restore a use case

> A use case has fallen out of scope but its revision history must be preserved. The developer/PM archives it via a reversible soft delete (`archived_at` timestamp). Archived use cases vanish from default listings but remain individually viewable, pinnable for read-only inspection, and fully restorable. True hard deletion is explicitly post-MVP.

## Stakeholders and Interests

- **Developer / PM**: removes obsolete use cases from default catalog views without losing history. _(Protected by: steps 3 and 5.)_
- **Reviewer / Auditor**: can still inspect an archived use case by key and view its revision chain. _(Protected by: extension 5a.)_
- **AI Coding Agent (with existing pin)**: keeps its pinned revision usable, even after the use case is archived, until the session ends. _(Protected by: extension 3a.)_
- **Vooster**: preserves the "no destructive deletes in MVP" invariant — `archived_at` is the only soft-delete column and hard delete is out of scope. _(Protected by: success guarantee.)_

## Preconditions

- The target `UseCase` exists.
- The developer/PM has write permission on the project.
- (For restore) `archived_at` is non-null; (for archive) it is null.

## Trigger

The developer/PM runs `vspec usecase archive <KEY-NNN>` or `vspec usecase restore <KEY-NNN>`.

## Main Success Scenario

1. **Developer / PM** invokes the archive command with the use case key.
2. **System** loads the use case and verifies it is not already archived.
3. **System** enumerates active `WorkSession`s with pins on this use case and active `Lock`s held against it.
4. **System** sets `archived_at = now()` and writes a `Revision` summarizing the archive action.
5. **System** removes the use case from default listings (UC-014 will filter it unless `--include-archived` is set) but keeps it addressable by key.
6. **System** returns the key, the archive timestamp, and the count of any sessions/locks that should be wound down.

## Extensions

### 2a. Use case is already archived

- 2a1. **System** returns 409 with the existing `archived_at` value.
- 2a2. **System** suggests `vspec usecase restore <KEY-NNN>` for the inverse operation.
- (Outcome: FAILURE — use case ends.)

### 3a. Active sessions still pin this use case

- 3a1. **System** still performs the archive (it is reversible) but flags affected sessions in the response.
- 3a2. **System** allows each pinned session to keep reading its pinned revision until completion or abandonment.
- (Outcome: PARTIAL — rejoins main at step 4.)

### 3b. HARD lock is held against this use case

- 3b1. **System** refuses to archive while a `HARD` lock is active.
- 3b2. **System** returns 409 with the lock holder and `expires_at`.
- (Outcome: FAILURE — use case ends.)

### \*a. Restore flow

- \*a1. **Developer / PM** runs `vspec usecase restore <KEY-NNN>`.
- \*a2. **System** verifies `archived_at` is non-null.
- \*a3. **System** sets `archived_at = null` and writes a `Revision` noting the restore.
- \*a4. **System** re-includes the use case in default listings.
- (Outcome: SUCCESS — use case ends.)

### \*b. Hard delete requested

- \*b1. **System** rejects any `--hard` or `--purge` flag as unsupported in MVP.
- \*b2. **System** explains that destructive deletion is post-MVP and points at archive as the only supported path.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

The targeted `UseCase` has `archived_at` set (archive) or cleared (restore), and a corresponding `Revision` records the action. The use case is excluded from (or re-included in) default UC-014 listings accordingly. All historical revisions, scenarios, steps, and stakeholder interests remain intact and recoverable on restore.

## Minimal Guarantee

On failure, `archived_at` is unchanged. No related entities (scenarios, steps, revisions, comments) are deleted, regardless of failure mode. The operation is always reversible: an archive can be restored with no data loss because no rows are removed from the database.

## Notes

- API: `DELETE /v1/usecases/:id` (soft delete) and `PATCH /v1/usecases/:id` with `archived_at = null` for restore.
- CLI: `vspec usecase archive <KEY-NNN>` and `vspec usecase restore <KEY-NNN>` (see `docs/07-cli-spec.md`).
- Default listing behavior: see UC-014 — archived use cases are filtered unless `--include-archived` is set.
- Hard delete is intentionally out of MVP scope per `docs/00-overview.md`. Archive is the canonical removal mechanism.
