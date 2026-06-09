# Goal 69 -- the local working copy must never silently go stale after a server-side mutation

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Mission

`vspec usecase create` writes a snapshot to `specs/<KEY>.md`, but during the
dogfood loop the follow-up authoring verbs (`usecase add-stakeholder`,
`scenario add`, `step add`, extension add) changed the server while leaving that
on-disk file pinned at the creation snapshot. The agent only discovered the drift
by reading the file, then had to run `vspec pull` by hand before the working copy
matched the server. Create materializing locally while the adds do not is exactly
the kind of inconsistent write contract that silently risks committing a stale
spec.

The guarantee this goal locks: **every** spec-mutating CLI verb leaves the local
working copy reconciled with the post-mutation server state -- either by
materializing the affected `specs/<KEY>.md` to disk (when a project context
resolves and auto-export can run) or, when materialization is skipped, by
returning a deterministic `vspec pull` stale-warning so the agent is never left
believing a stale file is current.

This holds for every verb -- present or future -- because local materialization
happens in exactly **one shared funnel**. There is no second write path a verb
could take that would mutate the server without that funnel governing the local
reconciliation, so the contract cannot be satisfied for the verb a behavior test
happens to exercise while quietly regressing for another.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T2303-dogfood-20260604T224051Z-df-002-local-working-copy-goes-stale-after-server-.md`
(case `DF-002`, P1). Narration line 88: "The local `POCKET-002.md` file is stale
-- it only reflects the initial creation snapshot, while the server has the full
content. I need to pull to sync the working copy." `vspec usecase create` wrote
the snapshot, but the subsequent add-stakeholder / scenario add / step add /
extension calls never updated the local file, so the agent had to run
`vspec pull` before the working copy matched the server.

Root cause area: `apps/cli/src/commands/scenario.ts`, `step.ts`,
`stakeholder.ts` (and `sync-files.ts`) -- mutating subcommands do not refresh the
local `specs/<KEY>.md` the way `usecase create` writes one. The single shared
mutation runner (`apps/cli/src/application/mutation-runner.ts`) already calls
`autoExport(...)` to materialize affected files and `localRefreshHints(...)` to
attach a refresh hint; this goal locks that materialization-or-warning contract
behind a behavior suite and proves -- by enumerating the materialization funnel
from source -- that no verb can bypass it.

## Completion Conditions

1. **Materialize when possible (universal).** When a project context resolves so
   auto-export can run, a successful authoring mutation reconciles the affected
   `specs/<KEY>.md` on disk and reports a non-empty `affected_files` write set in
   the agent envelope. This must hold for the spec-mutating verbs the finding
   exercised -- `usecase add-stakeholder`, `scenario add`, and `step add` -- not
   just one of them.
2. **Warn when materialization is skipped.** When auto-export cannot run because
   no project context resolves, a successful authoring mutation still returns
   `status: "ok"`, but its `suggested_next_actions` includes an entry whose
   `command` invokes `vspec pull` and whose `reason` states the local working
   copy may be stale and must be refreshed. The agent is therefore never left
   with a silently inconsistent local file.
3. **One materialization funnel (universal invariant).** Local materialization
   runs through exactly **one** shared site: there is exactly one `autoExport(`
   invocation under `apps/cli/src` (excluding its own definition), and it lives in
   the shared mutation runner `apps/cli/src/application/mutation-runner.ts`. No
   command materializes -- or skips materializing -- through a second path that
   bypasses this funnel, so the materialize-or-warn guarantee applies to every
   spec-mutating verb rather than only to the verb the behavior test runs. A
   behavior test exercises only the verbs it drives; it cannot prove a second,
   guarantee-free write path was not introduced elsewhere, so this invariant is
   enumerated from source and looped over in the gate.
4. The CLI typechecks, the materialize / stale-warning behavior is locked by a
   new unit suite (`apps/cli/tests/unit/working-copy-reconcile.test.ts`), and the
   existing mutation-runner / mutation-command suites stay green.

## Sources Of Truth

- `docs/findings/2026-06-04T2303-dogfood-20260604T224051Z-df-002-local-working-copy-goes-stale-after-server-.md`
- `apps/cli/src/application/mutation-runner.ts`
- `apps/cli/src/application/mutation-command.ts`
- `apps/cli/src/application/auto-export.ts`
- `apps/cli/tests/unit/working-copy-reconcile.test.ts`

The set of `autoExport(` call sites is enumerated from source with
`grep -rn 'autoExport(' apps/cli/src | grep -v 'function autoExport'` and looped
over (must be exactly one, in `mutation-runner.ts`). This is the single-source
invariant that proves the working-copy reconciliation guarantee applies to every
spec-mutating verb; a behavior test exercises only the verbs it drives and cannot
prove a second materialization path was not added elsewhere.

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/working-copy-reconcile.test.ts
bash goals/69-dogfood-local-working-copy-goes-stale-after-server-side-mu.gates.sh
bash scripts/completion-check.sh
```
