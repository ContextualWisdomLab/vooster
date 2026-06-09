# Goal 56 -- a successful CLI authoring mutation must never leave the local spec silently stale

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

After any successful CLI authoring mutation (`scenario add`, `step add`,
`usecase add-stakeholder`, and every other spec-mutating verb), the on-disk
markdown must not be silently out of date relative to the server. Today the CLI
auto-exports the affected files only when a project context resolves; when it
cannot (no resolvable `project-id`) the mutation still reports success with an
empty `affected_files` write set and no instruction to refresh, so the agent is
left believing its local files match the server when they do not.

Close the gap in the **single shared mutation runner** that every authoring verb
funnels through:

- When the CLI can auto-export, a successful mutation materializes its
  `affected_files` to local markdown (today's behavior -- lock it).
- When the CLI cannot auto-export (no resolvable project context), the success
  envelope must carry a deterministic `vspec pull` entry in
  `suggested_next_actions` whose reason tells the agent the local files may be
  stale and must be pulled.

Because the guarantee lives in the one runner that every verb routes through, no
authoring verb -- present or future -- can return a "succeeded but silently
stale" result.

## Why This Goal Exists

This resolves
`docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-002-local-spec-markdown-goes-stale-after-cli-au.md`
(case `DF-002`, P1). During the dogfood loop the agent added a scenario and steps
to `POCKET-002` via `scenario add` / `step add`, then `cat specs/POCKET-002.md`
and found the on-disk file did not reflect the changes. Its narration: "The local
markdown file is stale. Let me fetch the current server state. ... Server state is
complete and correct. The local POCKET-002.md file is stale -- let me regenerate
it." It then ran `vspec sync` and `vspec pull` by hand to materialize the file.

Root cause: `runMutationCommand` in
`apps/cli/src/application/mutation-command.ts` sets `autoExport: undefined`
whenever `projectId === null`, and `runMutation` in
`apps/cli/src/application/mutation-runner.ts` then returns
`affected_files: []` with no compensating signal. `ai-guide.ts` (line 204) calls
`affected_files` "the local write set", so an empty write set reads as "nothing
changed locally" -- but the spec did change on the server.

## Completion Conditions

1. **Materialize when possible.** When a project context resolves, a successful
   authoring mutation writes its affected files to local markdown and reports a
   non-empty `affected_files` write set in the agent envelope. (This is today's
   behavior; lock it with a test so the fix to condition 2 cannot regress it.)
2. **Pull-hint when materialization is skipped.** When the CLI cannot auto-export
   because no project context resolves, a successful authoring mutation still
   returns `status: "ok"`, but its `suggested_next_actions` must include an entry
   whose `command` invokes `vspec pull` and whose `reason` states that local spec
   files may be stale and must be refreshed. The agent is therefore never left
   with a silently inconsistent local file.
3. **One shared funnel (universal).** Every CLI authoring mutation verb obtains
   the materialize-or-pull-hint guarantee from exactly **one** shared runner:
   there is exactly one call site of `runMutation(` under `apps/cli/src`, and it
   is the shared `runMutationCommand` in
   `apps/cli/src/application/mutation-command.ts`. No command performs a spec
   write through a path that bypasses this runner, so the guarantee holds for
   every verb rather than for the one the test happens to exercise.
4. The CLI typechecks, the materialize / pull-hint behavior is locked by a new
   unit suite, and the existing mutation-command / mutation-runner suites stay
   green.

## Sources Of Truth

- `docs/findings/2026-06-04T2116-dogfood-20260604T204814Z-df-002-local-spec-markdown-goes-stale-after-cli-au.md`
- `apps/cli/src/application/mutation-command.ts`
- `apps/cli/src/application/mutation-runner.ts`
- `apps/cli/src/application/auto-export.ts`
- `apps/cli/tests/unit/mutation-stale-local-files.test.ts`

The set of `runMutation(` call sites is enumerated from source with
`grep -rn 'runMutation(' apps/cli/src | grep -v 'function runMutation'` and looped
over (must be exactly one, in `mutation-command.ts`). This is the single-source
invariant that proves the guarantee applies to every authoring verb; a behavior
test exercises only the verbs it runs and cannot prove a second, guarantee-free
mutation path was not introduced elsewhere.

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/mutation-stale-local-files.test.ts
bash goals/56-dogfood-local-spec-markdown-goes-stale-after-cli-authoring.gates.sh
bash scripts/completion-check.sh
```
