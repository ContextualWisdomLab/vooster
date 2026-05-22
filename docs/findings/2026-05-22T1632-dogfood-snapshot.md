---
title: Dogfooding Findings — 2026-05-23 (historical snapshot)
created_at: 2026-05-22T16:32:39Z
resolved: false
kind: snapshot
status_notes: |
  Frozen run-author snapshot. Open work is tracked by
  docs/findings/2026-05-23T1700-dogfood-followups.md. Goal 30 targets
  A1/A3/A10/A11 but is design-only as of 2026-05-23 (code unimplemented).
related:
  - docs/findings/2026-05-23T1700-dogfood-followups.md
  - docs/findings/2026-05-21T1856-cli-spec-gaps.md
  - goals/30-dogfood-roundtrip.md
  - docs/00-overview.md
  - docs/07-cli-spec.md
---

# Dogfooding Findings — 2026-05-23

_Run author: greatSumini. Goal: exercise the current vspec MVP CLI against this
very repo, end-to-end, as the dogfood persona promised in `docs/00-overview.md`
("the vspec team can register and edit vspec's own 35 use cases inside vspec")._

## TL;DR

The CLI **cannot dogfood vspec on vspec today.** Three breakages each kill the
flow on their own; together they make the May 30 beta non-credible without
work:

1. **`vspec pull` strips the body off every use case** (round-trip lost).
2. **`vspec doctor` returns 404** — no API route registered.
3. **`vspec usecase show` renders ~5 % of the data the API already returns.**

Plus an extensive list of unrouted verbs and config-isolation hazards documented
below.

The good news: the API generally has the data, the agent envelope is mostly
wired up, and `vspec export markdown` produces a fully-dressed file. The work
to get to a credible beta is concentrated in the CLI dispatcher, the
`sync-files` markdown writer, the `doctor` route, and the `usecase show`
human renderer.

---

## How I ran it

```
docker compose up -d db
pnpm install
pnpm exec prisma db push --schema apps/api/prisma/schema.prisma --skip-generate
PORT=8080 VSPEC_AUTH_STUB=1 pnpm run dev
VSPEC_CLI_SOURCE=1 VSPEC_API_URL=http://localhost:8080 VSPEC_AUTH_STUB=1 \
  node apps/cli/bin/run.js <verb> ...
```

Pre-existing `~/.vspec/config.json` from prior test runs pointed at a dead
ephemeral port — see Hazard H1.

---

## Section A — CLI bugs that break the dogfood flow

### A1. `vspec pull` returns frontmatter + title only

`apps/api/src/application/sync-files.ts:281` ships a second `usecaseMarkdown`
function that emits only `---<frontmatter>---\n\n# <title>\n` — no
stakeholders, no scenarios, no steps, no extensions. The proper renderer in
`apps/api/src/application/markdown-renderer.ts` (which **is** used by
`vspec export markdown`) is bypassed.

Reproducer:

```
$ vspec usecase add-stakeholder VSPEC-001 --stakeholder vspec-user --interest "..."
$ vspec scenario add VSPEC-001 --type main-success
$ vspec step add <scenario-id> --actor ai-coding-agent --action "..."
$ vspec pull
$ cat specs/VSPEC-001.md
---
vspec_format: 1
...
revision: b7417fe2-...
---

# Creates a session pin     ← end of file
```

Impact: kills the file-first workflow (the #6 differentiator in
`docs/00-overview.md`), violates the "Round-Trip Guarantee" in
`docs/08-file-format.md`, and makes `vspec push` a footgun — pushing the
truncated file would erase scenarios server-side.

Fix: replace the inline renderer with the existing `markdownRenderUseCase` (or
its equivalent in `markdown-renderer.ts`) and add a round-trip test that
seeds a UC with 1+ scenario, calls `/sync/pull`, and asserts the body matches
`/v1/.../markdown` output.

### A2. `vspec doctor` returns 404

`apps/cli/src/commands/doctor.ts:46` calls `GET /v1/doctor`, but there is no
`registerDoctorRoutes` in `apps/api/src/http/server.ts`. The CLI spec lists
`doctor` as a top-level command (§"Top-Level Commands") and the API even
recommends `vspec doctor` as a next action from sync and gherkin export.

Two sub-bugs:

