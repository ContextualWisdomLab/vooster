---
vspec_format: 1
type: usecase
id: UC-027
key: VSPEC-027
title: Analyze the impact of a proposed change
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Analyze the impact of a proposed change

> Before committing an edit, the developer/PM (or an AI agent acting on their behalf) needs to know how disruptive it will be. The system computes a deterministic, rule-based impact report — severity plus the lists of affected sessions, branches, and pinned tests — so multi-agent work doesn't silently invalidate in-flight coding sessions. This is the central safety primitive for vspec's multi-agent model.

## Stakeholders and Interests

- **Developer / PM**: gets a structured impact report (severity + affected sessions + affected branches + affected tests) before deciding to commit. _(Protected by: steps 5 and 6.)_
- **AI Coding Agent**: never has its pinned snapshot invalidated without notice; an analysis returning `BREAKING` with the agent's session listed signals "stop and re-pin." _(Protected by: step 5.)_
- **Workspace Admin**: trusts that the same proposed change always yields the same impact report, making reviews deterministic. _(Protected by: extension 4a.)_
- **Vooster**: keeps multi-agent safety as a first-class concern of the data model by routing every commit through this analysis. _(Protected by: success guarantee.)_

## Preconditions

- The developer/PM is authenticated and holds at least `EDITOR` membership.
- A current project is bound.
- The target use case exists; if `--proposed-change` is supplied the file is readable.

## Trigger

The developer/PM runs `vspec impact UC-XXX [--proposed-change <file>]`.

## Main Success Scenario

1. **Developer / PM** invokes `vspec impact <KEY-NNN>` optionally passing `--proposed-change <file>`.
2. **System** resolves the use case key and authorizes the caller for read.
3. **System** loads the current head snapshot and, if `--proposed-change` was supplied, parses the file into a candidate snapshot using the `docs/08-file-format.md` rules.
4. **System** computes a content-addressed input hash over `(head_revision_id, proposed_snapshot_hash)` to enable caching.
5. **System** runs the severity classifier from `docs/05-data-model.md` against each field/scenario/step/interest delta and rolls up the worst severity.
6. **System** collects `affected_sessions` (every `ACTIVE` `WorkSession` whose `pinned_revisions` references any touched entity), `affected_branches` (open branches whose base or head touches the entity), and `affected_tests` (Gherkin features previously exported from this use case).
7. **System** returns a `ChangeImpact` payload `{severity, affected_sessions[], affected_branches[], affected_tests[], confidence: 1.0, input_hash}` and suggested next actions (`vspec lock`, `vspec session list`, `vspec changes/commit`).

## Extensions

### 3a. `--proposed-change` file is missing or unreadable

- 3a1. **System** returns a 400-class CLI error with the path it tried.
- 3a2. **System** suggests verifying the path or re-running without `--proposed-change` to analyze the current head only.
- (Outcome: FAILURE — use case ends.)

### 3b. `--proposed-change` file fails the file-format parser

- 3b1. **System** returns 400 with the first parser error (frontmatter or section) and a `vspec doctor <file>` hint.
- (Outcome: FAILURE — use case ends.)

### 6a. Active sessions are affected

- 6a1. **System** rolls severity up to at least `BREAKING` when any active session pins a touched entity.
- 6a2. **System** lists each affected session by ID, owner, agent type, and pinned revision so the caller can coordinate.
- (Outcome: PARTIAL — rejoins main at step 7 with `severity = BREAKING` and a non-empty `affected_sessions` array.)

### 4a. A cached report exists for the same input hash

- 4a1. **System** returns the cached `ChangeImpact` and marks `cached = true` in the payload.
- 4a2. **System** guarantees the cached result is byte-identical to a fresh recomputation (idempotence on same input).
- (Outcome: SUCCESS — rejoins main at step 7.)

### *a. Caller lacks read access on the workspace

- *a1. **System** returns 403 without disclosing the existence of the use case or any sessions.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

The caller receives a complete, deterministic `ChangeImpact` payload for the requested use case (and optional proposed change). For the same input hash the payload is bit-identical across runs. No revisions are written and no sessions are mutated.

## Minimal Guarantee

The command is strictly read-only with respect to domain entities. On failure no `Revision`, `WorkSession`, `SpecBranch`, or `Lock` row is created or modified. The optional cache, if used, is keyed by input hash and never returns stale results for different inputs.

## Notes

- API: `POST /v1/changes/preview` (see `docs/06-api-contract.md`).
- CLI: `vspec impact <KEY-NNN> [--proposed-change <file>]` (see `docs/07-cli-spec.md`).
- Severity rules: `docs/05-data-model.md` — "Severity Classification Rules".
- Rule-based only in MVP; the `confidence` field is `1.0` always and reserved for a future AI-backed `ImpactAnalysisPort` implementation (see `docs/01-architecture.md`).
- Sibling flows: UC-024 (history), UC-025 (diff), UC-026 (revert).
