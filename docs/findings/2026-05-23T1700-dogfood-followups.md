---
title: Dogfood Follow-Ups — queued from 2026-05-23
created_at: 2026-05-23T17:00:00Z
priority: P2
resolved: partial
status_notes: "B4 closed by a817b92; H1 closed by fe5e79c; A15 closed by f7a3cb1; A13/H3 closed by 4183c2a; B1 closed by 781b758; A12 closed by 0587abf; A7/A8/A9/B6 closed by 79351d6; A5/B2/B3 closed by 48390e2; A4 closed by 3b13715; A6 closed by 7c8b6ec; A1/A3/A10/A11 closed by docs/findings/2026-05-23T1750-dogfood-roundtrip.md; A2/B5 closed by docs/findings/2026-05-23T1825-doctor-route.md; remaining open IDs stay queued below."
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

- **CLI dispatcher & verb coverage**: A14, H2.

## Open findings

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

### H2 — The CLI is a 400-line if/else chain in `index.ts`

Every new verb requires editing `apps/cli/src/index.ts` in two
places. Most "unrouted" verbs in A14 are unrouted because the
dispatcher entry is missing, not because the command file is missing.
A declarative table (`commands: Record<string, handler>`) would close
the gap and unlock a real `COMMANDS` block for A6.

## Already closed

- **B4** — Closed by a817b92: implemented write verbs now have agent-format
  coverage; the remaining verbs without output contracts are still queued under
  A14 until they are routed and implemented.
- **H1** — Closed by fe5e79c: `writeConfig` now refuses implicit
  `~/.vspec/config.json` writes under `NODE_ENV=test` unless the caller provides
  an explicit config path through `VSPEC_CONFIG_PATH`, `VSPEC_GLOBAL_CONFIG_PATH`,
  or the `path` option.
- **A15** — Closed by f7a3cb1: `vspec usecase set` now accepts the audited
  metadata fields `title`, `level`, `priority`, `format`, `status`, and
  `scope`; the API PATCH path persists those fields and the honest CLI flow
  proves title edits through the public command.
- **A13 / H3** — Closed by 4183c2a: use case authoring and goal promotion now
  share one broadened verb-phrase heuristic that accepts vspec's own common
  verbs, including `Pin`, `Pull`, `Push`, `Start`, `Lock`, `Unlock`,
  `Branch`, `Merge`, `Sync`, `Run`, `Author`, `Diagnose`, `Diff`, `Revert`,
  `Comment`, `Export`, `Import`, and `Inspect`.
- **B1** — Closed by 781b758: the honest login-to-usecase flow now exercises
  the documented UC-009 trigger, creating a use case from persisted project
  context without `--project-id`.
- **A12** — Closed by 0587abf: repeated device-token signup with a workspace
  block now returns structured 409 guidance instead of allowing duplicate user
  persistence to expose a storage-layer conflict.
- **A7 / A8 / A9 / B6** — Closed by 79351d6: `session start` writes
  `.vspec/session.json`, `session complete` clears it, authenticated project
  switch resolves the selected key back to its project id, and returning login
  clears stale project context.
- **A5 / B2 / B3** — Closed by 48390e2: human mutation failures now render
  API `suggested_next_actions` plus validation details such as suggested
  titles; `usecase create --force` and documented `actor create --human` are
  accepted; `vspec ai-guide` now contains concrete session workflow, agent
  envelope, forbidden-action, and worked-example guidance.
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
