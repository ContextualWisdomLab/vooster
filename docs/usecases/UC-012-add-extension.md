---
vspec_format: 1
type: usecase
id: UC-012
key: VSPEC-012
title: Add an extension flow
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Add an extension flow

> Real systems are not just happy paths. The developer/PM attaches an `EXTENSION` `Scenario` at a specific `extension_point` (e.g. `3a`, `*b`) to the use case, with a condition that triggers the deviation and an outcome that closes it (SUCCESS, FAILURE, or PARTIAL rejoining a step in the main scenario).

## Stakeholders and Interests

- **Developer / PM**: documents the real edge cases — validation failure, third-party timeout, permission denial — without disrupting the main scenario. _(Protected by: steps 3 and 5.)_
- **AI Coding Agent**: receives a complete behavioral contract that covers both success and failure paths, enabling test generation for negative cases. _(Protected by: success guarantee.)_
- **Reviewer**: sees each deviation tied to a specific step in the main scenario via the `extension_point` convention. _(Protected by: extension 3b.)_
- **Vooster**: enforces extension point syntax (`^\d+[a-z]$` or `^\*[a-z]$`) and that the referenced step exists. _(Protected by: extensions 3a and 3b.)_

## Preconditions

- The target `UseCase` exists and has a `MAIN_SUCCESS` scenario (per UC-011).
- The `parent_step_number` referenced by the extension point exists, or the extension point uses `*` (any-step).
- The developer/PM has write permission on the project.

## Trigger

The developer/PM runs `vspec scenario add <KEY-NNN> --type extension --at <step>a --condition "<text>" --outcome failure|success|partial`.

## Main Success Scenario

1. **Developer / PM** invokes the scenario-add command specifying the extension point, condition, and outcome.
2. **System** validates the extension-point syntax against `^\d+[a-z]$` or `^\*[a-z]$`.
3. **System** verifies the `parent_step_number` (parsed from the digits prefix) exists in the main scenario, or treats `*` as any-step.
4. **System** verifies no existing extension already occupies the same `extension_point` for this use case.
5. **System** creates the `Scenario` row with `type = EXTENSION`, the supplied `condition`, the chosen `outcome`, and a calculated `order_index`.
6. **Developer / PM** adds one or more substeps via `vspec step add`, each with an actor and verb-phrase action.
7. **System** writes a `Revision` for the use case (severity `NON_BREAKING` — adding a new extension does not break consumers).
8. **System** prints the formatted extension and reminds the user to set an outcome line if not already provided.

## Extensions

### 2a. Extension point syntax is invalid

- 2a1. **System** rejects ids that do not match the regex (e.g. `3`, `3A`, `step3a`).
- 2a2. **System** prints the valid forms with examples (`3a`, `7c`, `*a`).
- (Outcome: FAILURE — use case ends.)

### 3b. Referenced parent step does not exist

- 3b1. **System** reports that step `<N>` is out of range of the main scenario.
- 3b2. **System** suggests `vspec usecase show <KEY-NNN>` to inspect step numbering.
- (Outcome: FAILURE — use case ends.)

### 4a. Extension point already taken

- 4a1. **System** returns 409 with the existing extension's condition text.
- 4a2. **System** suggests the next free letter (e.g. `3b` if `3a` is taken).
- (Outcome: FAILURE — use case ends.)

### 5a. Outcome flag omitted

- 5a1. **System** defaults `outcome` to `FAILURE` per `docs/08-file-format.md`.
- 5a2. **System** emits a warning so the developer/PM can confirm or override with `vspec scenario edit`.
- (Outcome: PARTIAL — rejoins main at step 6.)

## Success Guarantee

A new `Scenario` row exists with `type = EXTENSION`, a valid `extension_point`, a `condition`, an `outcome`, and a `parent_step_number`. The use case has a new `Revision` recording the addition. The extension is rendered in the use case markdown under `## Extensions` in canonical order.

## Minimal Guarantee

On failure, no `Scenario` is partially created; the use case's existing scenarios and revision chain are unchanged. Extension-point uniqueness within a use case is preserved.

## Notes

- API: `POST /v1/usecases/:id/scenarios`.
- CLI: `vspec scenario add` (see `docs/07-cli-spec.md`).
- Extension grammar: `docs/03-cockburn-method.md` and `docs/08-file-format.md`.
- Removing or modifying an existing extension is a BREAKING change per `docs/05-data-model.md` and is covered by UC-013 / UC-027.
