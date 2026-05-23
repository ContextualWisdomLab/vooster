---
vspec_format: 1
type: usecase
id: UC-025
key: VSPEC-025
title: Compare two revisions of a use case
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Compare two revisions of a use case

> The developer/PM needs to understand precisely what changed between two snapshots of a use case before approving, reverting, or merging. The system produces an **entity-aware structural diff** (not a text diff) — comparing fields, scenarios, steps, and stakeholder interests — and classifies each individual change against the severity rules in `docs/05-data-model.md`.

## Stakeholders and Interests

- **Developer / PM**: sees exactly which fields, steps, and extensions changed between two revisions and gets a per-change severity label to inform a review decision. _(Protected by: steps 4 and 5.)_
- **AI Coding Agent**: can compute whether its pinned revision is still semantically valid relative to a newer head by inspecting BREAKING entries. _(Protected by: step 5.)_
- **Workspace Admin**: trusts that cross-branch comparisons are explicit so reviewers never mistake a branch divergence for a linear edit. _(Protected by: extension 3a.)_
- **Vooster**: enforces consistent severity classification across the product by routing every diff through the same rule table. _(Protected by: step 5.)_

## Preconditions

- The developer/PM is authenticated and holds at least `EDITOR` membership on the workspace.
- A current project is bound.
- Both `<rev1>` and `<rev2>` reference revisions for the named use case (or one of its child entities).

## Trigger

The developer/PM runs `vspec diff UC-XXX <rev1> <rev2>`.

## Main Success Scenario

1. **Developer / PM** invokes `vspec diff <KEY-NNN> <rev1> <rev2>` optionally passing `--format`.
2. **System** resolves the use case key and authorizes the caller for read.
3. **System** loads both revisions' `snapshot` JSON for the use case and its child entities.
4. **System** computes a structural diff per field, per scenario, per step, and per stakeholder interest, recording adds, removes, and field-level changes.
5. **System** classifies each change against the severity rules table in `docs/05-data-model.md` and tags it `COSMETIC`, `NON_BREAKING`, or `BREAKING`.
6. **System** renders a grouped diff with severity badges in `--format=human`, or a JSON `{changes: [...], summary: {breaking, non_breaking, cosmetic}}` payload in `--format=json|agent`.
7. **Developer / PM** inspects the diff and chooses a follow-up (`vspec revert`, `vspec impact`, `vspec merge open`).

## Extensions

### 2a. `<rev1>` or `<rev2>` does not exist

- 2a1. **System** returns 404 naming the missing revision and the use case it expected.
- 2a2. **System** suggests `vspec history <KEY-NNN>` to discover valid revision IDs.
- (Outcome: FAILURE — use case ends.)

### 3a. Revisions belong to different branches

- 3a1. **System** detects that `rev1.branch_id != rev2.branch_id`.
- 3a2. **System** emits a `cross_branch=true` warning at the top of the output and labels each change with its source branch.
- 3a3. **System** still computes and returns the structural diff so the caller can inspect divergence.
- (Outcome: PARTIAL — rejoins main at step 4 with cross-branch warning included.)

### 4a. The two revisions are identical (same `content_hash`)

- 4a1. **System** returns an empty `changes` array and a `summary` of all zeroes.
- 4a2. **System** notes in `--format=human` output that the revisions match byte-for-byte.
- (Outcome: SUCCESS — use case ends with empty diff.)

### \*a. Caller lacks read access

- \*a1. **System** returns 403 without revealing whether either revision exists.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

The caller receives a structured, entity-aware diff of the two revisions in which every change carries one of the three severities defined by the data-model rules. No new revisions are created and no entity rows are mutated.

## Minimal Guarantee

The command is strictly read-only. On failure no diff is returned, no audit row written, and the local cache is untouched.

## Notes

- API: `GET /v1/usecases/:id/diff?from=&to=` (see `docs/06-api-contract.md`).
- CLI: `vspec diff <KEY-NNN> <rev1> <rev2>` (see `docs/07-cli-spec.md`).
- Severity rules: see the "Severity Classification Rules" table in `docs/05-data-model.md`.
- Sibling flows: UC-024 (history), UC-026 (revert), UC-027 (impact analysis).
