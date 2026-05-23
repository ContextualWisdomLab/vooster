---
vspec_format: 1
type: usecase
id: UC-010
key: VSPEC-010
title: Define stakeholder interests
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Define stakeholder interests

> Cockburn's unique value comes from naming, for each use case, every stakeholder and what they want protected. The developer/PM attaches `StakeholderInterest` rows that link a `UseCase` to a `Stakeholder` with an `interest` description and an optional `protection_mechanism` referencing the step or guarantee that honors it.

## Stakeholders and Interests

- **Developer / PM**: enumerates each party that cares about this use case and records their interest in a single round trip. _(Protected by: steps 3 and 4.)_
- **Reviewer**: can see every stakeholder's stake at review time, not just the primary actor's. _(Protected by: success guarantee.)_
- **Vooster**: enforces the "at least one StakeholderInterest" rule before a use case can leave `DRAFT`. _(Protected by: extension 5a.)_
- **Regulator (where applicable)**: is explicitly named when a regulatory stakeholder exists, so compliance interests are traceable per use case. _(Protected by: step 4.)_

## Preconditions

- The target `UseCase` exists and is not archived.
- The named `Stakeholder` exists in the same project (created via UC-006).
- The developer/PM has write permission on the project.

## Trigger

The developer/PM runs `vspec usecase add-stakeholder <KEY-NNN> --stakeholder <name> --interest "<text>"`.

## Main Success Scenario

1. **Developer / PM** invokes the add-stakeholder command with the use case key, stakeholder name, and interest text.
2. **System** resolves the use case key and stakeholder name to their internal ids.
3. **System** verifies no existing `StakeholderInterest` row matches `(usecase_id, stakeholder_id)`.
4. **System** persists the new `StakeholderInterest` with the supplied `interest` and optional `protection_mechanism`.
5. **System** writes a `Revision` for the `UseCase` recording the addition (severity `NON_BREAKING`).
6. **System** echoes the updated stakeholder list and a hint for the next missing role (e.g. "no regulatory stakeholder yet").

## Extensions

### 3a. Interest for this stakeholder already exists

- 3a1. **System** returns 409 with the existing interest text.
- 3a2. **System** suggests `vspec usecase set ... --field stakeholder-interest` for editing in place.
- (Outcome: FAILURE — use case ends.)

### 4a. Removal flow (`--remove`)

- 4a1. **Developer / PM** invokes the command with `--remove` and the stakeholder name.
- 4a2. **System** deletes the matching `StakeholderInterest` row.
- 4a3. **System** writes a `Revision` with severity `BREAKING` (removing an interest weakens the contract per `docs/05-data-model.md`).
- (Outcome: SUCCESS — use case ends.)

### 5a. Removing the last interest leaves the use case with zero

- 5a1. **System** allows the removal but warns that the use case now fails the "≥1 StakeholderInterest" rule.
- 5a2. **System** blocks any subsequent `status` transition out of `DRAFT` until an interest is re-added.
- (Outcome: PARTIAL — rejoins main at step 6.)

### \*a. Stakeholder name does not resolve

- \*a1. **System** lists candidate names and points at `vspec stakeholder create` (UC-006).
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

A `StakeholderInterest` row links the use case and stakeholder with the supplied interest text. The use case has a new `Revision` reflecting the change, and the stakeholder count for this use case has increased by one.

## Minimal Guarantee

On failure, no `StakeholderInterest` row is created or partially mutated, and the use case's revision chain is unchanged.

## Notes

- API: `POST /v1/usecases/:id/stakeholder-interests` and `DELETE /v1/usecases/:id/stakeholder-interests/:siId`.
- CLI: `vspec usecase add-stakeholder` (see `docs/07-cli-spec.md`).
- Stakeholders are defined by UC-006 before being referenced here.
- Severity rules live in `docs/05-data-model.md` (add = NON_BREAKING, remove = BREAKING).
