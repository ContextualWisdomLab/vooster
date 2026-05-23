---
vspec_format: 1
type: usecase
id: UC-035
key: VSPEC-035
title: Propose a spec change (AI agent)
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: ai-coding-agent
---

# Propose a spec change (AI agent)

> The safe write path. An AI coding agent runs `vspec change propose` to submit a diff against a use case at a known `base_revision`. The server returns a `ChangePreview` — a non-committing artifact with a `preview_id`, a `severity` classification (COSMETIC / NON_BREAKING / BREAKING), and an `impact` report listing affected sessions. A human (or the same agent with `--auto-commit` on COSMETIC changes only) then calls `vspec change commit --preview-id <id>` to materialize the new `Revision`. Previews expire after 15 minutes.

## Stakeholders and Interests

- **AI Coding Agent**: produces a fully-analyzed preview before any commit, learning the blast radius of its proposed change without mutating state. _(Protected by: steps 4–6 and extension \*a.)_
- **Developer / PM**: retains a human-in-the-loop checkpoint for every NON*COSMETIC change, with severity and impact pre-computed. *(Protected by: step 7 and extension 6a.)\_
- **Other Active Sessions**: are explicitly listed in the `impact.affected_sessions` array when their pinned revisions are touched, so the human knows whom to coordinate with. _(Protected by: step 5 and Success Guarantee.)_
- **Vooster**: enforces "no write without preview" — every commit must reference a still-valid `preview_id`, structurally preventing agents from skipping impact analysis. _(Protected by: extensions 7a and 7b.)_

## Preconditions

- The caller is authenticated and holds an API key with `write` scope (or an `EDITOR`+ session cookie).
- The target use case exists, is not archived, and is not `HARD`-locked by another session.
- The agent has previously fetched the use case (UC-034) and knows its `base_revision`.

## Trigger

The agent runs `vspec change propose --usecase <KEY-NNN> --base-revision <rev> --patch <file.json> [--auto-commit]`, followed (in a separate step) by `vspec change commit --preview-id <id>`.

## Main Success Scenario

1. **AI Coding Agent** invokes `change propose` with the use case key, the `base_revision` it read in UC-034, and a structured patch.
2. **System** authenticates the caller, validates `write` scope, and loads the target use case.
3. **System** validates the patch against the entity schema (Zod), rejecting structurally invalid changes before any analysis.
4. **System** runs the rule-based impact analyzer from `docs/05-data-model.md` § "Severity Classification Rules" to compute `severity` (COSMETIC | NON_BREAKING | BREAKING).
5. **System** computes `impact.affected_sessions` by intersecting the touched entity ids with every `ACTIVE` session's `pinned_revisions`.
6. **System** persists a `ChangePreview` (server-side, not a `Revision`) with `preview_id`, `severity`, `impact`, `expires_at = now() + 15 minutes`, and the rendered diff; returns this envelope to the agent.
7. **AI Coding Agent** (or its human operator) reviews the preview; on approval invokes `vspec change commit --preview-id <id>` (or the original `change propose` finishes the commit when `--auto-commit` is set and severity is COSMETIC).
8. **System** on commit materializes a new `Revision` for each touched entity, advances the branch's `head_revision_ids`, and returns the new revision ids.

## Extensions

### 4a. The patch's `base_revision` is stale (a newer revision exists on the branch)

- 4a1. **System** returns 409 with `current_revision` and a fully-populated `impact` describing what changed since `base_revision`.
- 4a2. **System** suggests `vspec usecase show <KEY> --format=agent` to re-read and `vspec change propose` again against the fresh base.
- (Outcome: FAILURE — use case ends; no preview is persisted.)

### \*a. The preview has expired (older than 15 minutes) when commit is attempted

- \*a1. **System** detects `expires_at < now()` on the referenced `ChangePreview`.
- \*a2. **System** returns 410 (Gone) with `vspec change propose` as a suggested next action to regenerate.
- (Outcome: FAILURE — use case ends; no commit.)

### 7a. `commit` is called with no matching `preview_id`

- 7a1. **System** returns 400 with the message that every commit must reference a still-valid preview.
- 7a2. **System** suggests `vspec change propose` to generate one.
- (Outcome: FAILURE — use case ends.)

### 7b. `--auto-commit` was set but the analyzer classified the change as NON_BREAKING or BREAKING

- 7b1. **System** writes the preview successfully but refuses to auto-commit anything above COSMETIC.
- 7b2. **System** returns the preview with a warning instructing a human reviewer to run `vspec change commit --preview-id <id>` explicitly.
- (Outcome: PARTIAL — rejoins main at step 7 awaiting human commit.)

### 6a. The change affects pinned revisions of other active sessions

- 6a1. **System** still produces the preview but populates `impact.affected_sessions` with each session's id, owner, and pinned use case keys.
- 6a2. **System** suggests `vspec who <KEY-NNN>` as a coordination hint before commit.
- (Outcome: SUCCESS — rejoins main at step 7; commit remains the human's decision.)

### 2a. The target use case is HARD-locked by another session

- 2a1. **System** refuses the propose call with 409, listing the holding session.
- 2a2. **System** suggests `vspec who <KEY-NNN>` and (for owners) `vspec unlock`.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

After `propose`: a `ChangePreview` exists with a unique `preview_id`, an accurate `severity`, an `impact` report listing all affected sessions, and a 15-minute `expires_at`; no `Revision` has been written. After `commit` of a still-valid preview: new `Revision` rows exist for each touched entity, the branch head advances, and any session whose pin pointed at the prior revision remains pinned to that prior revision (sessions are not silently rebased).

## Minimal Guarantee

No `Revision` is ever written without a still-valid `preview_id` (structurally enforced by the commit endpoint). An expired or stale preview cannot accidentally commit. A failed propose or commit leaves no partial state: no `ChangePreview` on validation failure, no `Revision` on commit failure. Other sessions' pinned snapshots are never mutated by a commit, only by an explicit re-pin.

## Notes

- API: `POST /v1/changes/preview` and `POST /v1/changes/commit` (see `docs/06-api-contract.md`).
- CLI: `vspec change propose` / `vspec change commit` (see `docs/07-cli-spec.md`).
- Severity rules: `docs/05-data-model.md` § "Severity Classification Rules".
- Preview TTL: 15 minutes (kept short so impact stays representative of the current branch state).
- Companion: UC-016 (start session — establishes the pin context), UC-034 (fetch the spec to learn `base_revision`), UC-033 (ai-guide — teaches this flow).
