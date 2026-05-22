---
vspec_format: 1
type: usecase
id: UC-013
key: VSPEC-013
title: Edit a use case step
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Edit a use case step

> The developer/PM modifies a single `Step`: its `actor_id`, its `action`, or its `notes`. The change produces a new `Revision`. Because changing `action` or `actor_id` rewrites the contract for consumers, the system classifies the impact as `BREAKING` and notifies any active `WorkSession` that has the parent use case pinned.

## Stakeholders and Interests

- **Developer / PM**: corrects a step in place without rewriting the surrounding scenario. _(Protected by: steps 2 and 4.)_
- **AI Coding Agent (pinned session)**: is notified when a step they have pinned shifts semantically, so they can refresh or finish their in-flight task before invalidation. _(Protected by: step 6.)_
- **Reviewer**: sees the diff in `vspec history` and the impact severity in `vspec impact`. _(Protected by: success guarantee.)_
- **Vooster**: enforces the severity classification rules in `docs/05-data-model.md` exactly — `action` changes are `BREAKING`, `notes` typos are `COSMETIC`. _(Protected by: step 5.)_

## Preconditions

- The target `Step` exists and its parent `UseCase` is not archived.
- The developer/PM has write permission and is editing on a branch where the use case is not `HARD`-locked by another holder.
- The caller has provided the current `base_revision` for optimistic concurrency.

## Trigger

The developer/PM runs `vspec step edit <step-id>` (opens `$EDITOR`) or `vspec step edit <step-id> --actor <name> --action "<verb phrase>"`.

## Main Success Scenario

1. **Developer / PM** invokes the step-edit command with the step id and one or more of `--actor`, `--action`, `--notes`.
2. **System** loads the step and confirms `base_revision` matches the use case's current revision.
3. **System** validates each changed field: actor must resolve, action must be non-empty active voice.
4. **System** applies the change to the `Step` row.
5. **System** classifies the impact: `action` change → `BREAKING`; `actor_id` change → `BREAKING`; `notes`-only change → `COSMETIC`; everything else per `docs/05-data-model.md`.
6. **System** enumerates `ACTIVE` `WorkSession`s whose `pinned_revisions` reference this use case and marks them "affected" in the resulting impact payload.
7. **System** writes a new `Revision` for the use case with the change summary and severity.
8. **System** returns the new revision id, the severity, and the list of notified sessions.

## Extensions

### 2a. `base_revision` is stale (optimistic concurrency conflict)

- 2a1. **System** returns 409 with the current revision id and a structured diff.
- 2a2. **System** suggests `vspec usecase show <KEY-NNN>` followed by re-running the edit against the new base.
- (Outcome: FAILURE — use case ends; no write.)

### 3a. Action is empty or fails the active-voice heuristic

- 3a1. **System** rejects empty actions (exit code 2).
- 3a2. **System** warns on passive constructions ("is processed") and offers a rewrite; `--force` overrides the warning.
- (Outcome: PARTIAL — rejoins main at step 4 once corrected or forced; FAILURE on empty.)

### 5a. Use case is SEMANTIC-locked by another holder

- 5a1. **System** allows `notes`-only edits (COSMETIC) but blocks `action` or `actor_id` changes.
- 5a2. **System** returns 409 with the lock holder, reason, and `expires_at`.
- (Outcome: FAILURE for semantic changes — use case ends until the lock is released.)

### 6a. Active sessions exist that pin this use case

- 6a1. **System** still proceeds with the write.
- 6a2. **System** records each affected `WorkSession` id in the impact payload's `affected_sessions[]`.
- 6a3. **System** delivers an in-band notice in the next `vspec status` / `--format=agent` payload for those sessions per the rule in `docs/05-data-model.md`.
- (Outcome: PARTIAL — rejoins main at step 7; pinned agents finish their in-flight work against the old revision.)

### \*a. Use case is HARD-locked

- \*a1. **System** refuses all edits regardless of field.
- \*a2. **System** points at `vspec unlock` or contact-the-holder messaging.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

The targeted `Step` row reflects the requested change, a new `Revision` of the parent `UseCase` exists with the correct severity, and every `ACTIVE` session pinning this use case has been recorded as affected in the impact payload.

## Minimal Guarantee

On failure (stale base revision, hard lock, validation error), the step is unchanged, no revision is written, and no session is falsely notified.

## Notes

- API: `PATCH /v1/steps/:id` (body must include `base_revision`).
- CLI: `vspec step edit <id>` (see `docs/07-cli-spec.md`).
- Severity classification rules: `docs/05-data-model.md` "Severity Classification Rules" — `Step.action` change and `Step.actor_id` change are both `BREAKING`.
- Session-notification rule: any change to a Revision whose entity is pinned by an `ACTIVE` session elevates that session to "affected" (same doc).
- Related: UC-022 (locks), UC-027 (impact analysis), UC-024 (history).
