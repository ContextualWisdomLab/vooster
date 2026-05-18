---
vspec_format: 1
type: usecase
id: UC-014
key: VSPEC-014
title: Search and filter use cases
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Search and filter use cases

> The developer/PM (or an AI agent) browses the project's catalog of use cases. The list endpoint supports a full-text query (`q`) plus filters on `status`, `level`, and `actor_id`, with opaque cursor pagination. Each result returns a preview suitable for selecting the right use case to open, pin, or edit.

## Stakeholders and Interests

- **Developer / PM**: finds the right use case quickly by partial title or trigger phrase, narrowed by lifecycle status. _(Protected by: steps 2 and 3.)_
- **AI Coding Agent**: enumerates pinnable use cases for a given primary actor to choose what to pin at session start. _(Protected by: success guarantee.)_
- **Workspace Admin**: trusts that archived use cases are hidden by default but discoverable with `--include-archived`. _(Protected by: extension 2a — cross-reference UC-015.)_
- **Vooster**: ensures pagination is cursor-based (opaque, stable under inserts) and that result counts do not bias toward recently-edited entries. _(Protected by: step 5.)_

## Preconditions

- The developer/PM is authenticated and has at least `EDITOR` membership on the project.
- A current project is bound.

## Trigger

The developer/PM runs `vspec usecase list [--status=] [--level=] [--actor=] [--q=]` (or `vspec usecase search <q>`).

## Main Success Scenario

1. **Developer / PM** invokes the list command with zero or more of `--q`, `--status`, `--level`, `--actor`, plus optional `--cursor` and `--limit`.
2. **System** parses filters: `status ∈ {DRAFT, IN_REVIEW, APPROVED, DEPRECATED}`, `level ∈ {SUMMARY, USER_GOAL, SUBFUNCTION}`, `actor` resolves to an actor id, `q` is matched full-text against `title` and `trigger`.
3. **System** composes the query, excluding rows where `archived_at IS NOT NULL` unless `--include-archived` is set.
4. **System** decodes the `cursor` (opaque base64 JSON of the last result's id and sort key) when present; otherwise starts at the head.
5. **System** retrieves up to `limit` rows (default 50, max 200) ordered by `key` ascending, deterministic across requests.
6. **System** returns each row as a preview: `key`, `title`, `status`, `level`, primary actor name, and a one-line trigger excerpt.
7. **System** includes `next_cursor` if more results remain, or null when the list is exhausted.
8. **Developer / PM** picks a result and invokes `vspec usecase show <KEY-NNN>` for the full record.

## Extensions

### 2a. Conflicting or unknown filter values

- 2a1. **System** rejects unknown enum values with a 400 listing the valid set.
- 2a2. **System** does not silently drop the filter.
- (Outcome: FAILURE — use case ends until the caller corrects the flag.)

### 2b. `--actor` does not resolve

- 2b1. **System** suggests `vspec actor list` and returns an empty result set with a hint.
- (Outcome: FAILURE — use case ends.)

### 4a. Cursor is malformed or stale

- 4a1. **System** rejects unparseable cursors as 400 with the message "cursor is opaque — pass exactly what the previous response returned".
- 4a2. **System** treats a cursor that points past the last row as an empty page (200 with `items: []` and `next_cursor: null`).
- (Outcome: PARTIAL on stale cursors — rejoins main at step 5 with an empty page; FAILURE on malformed cursors.)

### *a. No results match

- *a1. **System** returns `items: []` with `next_cursor: null`.
- *a2. **System** suggests broadening filters (`--status=DRAFT,IN_REVIEW`) or dropping `--q`.
- (Outcome: SUCCESS — use case ends.)

## Success Guarantee

The caller receives a deterministic, paginated list of use cases matching the supplied filters, excluding archived entries by default. Re-issuing the request with the returned `next_cursor` resumes from exactly the next unseen row, even if rows are inserted at the head of the catalog in between.

## Minimal Guarantee

On failure, no state is mutated and no partial result set is returned with a stale or invalid cursor that would cause silent skipping of rows on the next page.

## Notes

- API: `GET /v1/projects/:projectId/usecases?status=&level=&actor_id=&q=&cursor=&limit=`.
- CLI: `vspec usecase list` and `vspec usecase search` (see `docs/07-cli-spec.md`).
- Pagination contract: `cursor` is opaque base64 JSON, default `limit = 50`, max `200` (see `docs/06-api-contract.md`).
- Archived visibility: see UC-015 for archive semantics and `--include-archived`.
