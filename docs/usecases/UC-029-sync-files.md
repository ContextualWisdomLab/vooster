---
vspec_format: 1
type: usecase
id: UC-029
key: VSPEC-029
title: Sync local files with the server
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Sync local files with the server

> The file-first bridge. A developer/PM (or the AI agent acting on the same checkout) runs `vspec pull`, `vspec push`, or `vspec sync` to reconcile the local `specs/` markdown tree with the server-side `Revision` history. Push uses each file's `base_revision` for optimistic concurrency; on conflict, the local file is rewritten with Git-style markers so a human can resolve before the next push.

## Stakeholders and Interests

- **Developer / PM**: edits specs in their editor of choice, then pushes with confidence that nothing on the server gets silently overwritten. _(Protected by: step 4 and extension 4a.)_
- **AI Coding Agent**: reads pinned revisions from `specs/` directly with filesystem tools, and notices conflict markers as a clear "do not proceed" signal. _(Protected by: extension 4a and Minimal Guarantee.)_
- **Workspace Admin**: trusts that all writes funnel through the same authorization and revision pipeline as the API and Web UI — files are not a second-class write path. _(Protected by: step 2 and extension \*a.)_
- **Vooster**: enforces the round-trip guarantee from `docs/08-file-format.md` — `serialize(parse(F)) === normalize(F)` — so file-driven edits stay losslessly typed. _(Protected by: step 3 and extension 3a.)_

## Preconditions

- The current working directory contains a valid `.vspec/config.json` binding to a project (UC-007).
- The caller is authenticated (`vspec login`) and has at least `EDITOR` membership in the bound workspace.
- The local `specs/` tree exists; on first pull it may be empty.

## Trigger

The developer/PM runs `vspec pull`, `vspec push`, `vspec push --dry-run`, or `vspec sync` from the project root.

## Main Success Scenario

1. **Developer / PM** invokes the sync command, optionally passing `--branch` and `--dry-run`.
2. **System** reads `.vspec/config.json`, the active branch, and (for push) every modified file under `specs/`.
3. **System** parses each candidate file, validates its frontmatter and body against `docs/08-file-format.md`, and computes the local content hash.
4. **System** calls `POST /v1/projects/:projectId/sync/push` for changed files (each carrying its `base_revision`) and/or `POST /v1/projects/:projectId/sync/pull` for incoming revisions.
5. **System** for each pushed file records the new server revision in the frontmatter `revision:` field and refreshes `.vspec/cache/`.
6. **System** for each pulled file writes the canonical-normalized markdown to disk, preserving the on-disk path.
7. **System** prints a per-file summary (`OK`, `CONFLICT`, `SKIPPED`) plus a `suggested_next_actions` block.
8. **Developer / PM** reviews the summary and resolves conflicts (if any) before the next push.

## Extensions

### 3a. A local file has invalid frontmatter or fails parse

- 3a1. **System** aborts before any network call (so a malformed file never causes a server-side rejection mid-batch).
- 3a2. **System** lists the offending paths with line numbers and suggests `vspec doctor <path>`.
- (Outcome: FAILURE — use case ends; nothing is pushed.)

### 4a. Server has a newer revision than the file's `base_revision`

- 4a1. **System** receives `status: CONFLICT` with `current_revision` and `impact` from the sync endpoint.
- 4a2. **System** fetches the server-side content and rewrites the local file with Git-style conflict markers (`<<<<<<< local` / `=======` / `>>>>>>> remote (rev_xyz, by <author> <timestamp>)`).
- 4a3. **System** marks the file as unresolved in `.vspec/cache/` and refuses to push it again until the markers are gone.
- 4a4. **System** suggests `vspec diff` and (after manual resolution) `vspec push`.
- (Outcome: FAILURE — use case ends for the conflicting file; other clean files in the same batch still complete.)

### 1a. `--dry-run` was passed

- 1a1. **System** performs steps 2–4 against the server's preview path and computes the per-file outcome.
- 1a2. **System** prints the same per-file summary as step 7 but writes no `revision:` field and no `.vspec/cache/` update.
- (Outcome: SUCCESS — rejoins main at step 8 conceptually; no files mutated.)

### 4b. Network is unreachable on `vspec push`

- 4b1. **System** catches the transport error before any partial write.
- 4b2. **System** queues the intended push in `.vspec/cache/pending-push.json` with the changed paths and current `base_revision`s, and prints a retry instruction (`vspec push` once connectivity returns).
- (Outcome: PARTIAL — local files unchanged, no server state modified; rejoins main at step 4 on the next invocation.)

### \*a. Authorization fails or the API key is revoked mid-sync

- \*a1. **System** returns exit code 3, instructs `vspec login` or (for agents) refreshes the API key.
- \*a2. **System** leaves local files untouched and does not advance any `revision:` field.
- (Outcome: FAILURE — use case ends.)

## Success Guarantee

For `pull`: every local file under `specs/` reflects the latest server revision on the requested branch, with canonical normalization applied, and its `revision:` frontmatter equals the server-assigned id. For `push`: every successfully-pushed file has a fresh `Revision` row server-side and its local `revision:` is updated to match. Conflicting files are left on disk with explicit markers so the next push is intentional.

## Minimal Guarantee

A failed sync never produces partial server-side `Revision` writes: each file is its own transaction. Local files are never overwritten without either an explicit pull or a conflict-marker rewrite, both of which are visible in the per-file summary. The `revision:` frontmatter field never lies: it either matches a real server revision or is absent.

## Notes

- API: `POST /v1/projects/:projectId/sync/pull` and `POST /v1/projects/:projectId/sync/push` (see `docs/06-api-contract.md`).
- CLI: `vspec pull`, `vspec push`, `vspec sync`, `vspec diff` (see `docs/07-cli-spec.md`).
- File format: `docs/08-file-format.md` — especially the "Conflict Markers" and "Round-Trip Guarantee" sections.
- Companion: UC-030 (export gherkin), UC-031 (export markdown — same renderer as pull).
