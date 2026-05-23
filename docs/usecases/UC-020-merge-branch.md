---
vspec_format: 1
type: usecase
id: UC-020
key: VSPEC-020
title: Merge a branch
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Merge a branch

> A developer/PM wants to land the spec changes from a feature or session branch into `main`. vspec computes the merge strategy (`FAST_FORWARD` if `main` has not advanced since the branch was created, else `SQUASH`), runs impact analysis, and detects conflicts at three layers (lock, structural, semantic). If the merge is clean, it lands immediately; if not, the MR stays `OPEN` for `resolve` (UC-021).

## Stakeholders and Interests

- **Developer / PM**: gets a deterministic merge outcome with full impact visibility before any write to `main`. _(Protected by: steps 3 and 4.)_
- **AI Coding Agent**: never has its pinned revisions silently invalidated by a merge — affected sessions are listed in the impact and the human supervisor decides whether to land. _(Protected by: step 3.)_
- **Branch Owner**: their work is never partially merged; either every changed entity lands together or none does. _(Protected by: step 6 and Minimal Guarantee.)_
- **Vooster**: a `MergeRequest` row is always created (even for fast-forward) so the merge is auditable; conflicts are surfaced, not papered over. _(Protected by: step 2 and extension 4a.)_

## Preconditions

- The caller is authenticated and has `EDITOR` or `OWNER` membership in the project.
- The source branch exists in `status=ACTIVE`.
- The target branch is `main` (only legal target in MVP).

## Trigger

The developer/PM runs `vspec merge open <branch> [--into main] [--strategy fast-forward|squash]`.

## Main Success Scenario

1. **Developer / PM** invokes `merge open` against a source branch.
2. **System** creates a `MergeRequest` row with `status=OPEN`, `source_branch_id`, `target_branch_id=<main.id>`, `created_by=<caller>`.
3. **System** computes impact: for every entity whose head differs from `main`, classifies severity per the rules in `docs/05-data-model.md` and lists affected sessions and branches.
4. **System** detects conflicts at three layers — lock conflicts (target entity HARD-locked elsewhere), structural conflicts (same field changed on both sides to different values), semantic conflicts (both sides added an extension at the same `extension_point` with different content).
5. **System** chooses strategy: `FAST_FORWARD` when `main`'s head for each touched entity equals the branch's `base_revision_ids[entity]`, else `SQUASH`. The caller's `--strategy` flag downgrades but cannot upgrade to fast-forward.
6. **System** when `conflicts` is empty: for each touched entity writes a new `Revision` on `main` (one per entity for fast-forward, one squashed per entity for squash), advances `main.head_revision_ids`, sets the MR to `status=MERGED` and `resolved_at=now()`, sets the source branch to `status=MERGED` and `merged_at=now()`.
7. **System** returns the MR with strategy, impact, conflict list (possibly empty), and `suggested_next_actions` pointing at `vspec merge show <id>` or `vspec merge resolve <id>` when conflicts exist.

## Extensions

### 4a. Structural conflict on at least one entity

- 4a1. **System** populates `MergeRequest.conflicts` with a per-entity descriptor: `{ entity_type, entity_id, field, mine_value, theirs_value }`.
- 4a2. **System** stops before any write to `main`, leaving the MR `OPEN`.
- 4a3. **System** returns the conflict list with `suggested_next_actions` pointing at `vspec merge resolve <id>`.
- (Outcome: PARTIAL — rejoins main at step 7; resolution happens in UC-021.)

### 4b. Lock conflict — target entity HARD-locked by another session

- 4b1. **System** detects an active `HARD` `Lock` on a target entity held by a different session.
- 4b2. **System** returns 409 with the holding session id and `vspec who <KEY>` as a suggested next action.
- 4b3. **System** leaves the MR `OPEN` so the caller can retry once the lock is released.
- (Outcome: FAILURE — use case ends until the lock clears.)

### 4c. Semantic conflict — both sides added an extension at the same point

- 4c1. **System** records a semantic conflict descriptor (`extension_point`, mine scenario, theirs scenario).
- 4c2. **System** stops before any write to `main` and leaves the MR `OPEN`.
- (Outcome: PARTIAL — rejoins main at step 7; UC-021 handles resolution.)

### 5a. Caller passed `--strategy=fast-forward` but `main` has advanced

- 5a1. **System** detects that one or more `main.head_revision_ids` no longer equal the branch's `base_revision_ids`.
- 5a2. **System** rejects with 422 and suggests `vspec merge open <branch> --strategy squash`.
- (Outcome: FAILURE — use case ends; MR is aborted before write.)

### \*a. Transactional failure during the write phase (step 6)

- \*a1. **System** ensures the revision writes, `main.head_revision_ids` advance, MR status change, and branch status change happen in one transaction; on failure all four roll back together.
- \*a2. **System** returns exit code 5 with a retry hint; MR remains `OPEN`.
- (Outcome: FAILURE — use case ends; `main` is unchanged.)

## Success Guarantee

A `MergeRequest` row exists with strategy, impact, and conflict list populated. When conflicts were empty, the MR is `status=MERGED`, the source branch is `status=MERGED`, and `main` has one new `Revision` per touched entity with `main.head_revision_ids` advanced accordingly.

## Minimal Guarantee

On any failure `main` is not partially advanced: either every touched entity gets its new head revision (clean merge) or none does. The source branch's `head_revision_ids` are never lost; an aborted MR can be retried.

## Notes

- API: `POST /v1/merges`, `POST /v1/branches/:id/preview-merge` (see `docs/06-api-contract.md`).
- CLI: `vspec merge open`, `vspec merge preview` (see `docs/07-cli-spec.md`).
- Conflict layers: `docs/01-architecture.md` (Merges).
- Severity rules: `docs/05-data-model.md` (Severity Classification Rules).
- Companion: UC-021 resolves the conflicts produced by extensions 4a and 4c.
