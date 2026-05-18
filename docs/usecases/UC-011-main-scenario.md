---
vspec_format: 1
type: usecase
id: UC-011
key: VSPEC-011
title: Write the main success scenario
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Write the main success scenario

> The developer/PM populates the spine of the use case: the ordered list of `Step`s under a single `Scenario` of type `MAIN_SUCCESS`. Each step names an `Actor` and a verb-phrase `action`. This is where the contract becomes executable: Gherkin generation, impact analysis, and session pinning all key off these steps.

## Stakeholders and Interests

- **Developer / PM**: drafts the canonical happy path as a contiguous numbered list without fighting the editor. _(Protected by: steps 2 and 4.)_
- **AI Coding Agent**: gets a stable, ordered set of steps to implement against, with each step traceable to a single actor. _(Protected by: success guarantee.)_
- **Reviewer**: can read the scenario top-to-bottom and see active-voice prose with one actor per step. _(Protected by: extension 3a.)_
- **Vooster**: enforces "exactly one `MAIN_SUCCESS` scenario per use case" and "each step has actor + action" at write time. _(Protected by: extensions 2a and 3b.)_

## Preconditions

- The target `UseCase` exists, is not archived, and has at least one stakeholder interest (UC-010).
- The actors referenced by the steps already exist in the project (created via UC-005).
- The developer/PM has write permission on the project.

## Trigger

The developer/PM runs `vspec scenario add <KEY-NNN> --type main-success` followed by one or more `vspec step add` invocations, or edits the markdown file directly and runs `vspec push`.

## Main Success Scenario

1. **Developer / PM** requests creation of the main success scenario for the use case.
2. **System** verifies no `MAIN_SUCCESS` scenario already exists for this use case.
3. **System** creates the `Scenario` row with `type = MAIN_SUCCESS`, `outcome = SUCCESS`, and `order_index = 0`.
4. **Developer / PM** adds steps one at a time, each with an actor name and a verb-phrase action.
5. **System** resolves each actor name against the project's `Actor` registry and rejects unknown names.
6. **System** assigns contiguous 1-based `step_number` values and persists each `Step` row.
7. **System** writes a `Revision` for the `UseCase` summarizing the scenario authoring (severity `NON_BREAKING` for additions).
8. **System** prints the resulting numbered scenario and warns if the count exceeds nine steps.

## Extensions

### 2a. A MAIN_SUCCESS scenario already exists

- 2a1. **System** returns 409 with the existing scenario id.
- 2a2. **System** suggests `vspec step add` to extend the existing scenario or `vspec scenario edit` to modify it.
- (Outcome: FAILURE — use case ends.)

### 3b. Step action is empty or passive-voice

- 3b1. **System** rejects empty actions outright (exit code 2).
- 3b2. **System** warns on passive constructions ("is submitted") and suggests an active rewrite; `--force` overrides the warning.
- (Outcome: PARTIAL — rejoins main at step 5 on a corrected action or with `--force`; FAILURE on empty action.)

### 5a. Actor not registered in the project

- 5a1. **System** lists known actors and points at `vspec actor create` (UC-005).
- 5a2. **System** does not persist the step.
- (Outcome: FAILURE for that step — use case ends until the actor is created.)

### 6a. Step count exceeds the recommended maximum

- 6a1. **System** still persists the step but warns that scenarios over nine steps usually indicate the use case should be split.
- (Outcome: PARTIAL — rejoins main at step 7.)

## Success Guarantee

The use case has exactly one `Scenario` row with `type = MAIN_SUCCESS` and a contiguous, ordered set of `Step` rows, each with a valid `actor_id` and non-empty `action`. A `Revision` records the new scenario state.

## Minimal Guarantee

On failure, no orphan `Scenario` is created without at least the explicit successful first transaction, and no `Step` is persisted with an unresolved actor. Step numbering is never left non-contiguous.

## Notes

- API: `POST /v1/usecases/:id/scenarios` and `POST /v1/scenarios/:id/steps`.
- CLI: `vspec scenario add` and `vspec step add` (see `docs/07-cli-spec.md`).
- Steps must reference Actors created via UC-005.
- Editing individual steps later is covered by UC-013; extensions are covered by UC-012.
