---
title: Dogfood Follow-Ups — queued from 2026-05-23
created_at: 2026-05-23T17:00:00Z
priority: P2
resolved: partial
status_notes: "A4 closed by 3b13715; A6 closed by 7c8b6ec; A1/A3/A10/A11 closed by docs/findings/2026-05-23T1750-dogfood-roundtrip.md; A2/B5 closed by docs/findings/2026-05-23T1825-doctor-route.md; remaining open IDs stay queued below."
related:
  - docs/findings/2026-05-22T1632-dogfood-snapshot.md
  - docs/findings/2026-05-23T1700-gates-over-coupling.md
  - docs/findings/2026-05-23T1750-dogfood-roundtrip.md
  - docs/findings/2026-05-23T1825-doctor-route.md
---

# Dogfood Follow-Ups — queued from 2026-05-23

This file tracks every dogfood finding that is **not yet closed in
code**. Source of truth for the full reproducers, file paths, and
reasoning is the historical snapshot at
[`docs/findings/2026-05-22T1632-dogfood-snapshot.md`](./2026-05-22T1632-dogfood-snapshot.md).
Each section heading below uses the original finding ID so a future
goal can pick up an item by name and read the matching section in the
snapshot.

A1 / A3 / A10 / A11 were the round-trip-closure cluster originally
scoped by
[`2026-05-23T1750-dogfood-roundtrip.md`](./2026-05-23T1750-dogfood-roundtrip.md).
They are now listed under "Already closed" below.

## How to use this file

1. Pick the next dogfood unblock value from "Suggested grouping" below.
2. Read the matching `### <ID>` section in
   `docs/findings/2026-05-22T1632-dogfood-snapshot.md` for the full reproducer and
   proposed fix.
3. Author a new goal that closes exactly the items it claims to close,
   then remove their headings from the "Open findings" section here.
4. Do not silently widen this list. Add a heading only when a new
   dogfood-class finding appears.

## Suggested grouping

These groupings are advisory only; a future goal can choose any subset
as long as it closes each declared item with an enumerated gate.

- **Self-teaching CLI** (`core differentiator #3` in
  `docs/00-overview.md`): A5, B2, B3.
- **Project / session context refresh**: A7, A8, A9, B6.
- **CLI dispatcher & verb coverage**: A14, A15, H2.
- **API contract honesty**: A12, B1, B4.
- **Spec heuristics & duplication**: A13, H3.
- **Test isolation hazards**: H1.

## Open findings

### A5 — Self-teaching errors are not self-teaching

API responses carry `suggested_next_actions` and (for
`usecase create`) `suggested_titles[]`; the CLI drops both. `actor
create --human` emits a raw oclif stack trace.

### A7 — Phantom `.vspec/session.json`

`session start` prints `Session file .vspec/session.json` and the API
returns `session_file: { path: ".vspec/session.json" }`. The CLI never
writes the file. Either persist the session token + pinned keys, or
stop advertising the file.

### A8 — `vspec project switch` desyncs `current_project_id`

`project switch <KEY>` writes `current_project_key` but leaves the
prior `current_project_id` intact (often a stale UUID). On switch, look
up the project by key under the current workspace and write both id
and key — or fail loudly when the key is unknown.

### A9 — `vspec login` as a returning user does not refresh project context

Returning-user login writes `api_url`, `current_workspace_*`, and
`session_token` but leaves any stale `current_project_*` fields in
place. Compounds A8.

### A12 — Signup re-collision exposed as Prisma 500

POSTing to `/v1/auth/github/token` with a workspace block for a user
that already exists returns HTTP 500 with the Prisma `P2002` payload
and an internal file path. Should be a structured 409 Conflict with a
hint to re-run without `--workspace-*` flags.

### A13 — Verb-phrase heuristic is extremely narrow

`apps/api/src/application/usecases.ts:207` accepts ~14 verbs. Common
vspec verbs (`Pin`, `Pull`, `Push`, `Start`, `Lock`, `Unlock`,
`Branch`, `Merge`, `Sync`, `Run`, `Author`, `Diagnose`, `Diff`,
`Revert`, `Comment`, `Export`, `Import`, `Inspect`) all fail. Spec
§"Soft warnings, not hard rejections" calls for a warning with
`--force`, not a hard reject. The CLI also drops `--force` on the way
through.

### A14 — Many spec-promised verbs are not routed at all

