---
vspec_format: 1
type: usecase
id: UC-024
key: VSPEC-024
title: View a use case revision history
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# View a use case revision history

> The developer/PM needs to see how a use case has evolved — who changed what and when — including changes to its child entities (Scenarios, Steps, StakeholderInterests). The system aggregates every `Revision` row touching the use case or its dependents, orders them newest-first, and prints author, timestamp, and change summary so reviewers can trace decisions before editing or merging.

## Stakeholders and Interests

- **Developer / PM**: scans recent changes to a use case at a glance before editing, reviewing, or reverting, with optional truncation via `--limit`. _(Protected by: steps 4 and 5.)_
- **AI Coding Agent**: can determine whether the use case's behavior contract has shifted since a pinned revision, choosing whether to refresh the pin. _(Protected by: step 4 and success guarantee.)_
- **Workspace Admin**: trusts that history reads respect membership-level read access and never leak across projects. _(Protected by: extension 2a.)_
- **Vooster**: keeps the audit trail complete by including child-entity revisions, not just `UseCase` rows. _(Protected by: step 3.)_

## Preconditions

- The developer/PM is authenticated and holds at least `EDITOR` or `OWNER` membership on the use case's workspace.
- A current project is bound (via `.vspec/config.json` or `--project`).
- The target use case key resolves to a non-archived `UseCase` row.

## Trigger

The developer/PM runs `vspec history UC-XXX [--limit N]`.

## Main Success Scenario

1. **Developer / PM** invokes `vspec history <KEY-NNN>` optionally passing `--limit` and `--branch`.
2. **System** resolves the key to a `UseCase` within the current project and authorizes the caller.
3. **System** queries `Revision` rows for the use case and for every `Scenario`, `Step`, and `StakeholderInterest` whose parent traces back to it.
4. **System** orders the aggregated revisions by `created_at` descending and joins author names from `User`.
5. **System** truncates the result to `--limit` (default 50, max 200) and records whether more rows exist.
6. **System** renders a table with columns `revision`, `entity_type`, `entity_id`, `author`, `timestamp`, `change_summary` in `--format=human`, or the equivalent JSON in `--format=json|agent`.
7. **Developer / PM** reads the history and picks a follow-up action (`vspec diff`, `vspec revert`, `vspec usecase show --revision=...`).

## Extensions

### 2a. Use case not found in the current project

- 2a1. **System** returns 404 with the project key it searched and a `vspec usecase list` hint.
- (Outcome: FAILURE — use case ends.)

### 2b. Caller lacks read access on the workspace

- 2b1. **System** returns 403 without revealing whether the key exists.
- 2b2. **System** suggests `vspec login` or `vspec member set-role` in the next-actions hint.
- (Outcome: FAILURE — use case ends.)

### 5a. History exceeds `--limit`

- 5a1. **System** appends a truncation marker and the count of suppressed rows.
- 5a2. **System** suggests rerunning with a larger `--limit` or paginating via `--cursor`.
- (Outcome: PARTIAL — rejoins main at step 6 with truncated data.)

### *a. Network or server error

- *a1. **System** exits with code 5 and a retry hint; no local state is mutated.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

The caller receives a newest-first list of revisions touching the use case and its child entities, each annotated with author, timestamp, and change summary. The list is bounded by `--limit` and clearly flagged when truncated. No revisions are written.

## Minimal Guarantee

On any failure the command is read-only: no `Revision`, `UseCase`, or audit row is created or altered. Authentication tokens are never echoed.

## Notes

- API: `GET /v1/usecases/:id/revisions?branch=&cursor=&limit=` (see `docs/06-api-contract.md`).
- CLI: `vspec history <KEY-NNN>` (see `docs/07-cli-spec.md`).
- Data model: aggregation traverses `Revision.entity_type` ∈ {USECASE, SCENARIO, STEP, STAKEHOLDER_INTEREST} per `docs/05-data-model.md`.
- Sibling flows: UC-025 (compare revisions), UC-026 (revert), UC-027 (impact analysis).
