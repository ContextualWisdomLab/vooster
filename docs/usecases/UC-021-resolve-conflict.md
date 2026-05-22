---
vspec_format: 1
type: usecase
id: UC-021
key: VSPEC-021
title: Resolve a merge conflict
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Resolve a merge conflict

> An open `MergeRequest` carries one or more conflict descriptors that vspec refused to auto-merge — structural (same field, different values) or semantic (same extension point, different content). The developer/PM walks the list, choosing `MINE`, `THEIRS`, or `MANUAL` (with a payload value) per conflict. When every conflict is resolved and the base revisions are still current, the merge lands.

## Stakeholders and Interests

- **Developer / PM**: makes a deliberate decision per conflict with the full structural diff visible, rather than free-typing into a 3-way merge tool. _(Protected by: steps 3 and 4.)_
- **Branch Owner**: sees their proposed values preserved as the `THEIRS` option (or honored verbatim when `MINE` is chosen on the MR initiator's side). _(Protected by: step 2 and Success Guarantee.)_
- **AI Coding Agent**: never sees a half-resolved state — the resolution call is atomic; the MR is either still `OPEN` with new resolutions applied or already `MERGED`. _(Protected by: step 6 and Minimal Guarantee.)_
- **Vooster**: optimistic-concurrency-protected — if the source or target branch has advanced since the resolution was drafted, the call is rejected with the current revision so the resolver can re-pull and try again. _(Protected by: extension 2a.)_

## Preconditions

- The caller is authenticated and has `EDITOR` or `OWNER` membership in the project.
- A `MergeRequest` exists with `status=OPEN` and a non-empty `conflicts` array.
- The caller has the current `base_revision` from the MR (returned by `vspec merge show`).

## Trigger

The developer/PM runs `vspec merge resolve <id> [--strategy mine|theirs|manual]` (or supplies a per-conflict resolutions list via API).

## Main Success Scenario

1. **Developer / PM** invokes `merge resolve` with one resolution per outstanding conflict (or a global `--strategy` that applies the same choice to all).
2. **System** loads the MR and verifies `status=OPEN`, and that the supplied `base_revision` matches the MR's current state.
3. **System** validates each resolution: every conflict descriptor in the MR has exactly one matching resolution; every `MANUAL` resolution carries a non-null `value` payload that conforms to the entity's schema.
4. **System** for each resolution computes the post-resolution field/value: `MINE` keeps the target-branch value, `THEIRS` adopts the source-branch value, `MANUAL` uses `value`.
5. **System** re-checks lock conflicts on every touched entity (a HARD lock acquired after the MR was opened still blocks merge).
6. **System** within one transaction writes a new `Revision` per touched entity on `main` reflecting the resolved values, advances `main.head_revision_ids`, sets MR `status=MERGED` with `resolved_at=now()`, and sets the source branch `status=MERGED` with `merged_at=now()`.
7. **System** returns the merged MR with the list of new revision ids and `suggested_next_actions` pointing at `vspec usecase show <KEY>`.

## Extensions

### 2a. Caller's `base_revision` is stale (MR has been resolved or re-opened with new conflicts since)

- 2a1. **System** detects the supplied `base_revision` does not match the MR's current revision.
- 2a2. **System** returns 409 with `current_revision` and the refreshed conflict list.
- 2a3. **System** includes `vspec merge show <id>` in `suggested_next_actions` so the caller can re-pull and resubmit.
- (Outcome: FAILURE — use case ends; resolver retries with fresh base.)

### 3a. A `MANUAL` resolution is missing its `value` payload

- 3a1. **System** returns 400 listing the offending conflict entity id and field.
- 3a2. **System** includes a `vspec merge show <id>` hint so the caller can view the original conflict.
- (Outcome: FAILURE — use case ends; no merge.)

### 3b. The resolution list does not cover every outstanding conflict

- 3b1. **System** returns 422 listing the uncovered conflicts.
- 3b2. **System** suggests rerunning with the full resolution list.
- (Outcome: FAILURE — use case ends; MR unchanged.)

### 5a. A HARD lock was acquired on a touched entity after the MR opened

- 5a1. **System** detects the lock and aborts before any write.
- 5a2. **System** returns 409 with the holding session id and `vspec who <KEY>` as a suggested next action.
- 5a3. **System** leaves the MR `OPEN` so the caller can retry once the lock clears.
- (Outcome: FAILURE — use case ends; no state change.)

### \*a. Transactional failure during step 6

- \*a1. **System** ensures the per-entity revision writes, `main.head_revision_ids` update, MR status change, and branch status change happen atomically; on failure all four roll back together.
- \*a2. **System** returns exit code 5 with a retry hint; MR stays `OPEN`.
- (Outcome: FAILURE — use case ends; `main` is unchanged.)

## Success Guarantee

The MR is `status=MERGED` with `resolved_at` set. One new `Revision` per touched entity exists on `main` carrying the resolved field values. `main.head_revision_ids` is advanced for every touched entity. The source branch is `status=MERGED`.

## Minimal Guarantee

On any failure the MR remains `status=OPEN` with its original conflict list intact, `main` is unchanged, and no source-branch revisions are lost. Re-pulling the MR and retrying with a fresh `base_revision` is always safe.

## Notes

- API: `POST /v1/merges/:id/resolve` (see `docs/06-api-contract.md`).
- CLI: `vspec merge resolve` (see `docs/07-cli-spec.md`).
- Conflict types and detection: `docs/01-architecture.md` (Merges).
- Optimistic concurrency convention: every write requires `base_revision`; see `docs/06-api-contract.md` conventions.
- Companion: UC-020 produces the conflict list this UC consumes; UC-022 explains the HARD-lock that may block extension 5a.