- The 404 response surfaces in the CLI as a bare `ApiError: API request
failed with 404.` — no next-action hint (CLI spec §"Self-Teaching
  Behaviors §1" mandates these).
- Suggesting a broken command from other endpoints actively misleads agents
  who read `suggested_next_actions`.

Fix: implement the diagnostic on the API (probably reusing the same store
reads as `usecase show` + a small ruleset) and return the structured result
shape the CLI already expects.

### A3. `vspec usecase show` discards almost everything the API returns

`--format=agent` for the same use case returns a full payload with
`primary_actor`, `stakeholder_interests[]`, `scenarios[].steps[]`, etc.
The human renderer prints only **4 lines** (`UseCase`, `Title`, `Status`,
`Revision`).

Concrete reproducer in this dogfood session: VSPEC-001 had 1 stakeholder
interest, 1 main-success scenario, 1 step — `usecase show` displayed none of
them.

Fix: render the agent-format `data` into the canonical body the file-format
spec already prescribes (§"Body Format for `UseCase`"). Reuse the markdown
renderer or transform `data` into the same section list.

### A4. `vspec status` is a 4-line key/value dump, not the multi-agent panel

CLI spec §"Self-Teaching Behaviors §3" promises an active-sessions table,
lock indicators, and a next-action hint. Today it prints:

```
api_url http://localhost:8080
current_workspace_id 62038823-...
current_project_key VSPEC
profile default
```

No branch, no session, no locks, no peers, no hint. Without this panel the
"6+ concurrent agents" story has no visible surface in the CLI.

### A5. Self-teaching errors are not self-teaching

Spec §"Self-Teaching Behaviors §1" mandates that every error carries a
next-action hint. In practice:

- `vspec usecase create` with a non-verb title → `Error: Use case title
should be a verb phrase.` The API actually returns `suggested_titles[]`
  and a `vspec usecase create --force` next action; the CLI drops both.
- `vspec actor create --human` → oclif `Nonexistent flag: --human` plus a
  full stack trace (no next action, no docs link).
- `vspec doctor PAY-001` → bare `ApiError: API request failed with 404.`

### A6. `vspec --help` and `vspec help <cmd>` are broken

- `vspec --help` lists ~80 global flags in one block with no `COMMANDS`
  section. Only `vspec init --help` has a custom override (see
  `apps/cli/src/index.ts:417`).
- `vspec help <command>` is not routed at all — falls through to the
  default `this.log("vspec CLI")` arm.

CLI spec §"Help System" mandates one-line summary + synopsis + worked
example + concept pointer per command.

### A7. Phantom `.vspec/session.json` file

`vspec session start` prints `Session file .vspec/session.json` and the API
returns `session_file: { path: ".vspec/session.json" }`. The CLI **never
writes** the file. Confirmed: after `session start`, no such file exists.

This breaks the multi-agent coordination contract — `apps/cli/src/...session`
output and the API both claim a file exists, but downstream commands (`who`,
`status`, `pin`/`unpin`) have no on-disk handoff point.

Fix: either persist the session token + pinned keys to that file, or stop
advertising it.

### A8. `vspec project switch` desyncs `current_project_id`

`project switch VSPEC` writes `current_project_key: VSPEC` to config but
leaves the old `current_project_id` intact (whatever UUID happened to be
there — in my session it was a stale UUID from a parallel test run, pointing
at a project that does not exist in this workspace).

Result: subsequent commands that resolve project by id will hit the wrong /
nonexistent project even though the key looks right to the user.

Fix: on switch, look up the project by key under the current workspace and
write both `current_project_id` **and** `current_project_key` (or fail loudly
if the key is unknown in the workspace).

### A9. Login as returning user does not refresh project context

When `vspec login` (without `--workspace-*` flags) succeeds against an
existing user, it writes `api_url`, `current_workspace_id`,
`current_workspace_slug`, `session_token` — but leaves any stale
`current_project_*` fields in place. Compounds A8.

### A10. `current_project_id` is required everywhere; config fall-through is missing

`apps/cli/src/flag-values.ts:resolveContextFlag` reads `api-url`,
`session-cookie`, `workspace-id` from config, but **not** `project-id`. Every
project-scoped command (actor, stakeholder, goal, usecase, scenario, step,
pull, push, history, impact, who, comment, …) therefore requires the user to
pass `--project-id <UUID>` explicitly even after `init`/`switch`. The UUID
isn't visible in normal status output, so the user has to `cat
~/.vspec/config.json` to discover it.

Fix: extend `resolveContextFlag` to resolve `project-id` from
`current_project_id` (or, better, look it up by `current_project_key`
through the API).

### A11. `vspec init` writes only `current_project_key` and nothing else

After `vspec init --project VSPEC`, the new `.vspec/config.json` contains:

```json
{ "current_project_key": "VSPEC" }
```

No `current_project_id`, no `api_url`, no usable handle for any subsequent
command. Init should resolve the key against the API and persist enough to
make `vspec pull` runnable.

### A12. Signup re-collision exposed as Prisma 500

POSTing to `/v1/auth/github/token` with a workspace block for a user that
already exists returns:

```
HTTP/1.1 500 Internal Server Error
{"statusCode":500,"code":"P2002","error":"Internal Server Error",
 "message":"\nInvalid `this.prisma.user.create()` invocation in
   /Users/.../prisma-signup-store.ts:581:24\n\n...
   Unique constraint failed on the fields: (`github_id`)"}
```

This leaks an internal file path and a Prisma error code at exit-code 1 and
HTTP 500 instead of a structured 409 Conflict with a hint to re-run without
`--workspace-*` flags.

### A13. The verb-phrase heuristic is extremely narrow

`apps/api/src/application/usecases.ts:207`:

```
return /^(adds?|approves?|cancels?|creates?|places?|promotes?|renews?|requests?|reviews?|submits?|tracks?|writes?)\b/i.test(title);
```

~14 verbs. Common vspec verbs that fail the check: `Pin`, `Pull`, `Push`,
`Start`, `Lock`, `Unlock`, `Branch`, `Merge`, `Sync`, `Run`, `Author`,
`Diagnose`, `Diff`, `Revert`, `Comment`, `Export`, `Import`, `Inspect`. Every
single one would need `--force`.

Two follow-ons:

- Spec §"Soft warnings, not hard rejections" says heuristics should
  **warn**, not hard-reject, and a `--force` flag should override. The CLI
  does not pass `--force` from the global flag set into `usecase create`.
- The list is hardcoded, not configurable, and isn't even validated against
  the verbs vspec itself uses for its own 35 use cases.

### A14. Many spec-promised verbs are not routed at all

`apps/cli/src/index.ts` is a hand-maintained if/else chain. The following
spec verbs fall through to the default `vspec CLI` arm (i.e. silently no-op):

| Surface (per `docs/07-cli-spec.md`)             | Status                                                 |
| ----------------------------------------------- | ------------------------------------------------------ |
| `workspace create`                              | unrouted                                               |
| `workspace list`                                | unrouted                                               |
| `project show`                                  | unrouted                                               |
| `actor show <name>` (by name)                   | 404 (id only)                                          |
| `goal create --actor <name>` (by name)          | requires `--actor-id <uuid>`                           |
| `scenario list / edit / delete`                 | unrouted                                               |
| `step move / delete`                            | unrouted                                               |
| `session show / pin / unpin / abandon`          | unrouted                                               |
| `branch list / checkout / diff / delete`        | unrouted (only `create`)                               |
| `merge preview / list / show / approve / abort` | unrouted (only `open` / `resolve`)                     |
| `lock list`, `unlock <KEY>`                     | unrouted (lock list collides with required `--reason`) |
| `impact session [<id>]`                         | 404                                                    |
| `export project`                                | unrouted                                               |
| `member list / set-role / remove`               | unrouted                                               |
| `help <command>`                                | unrouted                                               |
| `diff` (local-vs-server, no args)               | requires `from-revision`                               |

`docs/findings/2026-05-21T1856-cli-spec-gaps.md` already documents some of these as
queued — but the queue has been "for the next goal" through several goals.
Beta-blockers: `session pin/unpin`, `unlock`, `merge preview`,
`scenario edit/delete`, `step delete`, `help <cmd>`.

### A15. `usecase set` is documented as the generic edit verb, status unclear

CLI spec promises `vspec usecase set <KEY> --field <name> --value <text>`.
It is routed but I did not get a chance to verify which fields it accepts vs
which the spec implies (title, level, priority, format, status, scope,
…). Audit recommended before relying on it for the dogfood.

---

## Section B — Spec ↔ implementation mismatches that the dogfood surfaced

### B1. UC-009 trigger does not match the CLI

`docs/usecases/UC-009-author-usecase.md` preconditions:

> A current project is bound (via `.vspec/config.json` or `--project`).

And the trigger:

> `vspec usecase create --title "<verb phrase>" --primary-actor <actor>`

In reality the CLI rejects this with `Missing --project-id.` (see A10). The
canonical use case for the canonical command of vspec does not run.

### B2. The "Self-Teaching CLI" differentiator is not yet earned

`docs/00-overview.md` lists "Self-teaching CLI" among the **Core
Differentiators**, with three concrete behaviors:

1. Errors carry next-action hints — partially implemented; CLI drops API
   hints in several paths (A5, A2).
2. `--format=agent` outputs `suggested_next_actions` — mostly there.
3. `vspec ai-guide` exists — exists, but is a 12-line stub (see B3).

### B3. `vspec ai-guide` is a 12-line stub

CLI spec §"`vspec ai-guide`" promises a markdown document covering:

- Why sessions exist.
- The mandatory workflow for an agent.
- The `--format=agent` payload contract (with example).
- The forbidden actions.
- A worked example end-to-end.

What ships:

```
# vspec AI Agent Guide
## Why sessions exist
Sessions pin the exact use case revisions ...
## Mandatory workflow
pin -> fetch via --format=agent -> propose-change -> commit
## The --format=agent payload contract
Agent payloads are JSON with context, suggested_next_actions, warnings, and format_version.
## Forbidden actions
Do not write without a pin, force a merge, or ignore suggested_next_actions.
## Worked example
Run vspec login, list projects, start a session with pinned use cases, fetch the spec, propose a change, then commit it.
vspec login
vspec project list
vspec session start
```

Success criterion #3 in `docs/00-overview.md` is "A new AI agent that has
never seen vspec can read `vspec ai-guide` and complete a representative
end-to-end task without further documentation." Not met.

### B4. CLI spec calls for `--format=agent` everywhere; coverage is partial

`docs/findings/2026-05-21T1856-cli-spec-gaps.md` already enumerates this. Confirmed by the
dogfood that `--format=agent` works for the read-path verbs but is missing
on a number of write verbs (notably `lock release` and several missing
verbs above).

### B5. `vspec doctor` is suggested as a next action from sync / gherkin / impact, but is itself broken (A2)

Three different API responses point agents at `vspec doctor`:
`apps/api/src/http/impact-results.ts:49`, `gherkin-export-problems.ts:55`,
`sync-markdown.ts:31`, `markdown-export-routes.ts:137`. All four mislead.

### B6. `session_file` API contract is not honored by the CLI (see A7)

The contract advertises a file the CLI does not write. Either the API or the
CLI is wrong; the dogfood says the CLI.

---

## Section C — Cross-cutting hazards

### H1. `~/.vspec/config.json` is the only "current" store, and tests trample it

`apps/cli/src/config-store.ts:globalConfigPath()` defaults to
`~/.vspec/config.json`. Many tests under `apps/cli/tests/...` correctly set
`VSPEC_CONFIG_PATH` to a temp file, but the safety net depends on every test
remembering to do this. During this dogfood session, a parallel process
(presumably a vitest e2e in another worktree) overwrote my real
`~/.vspec/config.json` three separate times — each time pointing at a dead
127.0.0.1:5xxxx port.

Fixes (any one is enough):

- Refuse to write the global config from `runCli` if `process.env.NODE_ENV
=== "test"`.
- Default the global path to `${XDG_STATE_HOME}/vspec/config.json` and
  isolate test runs via `VSPEC_GLOBAL_CONFIG_PATH` set automatically in
  vitest setup.
- Hard error if `globalConfigPath()` matches a path that already has a live
  session token from a different `api_url` (i.e. don't silently overwrite).

### H2. The CLI is a 400-line if/else chain in `index.ts`

`apps/cli/src/index.ts:run()` does `if (cmd === "X" && argv[1] === "Y")` 50+
times. Every new verb requires editing this file in two places (flag set +
dispatch). Most "unrouted" verbs in A14 are unrouted not because the command
file is missing but because the dispatcher entry is missing. A small
declarative table (`commands: Record<string, (...) => Promise<void>>` keyed
by `"<verb> <subverb>"`) would close the gap and let `vspec --help` print a
real `COMMANDS` block.

### H3. Verb-phrase regex is the same code, duplicated

Two near-identical regexes: `apps/api/src/application/usecases.ts:207` and
`apps/api/src/application/goal-promotion.ts:161`. Both share the same
14-verb limitation. Either centralize and broaden, or move the check
out of the API and into a CLI-side warning per the soft-warning spec.

---

## Section D — Spec coverage check vs the dogfooding need

`docs/00-overview.md` MVP scope: **16 entities, 35 use cases, 7 categories**.
The 35 UC markdown files exist under `docs/usecases/UC-*.md`. I sampled a
few and the canonical body sections are present (`Stakeholders and
Interests`, `Preconditions`, `Trigger`, `Main Success Scenario`,
`Extensions`, `Success Guarantee`, `Minimal Guarantee`, `Notes`). The
**content** is fine; what's broken is the **round-trip** between repo
markdown and server state. The dogfooding promise — "register and edit
vspec's own 35 use cases inside vspec" — fails not on spec authorship but
on:

1. A1 (sync-pull strips bodies, so the first `push` overwrites server with
   truncated content).
2. A3 (no way to inspect a use case in the terminal that shows its
   stakeholders/scenarios).
3. A14 missing verbs (`scenario edit/delete`, `step delete/move`) — needed
   to maintain the specs as they evolve.
4. A2 (`doctor` is how you verify Cockburn fidelity per the spec).

If A1–A4 and the missing verbs from A14 (the row marked beta-blockers) are
fixed, the dogfooding loop closes. Nothing in the entity model itself looks
missing for the dogfood; the gaps are in the surface area.

### Spec items I'd add if dogfooding is the acceptance bar

- **`vspec import` (or `pull --force`)** for the initial onboarding case
  where 35 markdown files already exist on disk and need to seed the
  server. The spec only describes outbound markdown; the bootstrapping
  direction is implicit.
- **A "where am I" command stronger than `status`** — combined view of
  workspace + project + current session + locks I hold + pins, with hints
  for resuming work after a context switch.
- **A `vspec set-default <field>` or per-repo defaults** so an agent
  invoked in a worktree doesn't keep re-reading and re-setting context.
- **`vspec spec validate <path>`** — a local lint that runs the same rules
  as `doctor` against an on-disk markdown file before pushing. Today the
  feedback loop requires a round trip.

---

## Section E — Concrete proposed punch list (ordered by dogfood unblock value)

1. **Replace `sync-files.ts:281` `usecaseMarkdown`** with the proper
   renderer used by `export markdown`, plus a round-trip test (A1).
2. **Register a `/v1/doctor` route** that returns the structured shape the
   CLI already expects, and route `vspec doctor` through it (A2).
3. **Rewrite the `usecase show` human renderer** to walk the same agent-
   format payload it already fetches (A3).
4. **Fix `--help` and `help <cmd>`** to enumerate commands and worked
   examples per CLI spec §"Help System" (A6).
5. **Honor `current_project_key` / `current_project_id` in
   `resolveContextFlag`** so the user can drop `--project-id` from every
   call (A10).
6. **`project switch` and `init` write `current_project_id`** by resolving
   the key against the API (A8, A11).
7. **Reject overwrite of `~/.vspec/config.json` from test contexts** —
   default to `VSPEC_GLOBAL_CONFIG_PATH` set by vitest setup (H1).
8. **Surface API `suggested_next_actions` in every CLI error path**, not
   just the agent envelope (A5).
9. **Route the missing verbs in A14** (start with `session pin/unpin`,
   `unlock`, `scenario edit/delete`, `step delete`, `merge preview`).
10. **Either implement or stop advertising `.vspec/session.json`** (A7,
    B6).
11. **Replace `vspec ai-guide` stub with the full crash course** that the
    spec promises and that success criterion #3 in `docs/00-overview.md`
    requires (B3).
12. **Broaden the verb-phrase heuristic** so vspec's own UCs pass it, and
    convert the hard-reject to a `--force`-overridable warning (A13,
    spec §"Self-Teaching Behaviors §2").

---

## Appendix — What worked during the dogfood

- DB and API came up cleanly once Docker disk pressure was relieved.
- `pnpm run dev` + Prisma push: ~10 s end-to-end.
- `vspec login` (stub mode), `project create`, `actor create`,
  `stakeholder create`, `usecase create` (with a regex-matching verb),
  `usecase add-stakeholder`, `scenario add`, `step add`, `session start`,
  `who`, `history`, `impact`, `export markdown` all returned correct
  payloads.
- The agent envelope (`--format=agent`) is consistent and complete on the
  verbs that have it, and `suggested_next_actions` are populated by the
  API. The CLI just needs to surface them more visibly.
- `vspec export markdown` produced a fully-dressed canonical file —
  proves the rendering capability exists, it just isn't reused by
  `pull`.
