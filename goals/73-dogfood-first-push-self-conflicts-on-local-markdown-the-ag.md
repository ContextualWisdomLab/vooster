# Goal 73 -- a pure-CLI authoring flow must never self-conflict on its first `vspec push`

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Mission

The dogfood agent authored `POCKET-001` **entirely through CLI write commands**
(`vspec usecase create`, `vspec scenario add`, `vspec step add` — narration
commands 10, 12, 14-20). It made **zero** direct edits to any synced spec file
(the digest's *"Direct edits to synced spec state"* section is empty). Yet
command 24, the very first `vspec push`, reported a **conflict** on the local
markdown file:

> *"Push reports a conflict on the local markdown file ... The server already
> holds my latest revision (`113902c9`); the local markdown cache is stale. Let
> me pull to reconcile."*

The agent then had to run command 29 `vspec pull --format=agent` followed by
command 30 `vspec push` just to reconcile a file it had never hand-edited. A
push that conflicts against the agent's own authoring session — with no
intervening manual edit — is a self-conflict the command exists to prevent.

The root cause is the `base_revision` push submits for conflict detection.
`vspec push` reads each managed spec's `base_revision` from the file's
`revision:` frontmatter (`baseRevisionFrom` → `localSyncFile` in
`apps/cli/src/commands/sync-files.ts`) and the server flags a conflict when that
base does not equal the server's current revision. CLI authoring writes advance
the server revision through the shared mutation runner
(`apps/cli/src/application/mutation-runner.ts`), whose `autoExport(...)` funnel
re-materializes the affected `specs/<KEY>.md`. When that funnel leaves the
on-disk frontmatter revision behind the revision the same write just produced,
the next push submits a stale `base_revision` and the server self-conflicts.

## What Must Become True

**Every authoring write the CLI performs in a pure-CLI session must leave the
local spec cache carrying a `base_revision` equal to the server head that write
produced, so the immediately-following `vspec push` fast-forwards (a clean
no-op) instead of self-conflicting.** After a chain of `usecase create →
scenario add → step add …` with no manual edit to any `specs/*.md`, a plain
`vspec push` must report no conflict and no spec content change — there must be
no need for an intervening `vspec pull` to make the first push succeed.

This is the universal claim of this goal, and it must hold for **every**
authoring write command — not merely the one a behavior test happens to drive.
It is guaranteed structurally by two single-source invariants that a behavior
test cannot prove on its own (a behavior test exercises only the verbs it
drives; it cannot prove a second write path was not added elsewhere):

1. **One materialization funnel.** Local spec re-materialization after a server
   mutation runs through exactly **one** shared site: there is exactly one
   `autoExport(` call site under `apps/cli/src`, and it lives in the shared
   mutation runner `apps/cli/src/application/mutation-runner.ts`. Because every
   authoring write goes through that one funnel, refreshing the affected file's
   frontmatter revision there refreshes it for every command; no command can
   advance the server through a second path that leaves a stale `base_revision`
   on disk.
2. **One push-base reader.** The `base_revision` that `vspec push` submits for
   conflict detection is derived in exactly **one** place: there is exactly one
   `baseRevisionFrom(` call site under `apps/cli/src` (its `localSyncFile`
   caller in `apps/cli/src/commands/sync-files.ts`). Because push reads the
   conflict base from exactly the materialized frontmatter, single-sourcing that
   read makes the funnel fix above sufficient for every file the push collects.

The gate enumerates both call-site sets from source and loops over them (each
must be exactly one, in its stated module) — no single-case cheat. The
materialize-the-frontmatter behaviour itself is then locked by a CLI behaviour
suite.

## Why This Goal Exists

This resolves the dogfood finding `DF-001` recorded in
`docs/findings/2026-06-04T2359-dogfood-20260604T234100Z-df-001-first-push-self-conflicts-on-local-markdown.md`
(P1). It is adjacent to but distinct from Goal 69 (the local working copy going
stale after a mutation) and Goal 66 (`sync` pinning the file at the create
revision): those govern the **content** the agent reads on disk; this goal
governs the **`base_revision` push submits**, i.e. whether the agent's first
push self-conflicts. A pure-CLI authoring flow that has touched no file by hand
must push cleanly the first time.

It does not weaken any prior gate. It reuses the established single funnel
(`mutation-runner.ts`'s `autoExport`) and the established single push-base
reader (`sync-files.ts`'s `baseRevisionFrom`); it locks the additional contract
that the funnel leaves the frontmatter revision current enough that push
fast-forwards.

## Completion Conditions

1. **No self-conflict after pure-CLI authoring (universal, behaviour).** A CLI
   behaviour suite drives a pure-CLI authoring chain through the shared mutation
   runner across **at least two** authoring write kinds (at minimum a scenario
   mutation AND a step mutation), making no manual edit to any `specs/*.md`,
   then asserts that the `base_revision` `collectLocalSyncFiles` would submit for
   the affected file equals the server head the last write produced, so a
   subsequent `vspec push` fast-forwards with no conflict and no spec content
   change. The suite lives in
   `apps/cli/tests/unit/push-after-cli-authoring.test.ts`.
2. **One materialization funnel (universal invariant).** Exactly one
   `autoExport(` call site exists under `apps/cli/src` and it is in
   `apps/cli/src/application/mutation-runner.ts`. Enumerated from source and
   looped in the gate.
3. **One push-base reader (universal invariant).** Exactly one
   `baseRevisionFrom(` call site exists under `apps/cli/src` and it is in
   `apps/cli/src/commands/sync-files.ts`. Enumerated from source and looped in
   the gate.
4. The CLI typechecks, the new behaviour suite passes, and the existing
   mutation-runner / sync suites stay green.

## Sources Of Truth

- `docs/findings/2026-06-04T2359-dogfood-20260604T234100Z-df-001-first-push-self-conflicts-on-local-markdown.md`
  (the DF-001 finding).
- `apps/cli/src/application/mutation-runner.ts` (the shared funnel; the single
  `autoExport(` call site).
- `apps/cli/src/commands/sync-files.ts` (`baseRevisionFrom` / `localSyncFile` —
  the single push-base reader; `collectLocalSyncFiles`).
- `apps/cli/src/application/auto-export.ts` (`autoExport` — re-materializes the
  affected `specs/<KEY>.md` and its frontmatter revision).
- `packages/contracts/src/sync.ts` (`syncPushFileSchema.base_revision` — the
  conflict-detection key the push submits).
- `apps/cli/tests/unit/push-after-cli-authoring.test.ts`.

The two call-site sets are enumerated from source with
`grep -rn 'autoExport(' apps/cli/src | grep -v 'function autoExport'` and
`grep -rn 'baseRevisionFrom(' apps/cli/src | grep -v 'function baseRevisionFrom'`
and looped over (each must be exactly one, in its stated module). These are the
single-source invariants that prove the no-self-conflict guarantee applies to
every authoring write command; a behaviour test exercises only the verbs it
drives and cannot prove a second write path or a second base reader was not
introduced elsewhere.

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/push-after-cli-authoring.test.ts
bash goals/73-dogfood-first-push-self-conflicts-on-local-markdown-the-ag.gates.sh
bash scripts/completion-check.sh
```
