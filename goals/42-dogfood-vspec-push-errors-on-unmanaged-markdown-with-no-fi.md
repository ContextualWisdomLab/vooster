# Goal 42 -- `vspec push` must skip unmanaged markdown and emit coded, self-teaching sync-file errors

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

`vspec push` collects every markdown file under `specs/` and must classify each
one before sending it. A pre-existing freeform notes file (no vspec frontmatter)
must be **skipped**, not turned into a hard failure that aborts the whole push.
When a file genuinely cannot be pushed, the rejection must be **self-teaching**:
it names the offending file, carries a stable `code`, and lists at least one
`suggested_next_actions`. No sync-file rejection may be a bare `Error` string.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-001-vspec-push-errors-on-unmanaged-markdown-wit.md`
(case `DF-001`, P1). During the dogfood loop `vspec push` aborted with
`Error: Sync file is missing revision frontmatter.` The message named no file;
the offending file was the pre-existing, unmanaged `specs/SEED_NOTES.md`. The
error was a bare string with no stable `code` and no `suggested_next_actions`,
so the agent could not tell which file was at fault or what to do, and had to
confirm server-side via `usecase list` / `show` that its real spec had synced
despite the push error.

Root cause: `baseRevisionFrom` in `apps/cli/src/commands/sync-files.ts` throws
`new Error("Sync file is missing revision frontmatter.")` for **any** markdown
file under `specs/` that lacks a `revision:` line -- including files that were
never vspec-managed. The throw is un-coded, un-named, and aborts the collection
of all other (valid) files.

## Completion Conditions

1. The push file collector classifies **every** markdown file under `specs/`
   into exactly one of three classes, and acts on it deterministically:
   - **managed** -- the file has a vspec frontmatter block with a `revision:`
     field. It is pushed exactly as today (its `base_revision` is read from the
     frontmatter).
   - **unmanaged** -- the file has no vspec frontmatter block at all (a freeform
     notes file such as `specs/SEED_NOTES.md`). It is **skipped**; the push of
     the remaining managed files still succeeds, and a `warning` that names the
     skipped file is surfaced so the agent learns it was ignored.
   - **incomplete** -- the file has a vspec frontmatter block but is missing the
     `revision:` field. The collector raises a typed sync-file error that
     **names the offending file path**, carries a **stable non-empty `code`**,
     and lists **at least one `suggested_next_actions`** describing a remedy
     (e.g. run `vspec pull` to obtain a revision, add frontmatter, or move the
     file out of `specs/`).
2. No sync-file rejection is a bare `Error` string: the literal throw
   `new Error("Sync file is missing revision` exists **nowhere** under
   `apps/cli/src`. Every rejection raised while collecting sync files flows
   through the typed error so the `code` and `suggested_next_actions` cannot
   silently drift back to a bare string on any path.
3. The CLI typechecks, the new classification behavior is locked by unit tests
   at the push collector entry point, and the existing managed-file push suite
   stays green.

## Sources Of Truth

- `docs/findings/2026-06-04T1811-dogfood-20260604T180511Z-df-001-vspec-push-errors-on-unmanaged-markdown-wit.md`
- `apps/cli/src/commands/sync-files.ts`
- `apps/cli/src/commands/sync.ts`
- `apps/cli/src/commands/push.ts`
- `apps/cli/tests/unit/sync-files-classification.test.ts`
- `apps/cli/tests/unit/push-agent-format.test.ts`

The set of source files that must not reintroduce the bare throw is enumerated
from source with `find apps/cli/src -name '*.ts'`; the forbidden bare throw is
detected with `grep -rn 'new Error("Sync file is missing revision' apps/cli/src`,
which must match zero files.

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/sync-files-classification.test.ts apps/cli/tests/unit/push-agent-format.test.ts
bash goals/42-dogfood-vspec-push-errors-on-unmanaged-markdown-with-no-fi.gates.sh
bash scripts/completion-check.sh
```