The CLI dispatcher is a hand-maintained if/else chain. Unrouted /
404 surfaces (full table in the snapshot):

```
workspace create / list
project show
actor show <name>                  (by name; id-only today)
goal create --actor <name>         (requires --actor-id <uuid>)
scenario list / edit / delete
step move / delete
session show / pin / unpin / abandon
branch list / checkout / diff / delete
merge preview / list / show / approve / abort
lock list / unlock <KEY>
impact session [<id>]
export project
member list / set-role / remove
help <command>
diff (local-vs-server, no args)
```

Beta-blockers from the snapshot: `session pin / unpin`, `unlock`,
`merge preview`, `scenario edit / delete`, `step delete`, `help <cmd>`.

### A15 — `vspec usecase set` field coverage unaudited

CLI spec promises a generic edit verb. It is routed but the accepted
field set vs the spec-implied field set
(`title`, `level`, `priority`, `format`, `status`, `scope`, …) has
not been audited.

### B1 — UC-009 trigger does not match the CLI

`docs/usecases/UC-009-author-usecase.md` says a current project bound
via `.vspec/config.json` is sufficient. The CLI rejects this with
`Missing --project-id.` Goal 30 closes the precondition direction; the
documentation direction (and the same audit for the other 34 UC
trigger lines) is still open.

### B2 — Self-Teaching CLI differentiator is not yet earned

`docs/00-overview.md` lists "Self-teaching CLI" as a core
differentiator with three behaviors. Behaviour #1 (next-action hints
on every error) is partially implemented — see A5. Behaviour #3 is
the `ai-guide` document — see B3.

### B3 — `vspec ai-guide` is a 12-line stub

CLI spec §"`vspec ai-guide`" promises sections on sessions, workflow,
agent payload contract, forbidden actions, and a worked example.
Today the command emits a one-liner per section. Success criterion #3
in `docs/00-overview.md` (a new AI agent reads ai-guide and completes
a representative task) is not met.

### B4 — `--format=agent` coverage on write verbs is partial

`docs/findings/2026-05-21T1856-cli-spec-gaps.md` already enumerates this. Confirmed by
the dogfood that read verbs have the envelope but several write verbs
(notably `lock release` and the missing verbs from A14) do not.

### B6 — `session_file` API contract is not honored by the CLI

Direct consequence of A7. Either the API drops the field or the CLI
starts writing the file.

### H1 — `~/.vspec/config.json` is the only "current" store; tests trample it

`globalConfigPath()` defaults to `~/.vspec/config.json`. Tests that
forget `VSPEC_CONFIG_PATH` overwrite the developer's live config (and
each other). Fixes: refuse global writes from `NODE_ENV === "test"`,
default to `${XDG_STATE_HOME}/vspec/config.json`, or hard-error when
overwriting a live token from a different `api_url`.

### H2 — The CLI is a 400-line if/else chain in `index.ts`

Every new verb requires editing `apps/cli/src/index.ts` in two
places. Most "unrouted" verbs in A14 are unrouted because the
dispatcher entry is missing, not because the command file is missing.
A declarative table (`commands: Record<string, handler>`) would close
the gap and unlock a real `COMMANDS` block for A6.

### H3 — Verb-phrase regex is duplicated

Two near-identical regexes:
`apps/api/src/application/usecases.ts:207` and
`apps/api/src/application/goal-promotion.ts:161`. Same 14-verb
limitation. Centralize, or move the check out of the API into a
CLI-side warning per the soft-warning spec.

## Already closed

- **A4** — Closed by 3b13715: human `vspec status` now shows the bound
  project/workspace/branch/session panel, live active session and lock context
  from `/v1/sessions` when authenticated, and the next session-start action.
- **A6** — Closed by 7c8b6ec: root help now shows grouped command families,
  and both `vspec help <command>` and `<command> --help` route through the
  command-specific renderer.
- **A2 / B5** — Closed by
  [2026-05-23T1825-doctor-route.md](./2026-05-23T1825-doctor-route.md):
  `GET /v1/doctor` now returns structured diagnostics, and the honest CLI
  doctor command exits cleanly instead of surfacing a 404.
- **A1 / A3 / A10 / A11** — Closed by
  [2026-05-23T1750-dogfood-roundtrip.md](./2026-05-23T1750-dogfood-roundtrip.md):
  pull now uses canonical markdown, human `usecase show` renders the body
  sections, project id falls through from config, and `init` persists usable
  project context.
