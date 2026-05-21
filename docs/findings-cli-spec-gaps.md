# CLI Spec Gaps — queued for a follow-up CLI goal

This file enumerates surfaces from `docs/07-cli-spec.md` that are
documented in the spec but **not implemented** in the current CLI
dispatcher (`apps/cli/src/index.ts`). Goal 7 deliberately scoped these
out (see `goals/7-cli-spec-parity.md` "Scope Guards" — *"No new CLI
verbs beyond `init`"*); each item here is the queue for the next CLI
goal.

Each entry: surface — current state — first observed.

## Missing verbs (write/read commands the spec promises)

- `vspec doctor [<usecase>]` — spec §"Top-Level Commands"; not in
  dispatcher. Scope-guarded out of Goal 7.
- `vspec why <command>` — spec §"Top-Level Commands"; not in
  dispatcher. Scope-guarded out of Goal 7.
- `vspec examples <topic>` — spec §"Top-Level Commands"; not in
  dispatcher. Scope-guarded out of Goal 7.
- `vspec explain` — spec §"Top-Level Commands"; not in dispatcher.
- `vspec watch` — spec; not in dispatcher.
- `vspec help workflows` / `vspec help concepts` — spec §"Help System";
  not in dispatcher.
- `vspec project list` — spec §"Workspaces & Projects"; dispatcher
  only routes `project create` and `project switch`. Discovered while
  authoring UC-004 honest test (2026-05-22).
- `vspec actor list` / `vspec actor show` — spec §"Actors"; dispatcher
  only routes `actor create`. Discovered while authoring UC-005 honest
  test (2026-05-22).
- `vspec actor edit` / `vspec actor archive` — spec §"Actors"; not in
  dispatcher.
- `vspec stakeholder list` / `vspec stakeholder show` / `edit` /
  `archive` — spec §"Stakeholders"; only `stakeholder create` is
  routed.
- `vspec goal show` / `vspec goal reject` — spec §"Goals"; dispatcher
  only routes `goal create`, `goal list`, `goal promote`.
- `vspec usecase edit` / `vspec usecase set` / `vspec usecase restore` /
  `vspec usecase search` — spec §"Use Cases"; dispatcher only routes
  `create`, `list`, `show`, `add-stakeholder`, `archive`.

## `--format=agent` coverage debt

Goal 7 standardized the agent envelope (`buildAgentEnvelope`) but only
three command files actually branch on `format === "agent"`:
`init.ts`, `usecase.ts`, `diff.ts`. The spec (`docs/07-cli-spec.md:16`)
implies `--format=agent` is a global output mode applicable to every
verb. Commands that still need an agent branch (write-path priority
first):

- `goal create` / `goal list` / `goal promote`
- `actor create`
- `stakeholder create`
- `session start` / `session complete` / `session list`
- `branch create`
- `lock` (acquire/release/renew)
- `step add` / `step edit`
- `scenario add`
- `change propose` / `change commit`
- `merge open` / `merge resolve`
- `history`, `impact`, `revert`, `who`, `comment add|list|edit|resolve|delete`
- `member invite`, `api-key create|list|revoke`
- `pull`, `push`, `sync`
- `project create` / `project switch`
- `workspace switch`
- `status` (would benefit most as agents tend to query state)

Each candidate needs: a `--format` flag in its CLI flags, an agent
branch routed through `buildAgentEnvelope`, plus the `data`/`context`
mapping from the API response. The gate `7.A3` will then enumerate
each new file automatically (source of truth: `grep -rl 'format ===
"agent"' apps/cli/src/commands/`).

## Help system surface

- `vspec --help` lists ~80 global flags without grouping by command;
  user can't easily discover which flags apply to which verb. Goal 7
  added a special-case for `vspec init --help` (gate B7); the rest of
  the verbs still print the global help dump.
- `vspec help <command>` is unrouted.

## Notes for the next goal's iteration

When picking up this queue, prefer the order:

1. Read verbs that hosts of agents will hit first
   (`actor show`/`list`, `usecase edit`/`set`, `goal show`).
2. Agent-envelope rollout to write-path verbs (so agents see uniform
   shape across `create` outputs).
3. `doctor`, `why`, `examples` — diagnostic surfaces.
4. Per-verb `--help` routing (the same pattern Goal 7 used for
   `init`).

Do **not** silently widen `HONEST_UC_SET` in `goals/7-*.gates.sh`;
this debt is for the next goal to take and re-scope honestly.
