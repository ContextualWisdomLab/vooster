---
vspec_format: 1
type: usecase
id: UC-031
key: VSPEC-031
title: Export a use case to markdown
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Export a use case to markdown

> The canonical renderer. A developer/PM runs `vspec export markdown UC-XXX` to render a `UseCase` to the on-disk format described in `docs/08-file-format.md`. The same renderer powers `vspec pull`, ensuring lossless round-trip: `serialize(parse(F)) === normalize(F)`. Output uses a stable section order so diffs are clean even for deeply-nested use cases with many extensions.

## Stakeholders and Interests

- **Developer / PM**: gets a markdown file ready to commit, edit, or share, with the same shape every time the same revision is exported. _(Protected by: steps 4–5 and Success Guarantee.)_
- **AI Coding Agent**: can re-parse the exported file losslessly with the same parser used by sync, with no field loss. _(Protected by: Success Guarantee.)_
- **CI/CD System**: runs `serialize(parse(F)) === normalize(F)` on every push and fails the build on silent drift — only possible because the exporter is deterministic. _(Protected by: step 5.)_
- **Vooster**: keeps a single source of truth for the file format — one renderer, used by both export and pull, so format drift is structurally impossible. _(Protected by: Notes and step 4.)_

## Preconditions

- The caller is authenticated and can read the target use case.
- The use case exists and is not archived.
- The use case has the minimal set of populated fields for its `format` (BRIEF, CASUAL, or FULLY_DRESSED).

## Trigger

The developer/PM runs `vspec export markdown <KEY-NNN> [--output specs/usecases/<KEY-NNN>.md] [--force]`.

## Main Success Scenario

1. **Developer / PM** invokes the export command with the use case key and optional `--output` path.
2. **System** resolves the use case at the current branch's head revision (or the session-pinned revision when `--session` is in effect), including all scenarios, steps, and stakeholder interests.
3. **System** assembles the YAML frontmatter (`vspec_format`, `type: usecase`, `id`, `key`, `title`, `level`, `format`, `status`, `priority`, `scope`, `primary_actor`, `revision`).
4. **System** emits sections in canonical order: Title, optional blurb, Stakeholders and Interests, Preconditions, Trigger, Main Success Scenario, Extensions, Success Guarantee, Minimal Guarantee, Notes.
5. **System** orders extensions deterministically (numeric `parent_step_number` ascending, then suffix `a`/`b`/`c` lexicographic, with `*a`/`*b` after numbered extensions), renumbers steps, and trims trailing whitespace.
6. **System** writes the rendered text to the `--output` path (or stdout when omitted) and prints a `suggested_next_actions` block.
7. **Developer / PM** commits or further edits the file.

## Extensions

### 4a. The use case is missing a required field for its declared `format`

- 4a1. **System** detects e.g. an empty `success_guarantee` on a FULLY_DRESSED use case.
- 4a2. **System** returns 422 with the offending field name and `vspec doctor <KEY-NNN>` as a suggested next action.
- (Outcome: FAILURE — use case ends; no file is written.)

### 6a. The `--output` file already exists

- 6a1. **System** refuses to overwrite without `--force` and prints the proposed change as a diff.
- 6a2. **Developer / PM** re-runs with `--force` or picks a different path.
- (Outcome: PARTIAL — rejoins main at step 6 on re-invocation.)

### 6b. The `--output` directory is not writable

- 6b1. **System** returns exit code 6 (local config error) and suggests fixing the path or permissions.
- (Outcome: FAILURE — use case ends.)

### 5a. Use case has many extensions referencing the same parent step

- 5a1. **System** applies a stable secondary sort (`a` before `b` before `c`) so the file diff is minimal across re-exports.
- 5a2. **System** verifies via a self-check that `parse(rendered)` yields the same `Scenario` set in the same order.
- (Outcome: SUCCESS — rejoins main at step 6.)

### *a. The requested revision is not found

- *a1. **System** returns 404 with `vspec history <KEY-NNN>` as a suggested next action.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

A markdown file (or stdout payload) exists matching `docs/08-file-format.md` exactly: valid frontmatter with the resolved `revision:`, all required body sections in canonical order, stable extension ordering. The round-trip identity `serialize(parse(F)) === normalize(F)` holds for the produced file.

## Minimal Guarantee

On any failure, no partial markdown file is written (atomic temp-and-rename). The server's revision history is never mutated by an export. The exporter never silently drops a field: missing data is an error, not an omission.

## Notes

- API: `POST /v1/usecases/:id/export/markdown` (see `docs/06-api-contract.md`).
- CLI: `vspec export markdown` (see `docs/07-cli-spec.md`).
- Format authority: `docs/08-file-format.md` (sections, ordering, conflict markers, round-trip).
- Companion: UC-029 (sync — uses the same renderer for pull); UC-030 (gherkin export).
