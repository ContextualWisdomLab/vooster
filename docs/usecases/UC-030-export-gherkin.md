---
vspec_format: 1
type: usecase
id: UC-030
key: VSPEC-030
title: Export a use case to Gherkin
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: ai-coding-agent
---

# Export a use case to Gherkin

> The bridge from spec to executable test. An AI coding agent (or CI job) runs `vspec export gherkin UC-XXX` to render the use case's main success scenario as a Gherkin `Feature` with a `Scenario` per outcome path, and each `Step` as a `Given/When/Then` line keyed by the step's actor and action. The output is deterministic so committed `.feature` files diff cleanly across revisions.

## Stakeholders and Interests

- **AI Coding Agent**: receives a `.feature` file that maps 1:1 to the pinned `UseCase` revision, so the tests it implements can never silently disagree with the spec. _(Protected by: steps 4–6 and Success Guarantee.)_
- **Developer / PM**: keeps `tests/*.feature` in lockstep with `specs/UC-*.md` without hand-translation. _(Protected by: step 6 and extension 5a.)_
- **CI/CD System**: re-exports on every push and fails the build when the generated `.feature` differs from the committed one, surfacing spec drift early. _(Protected by: Success Guarantee.)_
- **Vooster**: enforces that incomplete use cases cannot produce silently-wrong Gherkin (Cockburn requires a main success scenario and stakeholder interests). _(Protected by: extension 3a.)_

## Preconditions

- The caller is authenticated and can read the target use case (membership or read-scoped API key).
- The use case exists and is not archived.
- The use case is at `FULLY_DRESSED` or `CASUAL` format with at least a `MAIN_SUCCESS` scenario containing one or more steps.

## Trigger

The agent runs `vspec export gherkin <KEY-NNN> [--output tests/<KEY-NNN>.feature] [--force]`.

## Main Success Scenario

1. **AI Coding Agent** invokes the export command with the use case key and optional `--output` path.
2. **System** resolves the use case at the current branch's head revision (or the session-pinned revision when `--session` is in effect).
3. **System** loads the main success scenario, all extension scenarios, the primary actor, and every step's `actor_id`/`action`/`is_system_step`.
4. **System** renders the file: one `Feature:` line from the use case title, a `Background:` from `preconditions`, one `Scenario:` per outcome path (main success plus each extension), and one `Given`/`When`/`Then` per step keyed by the step's actor.
5. **System** orders scenarios deterministically (main first, then extensions by `extension_point` lexicographic order) so re-export yields a byte-identical file.
6. **System** writes the rendered text to the `--output` path (or stdout when omitted) and prints a `suggested_next_actions` block pointing at the test runner.
7. **AI Coding Agent** commits the `.feature` file alongside the implementation.

## Extensions

### 3a. The use case has no main success scenario or zero steps

- 3a1. **System** returns 422 with a structured error citing the missing required field.
- 3a2. **System** suggests `vspec doctor <KEY-NNN>` and the specific command to add the scenario (`vspec scenario add ... --type main-success`).
- (Outcome: FAILURE — use case ends; no file is written.)

### 6a. The `--output` directory does not exist or is not writable

- 6a1. **System** detects the missing or non-writable path before invoking the renderer.
- 6a2. **System** returns 400 (exit code 6 for local config error) and suggests creating the directory or fixing permissions.
- (Outcome: FAILURE — use case ends.)

### 6b. The `--output` file already exists

- 6b1. **System** refuses to overwrite without `--force` and prints a diff summary of the proposed change.
- 6b2. **AI Coding Agent** re-runs with `--force` or chooses a different path.
- (Outcome: PARTIAL — rejoins main at step 6 on re-invocation; nothing is mutated in the meantime.)

### 2a. The requested revision is not found (stale `--revision` flag)

- 2a1. **System** returns 404 with `vspec history <KEY-NNN>` as a suggested next action.
- (Outcome: FAILURE — use case ends.)

### \*a. The use case is archived

- \*a1. **System** refuses to export and suggests `vspec usecase restore <KEY-NNN>`.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

A Gherkin `.feature` file (or stdout payload) exists that deterministically reflects the resolved revision of the use case: one `Feature` per use case, one `Scenario` per outcome path, one `Given`/`When`/`Then` per step with the step's actor name preserved. Re-running the same export against the same revision produces a byte-identical file.

## Minimal Guarantee

On any failure, no partial `.feature` file is written: the renderer writes to a temp file and atomically renames on success. The server's revision history is never mutated by an export.

## Notes

- API: `POST /v1/usecases/:id/export/gherkin?format=feature` (see `docs/06-api-contract.md`).
- CLI: `vspec export gherkin` (see `docs/07-cli-spec.md`).
- Step model: see `Step.actor_id` and `Step.action` in `docs/05-data-model.md` — they make Gherkin generation actor-aware.
- Companion: UC-031 (markdown export), UC-029 (sync — same revision-resolution path).
