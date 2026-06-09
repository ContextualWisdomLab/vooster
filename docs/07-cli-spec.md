# 07 — CLI Specification

The CLI is the **primary surface** for both humans and AI coding agents. Every
design decision here favors discoverability over brevity.

> **MVP implementation status.** Commands marked `# 🔵 Planned` are part of the target design but are **not yet implemented** in the 5/30 MVP. Other commands are implemented, though some flags/output may differ — verify against code. The package is `@vooster/cli` (not `@vooster/vspec-cli`), and the real context flags are `--api-url/--project-id/--session-cookie/--workspace-id`. Full audit: `docs/findings/2026-05-24T1100-spec-impl-audit.md`.

## Binary

`vspec` (npm package `@vooster/cli`, single executable).

## Output Formats

| Flag                       | Audience         | Notes                                          |
| -------------------------- | ---------------- | ---------------------------------------------- |
| (default) `--format=human` | Humans           | Tables, colors, emoji, next-action hints.      |
| `--format=json`            | Scripts          | Pure JSON. No prose.                           |
| `--format=agent`           | AI coding agents | JSON + `suggested_next_actions[]` + `context`. |

Global flags:

```
--format=human|json|agent
--profile=<name>       Use a named profile from ~/.vspec/config.json
--project=<key>        Override current project
--session=<id>         Override current session
--branch=<name>        Override current branch
--quiet                Suppress info output (errors still go to stderr)
--no-color
--help
--version
```

## Top-Level Commands

```
vspec login                      Authenticate via GitHub OAuth (device flow).
vspec logout
vspec status                     Print current context (project, branch, session, locks).
vspec init                       Initialize a .vspec/ in current dir; bind to a project.
vspec ai-guide                   Print the AI-agent guide to stdout.
vspec doctor [<usecase>]         Diagnose quality issues.
```

## Workspaces & Projects

```
vspec workspace create --name <n> --slug <s>   # 🔵 Planned
vspec workspace list   # 🔵 Planned
vspec workspace switch <slug>

vspec project create --name <n> --key <k>
vspec project list
vspec project show [<key>]   # 🔵 Planned
vspec project switch <key>
```

### Agent Format — Project Create

`vspec project create --name <n> --key <k> --format=agent` returns the shared
agent envelope with default null context values. The command updates the local active project config before returning, matching the human output mode.

The payload exposes `data.project.id`, `data.project.key`,
`data.default_branch.name`, and `data.recommended_next_command`.
`suggested_next_actions` remains empty because the API returns
`recommended_next_command` as response data.

```
vspec project create --name <n> --key <k> --format=agent
```

### Agent Format — Local Context

`vspec status --format=agent`, `vspec workspace switch <slug>
--format=agent`, and `vspec project switch <key> --format=agent` return the
shared agent envelope with default null context values.

`status` exposes the local config as `data.config`, including
`data.config.current_project_key` when set. `workspace switch` updates the local
config before emitting the envelope, exposes `data.workspace.slug`, and echoes
the stored slug through `data.config.current_workspace_slug`. `project switch`
updates the local config before emitting the envelope and exposes
`data.project.key`.

```
vspec status --format=agent
vspec workspace switch <slug> --format=agent
vspec project switch <key> --format=agent
```

## Actors

```
vspec actor create --name <n> [--type primary|supporting|offstage] [--human]
vspec actor list [--type=...]
vspec actor show <name|id>
vspec actor edit <name|id> [--name=] [--description=] [--add-alias=]
vspec actor archive <name|id>
```

## Stakeholders

```
vspec stakeholder create --name <n> [--type internal|external|regulatory]
vspec stakeholder list
vspec stakeholder show <name|id>
vspec stakeholder edit <name|id>
vspec stakeholder archive <name|id>
```

## Goals (Actor-Goal List)

```
vspec goal create --actor <actor> --description "<text>" [--level user-goal|subfunction|summary] [--priority p0|p1|p2|p3]
vspec goal list [--actor=...] [--status=...]
vspec goal promote <id>                  Create a UseCase from this goal.
vspec goal reject <id>
vspec goal show <id>
```

## Use Cases

```
vspec usecase create --title "<verb phrase>" --primary-actor <actor> [--level user-goal|subfunction|summary] [--from <goal-id>]
vspec usecase list [--status=] [--actor=] [--q=] [--level=] [--all|--archived]
vspec usecase show <KEY-NNN> [--revision=] [--session=]
vspec usecase set <KEY-NNN> --field <name> --value "<value>"
vspec usecase add-stakeholder <KEY-NNN> --stakeholder <s> --interest "<text>"
vspec usecase archive <KEY-NNN>
vspec usecase restore <KEY-NNN>
```

`usecase list` defaults to active use cases. `--archived` lists only archived
use cases and `--all` includes both active and archived entries; archived rows
are marked in the output. `usecase show <KEY-NNN>` can inspect an archived use
case read-only and prints its archived timestamp.

## Scenarios & Steps

```
vspec scenario add <KEY-NNN> --type main-success|extension [--at <step>a] [--condition "<text>"] [--outcome success|failure|partial]
vspec scenario list <KEY-NNN>   # 🔵 Planned
vspec scenario edit <id>   # 🔵 Planned
vspec scenario delete <id>   # 🔵 Planned

vspec step add <scenario-id|extension-point> --actor <actor> --action "<verb phrase>" [--at <position>]
vspec step edit <id>
vspec step move <id> --to <position>
vspec step delete <id>   # 🔵 Planned
```

### Agent Format — Steps

`vspec step add <scenario-id> --format=agent`, `vspec step move <id> --format=agent`,
and `vspec step edit <id> --format=agent` return the shared agent envelope with
the existing API response as `data`. `step add` and `step move` set
`context.revision` from `data.revision.id`. `step edit` leaves `context.revision`
null because the current edit response does not include a revision id.

```
vspec step add <scenario-id> --actor <actor> --action "<verb phrase>" [--at <position>] --format=agent
vspec step move <id> --to <position> --format=agent
vspec step edit <id> --action "<verb phrase>" --base-revision <revision-id> --format=agent
```

### Agent Format — Scenarios

`vspec scenario add <usecase-id> --format=agent` returns the shared agent
envelope with the existing API response as `data`. `context.revision` is
populated from `data.revision.id`.

```
vspec scenario add <usecase-id> --type main-success --format=agent
vspec scenario add <usecase-id> --type extension --at <step>a --condition "<text>" --format=agent
```

## Sessions

```
vspec session start --intent "<text>" [--pin <KEY,KEY,...>] [--auto-branch] [--agent-type cursor|claude-code|windsurf|codex|other]
vspec session list [--mine|--workspace] [--status=]
vspec session show [<id>]                Defaults to current session.   # 🔵 Planned
vspec session pin <KEY-NNN>              Add a pin to current session.   # 🔵 Planned
vspec session unpin <KEY-NNN>   # 🔵 Planned
vspec session complete [--summary "<text>"] [--no-merge]
vspec session abandon   # 🔵 Planned
vspec who <KEY-NNN>                      Who is working on this use case?
```

### Agent Format for Sessions

`vspec session start --format=agent` and `vspec session complete <id>
--format=agent` return the shared agent envelope with the existing API response
as `data` and `context.session_id` set from `data.session.id`.
`vspec session list --format=agent` returns the existing list response as
`data` with the default null context because it describes a collection rather
than one active session.

```
vspec session start --format=agent --intent "<text>" --pin <KEY> --project-id <id>
vspec session list --format=agent [--project-id <id>]
vspec session complete <id> --format=agent [--summary "<text>"] [--no-merge]
```

### Agent Format — Who

`vspec who <KEY-NNN> --format=agent` returns the shared agent envelope with
the existing coordination response as `data`. `suggested_next_actions` is
copied from the API response. The envelope context stays at the default null
values because `who` describes a coordination view rather than one active
revision, branch, or session. The payload includes `data.sessions`,
`data.locks`, and `data.merge_requests`.

```
vspec who <KEY-NNN> --format=agent
```

## Branches & Merges

```
vspec branch create <name> [--from main]
vspec branch list [--status=]   # 🔵 Planned
vspec branch checkout <name>   # 🔵 Planned
vspec branch diff <name> [<other-name>]   # 🔵 Planned
vspec branch delete <name>   # 🔵 Planned

vspec merge preview <branch> [--into main]   # 🔵 Planned
vspec merge open <branch> [--into main] [--strategy fast-forward|squash]
vspec merge list [--status=]   # 🔵 Planned
vspec merge show <id>   # 🔵 Planned
vspec merge resolve <id> [--strategy mine|theirs|manual]
vspec merge approve <id>   # 🔵 Planned
vspec merge abort <id>   # 🔵 Planned
```

### Agent Format for Branches

`vspec branch create <name> --format=agent` returns the shared agent envelope
with the existing API response as `data` and `context.branch` set from
`data.branch.name`.

```
vspec branch create <name> --format=agent [--from main]
```

### Agent Format — Merges

`vspec merge open <branch-id> --format=agent` returns the shared agent envelope
with the existing API response as `data`. `suggested_next_actions` is copied
from the API response. `context.branch` is populated from
`data.source_branch.name`. Merge open responses do not currently include API
warnings, so `warnings` stays the default empty array.

```
vspec merge open <branch-id> --format=agent [--into main] [--strategy fast-forward|squash]
```

### Agent Format - Merge Resolve

`vspec merge resolve <id> --format=agent` returns the shared agent envelope
with the existing API response as `data`. The payload exposes
`data.merge_request`, `data.new_revisions`, and `data.source_branch`.
`context.branch` is populated from `data.source_branch.name`, and
`context.revision` is populated from the first `data.new_revisions` id when one
is returned. `suggested_next_actions` is copied from the API response.

```
vspec merge resolve <id> --format=agent
```

## Locks

```
vspec lock <KEY-NNN> --type soft|semantic|hard [--reason "<text>"] [--ttl <minutes>]
vspec lock list [--mine]   # 🔵 Planned
vspec lock renew <lock-id> [--ttl <minutes>]
vspec lock release <lock-id>
```

### Agent Format for Locks

`vspec lock <KEY-NNN> --format=agent` returns the shared agent envelope with
the existing API response as `data`. `context.session_id` comes from the
caller's --session flag; the lock holder remains visible at
`data.lock.held_by_session_id`.

```json
{
  "data": {
    "lock": {
      "id": "lock-id",
      "lock_type": "SEMANTIC",
      "target_id": "usecase-id",
      "held_by_session_id": "session-id"
    }
  },
  "context": {
    "session_id": "session-id"
  }
}
```

### Agent Format - Lock Renew

`vspec lock renew <lock-id> --format=agent` returns the shared agent envelope
with the renew response as `data`. Agents can read `data.lock.id` and
`data.lock.expires_at`; `context.session_id` comes from the caller's
`--session` flag or remains null. The current API renew response does not populate suggested_next_actions; the envelope's top-level suggested_next_actions is therefore an empty array. `warnings` remains empty.

```
vspec lock renew <lock-id> --format=agent
```

### Agent Format - Lock Release

`vspec lock release <lock-id> --format=agent` returns the shared agent envelope
with the released lock response as `data`. `context.session_id` comes from the
caller's `--session` flag or remains null. Release responses do not populate
suggested_next_actions, so the envelope's top-level suggested_next_actions is
an empty array. `warnings` remains empty.

```
vspec lock release <lock-id> --format=agent
```

## Versioning & Impact

```
vspec history <KEY-NNN> [--limit N]
vspec diff <KEY-NNN> <rev1> <rev2>
vspec revert <KEY-NNN> --to <rev>
vspec impact <KEY-NNN> [--proposed-change <file>]
vspec verify <KEY-NNN> [--test-cmd "<command>"]
vspec impact session [<session-id>]   # 🔵 Planned
```

### `vspec init --verify-workflow`

`vspec init --project <KEY> --verify-workflow` writes the normal
`.vspec/config.json` and also generates `.github/workflows/vspec-verify.yml`.
The generated workflow installs dependencies, runs the Vooster GitHub Action,
and comments on pull requests when verification fails. It defaults to
`<KEY>-001` and can be configured with repository variables
`VSPEC_VERIFY_USECASE`, `VSPEC_VERIFY_TEST_COMMAND`, and `VSPEC_API_URL`, plus
secret `VSPEC_SESSION_COOKIE`.

### `vspec verify`

`vspec verify <KEY-NNN>` deterministically checks spec-step implementation
links. It reads the use case, walks each step's `implements` refs, and resolves
them against the current working tree:

- `path` must point to an existing file.
- `path:symbol` must point to an existing file whose contents include `symbol`.
- Steps with no `implements` refs are reported as unlinked only after the use
  case leaves `DRAFT` or the working tree contains source/test surface to link
  against.
- Structural completeness is reported separately in `structural_checks` for
  `primary_actor`, `level`, `stakeholders`, and `extensions`. Each entry is
  `present` or `missing`; missing entries affect the verdict and exit code.
- When all links resolve and `--test-cmd` is provided, Vooster runs that command
  and uses only its exit code; it does not parse or interpret test output.

Exit codes are stable for the same input tree:

- `0` — all linked refs resolve and delegated tests pass or were not requested.
- `1` — at least one link is broken, a structural/spec check fails, or delegated
  tests fail.
- `7` — no links are broken, but at least one step is unlinked.

`--format=json|agent` returns the same deterministic result payload, including
`checked_refs`, `broken_links`, `unlinked_steps`, `structural_checks`,
`spec_checks`, `suggested_next_actions`, `test_command`, and `drift`.
For `vspec verify`, drift is not semantic mismatch detection. The deterministic
implementation drift kinds are `broken_link`, `failing_test`, and `unlinked_step`;
structural/spec failures add `spec_check_failed` and `structural_check_missing`.
The blocking result never asks an LLM whether the linked code semantically
implements the spec. On any non-passing verdict, `suggested_next_actions`
includes one remediation entry per failing check. Human output prints the same
suggestions under `Next actions`.

The GitHub Action adapter in `action.yml` runs the same verify implementation
through `apps/cli/bin/run.js verify` from the Action checkout and resolves refs
against the caller workspace. Exit code `0` passes, exit code `1` fails, and
exit code `7` fails by default or becomes a warning when `unlinked-policy: warn`
is set. `.github/workflows/vspec-verify.yml` is a copy-paste workflow that
surfaces the captured verify log in the check summary and as a pull request
comment on failure.

### Agent Format — History

`vspec history <KEY-NNN> --format=agent` returns the shared agent envelope with
the existing API response as `data`. Revision rows are newest-first.
`suggested_next_actions` is copied from the API response. `context.revision` is
populated from `data.revisions[0].revision` when a revision is present.

```
vspec history <KEY-NNN> --format=agent [--limit N]
```

### Agent Format — Revert

`vspec revert <KEY-NNN> --to <revision-id> --format=agent` returns the shared
agent envelope with the existing revert API response as `data`.
`suggested_next_actions` is copied from the API response, `warnings` are
preserved, and `context.revision` is populated from `data.revision.id`. The
payload includes `data.usecase.current_revision_id`, which matches the
appended revert revision when the command succeeds.

```
vspec revert <KEY-NNN> --to <revision-id> --format=agent [--summary "<text>"] [--force]
```

### Agent Format — Impact

`vspec impact <KEY-NNN> --format=agent` returns the shared agent envelope with
the existing impact preview API response as `data`. `suggested_next_actions`
is copied from the API response. `context.revision` is populated from the
latest revision used as the preview `base_revision`. The payload includes
`data.preview_id` and `data.impact.input_hash` for follow-up commands and
cache correlation.

```
vspec impact <KEY-NNN> --format=agent [--proposed-change <file>]
vspec verify <KEY-NNN> --format=agent [--test-cmd "<command>"]
```

### Agent Format — Changes

`vspec change propose --format=agent` and
`vspec change commit --format=agent` return the shared agent envelope with the
existing API response as `data`. `suggested_next_actions` is copied from the API
response. `change propose` leaves `context.revision` null because a preview is
not a committed revision. `change commit` sets `context.revision` from
`data.revisions[0].revision_id` when a revision is committed.

```
vspec change propose --usecase <KEY-NNN> --base-revision <revision-id> --patch <file> --format=agent
vspec change commit --preview-id <id> --format=agent
```

## Comments

```
vspec comment add <KEY-NNN> --body "<text>"
vspec comment list <KEY-NNN>
vspec comment resolve <id>
vspec comment edit <id> --body "<text>"
vspec comment delete <id>
```

### Agent Format — Comments

`vspec comment add|edit|resolve|delete --format=agent` return the shared
agent envelope with the existing comment API response as `data`.
`suggested_next_actions` is copied from the API response. `vspec comment list
<KEY-NNN> --format=agent` returns the existing list response as `data` and
leaves `suggested_next_actions` empty. Comment envelopes keep the default null
context because comments do not create revisions, branches, or sessions.
Write payloads expose `data.comment.id`; list payloads expose `data.comments`.
`comment delete --format=agent` does not synthesize a `deleted` field; the
human-only `Deleted true` confirmation is not part of the agent payload.

```
vspec comment add <KEY-NNN> --body "<text>" --format=agent
vspec comment list <KEY-NNN> --format=agent
vspec comment edit <comment-id> --body "<text>" --format=agent
vspec comment resolve <comment-id> --format=agent
vspec comment delete <comment-id> --format=agent
```

## Sync (file ↔ server)

```
vspec pull [--branch=]
vspec push [--branch=] [--dry-run]
vspec sync                              pull + push, in that order
vspec status                            Shows local changes (works without server)
vspec diff                              Local-vs-server diff
```

### Agent Format — Pull and Sync

`vspec pull --format=agent` and `vspec sync --format=agent` write remote files
to the workspace and then return the shared agent envelope. The envelope uses
the pull response as `data`, so agents can read `data.cursor` and `data.files`
from the same payload the human command writes to disk. The context keeps the
default null values because pull does not create a revision, branch, project
key, or session. `suggested_next_actions` is empty. For both commands, files are written before the envelope is printed.
Pull renders each active use case at its current server revision, including
scenario and step mutations created since the file was first exported; agents
must not need an `export markdown > file` fallback to reconcile stale local
spec files.

```
vspec pull --format=agent
vspec sync --format=agent
```

### Agent Format - Push

`vspec push --format=agent` sends the same local files as human push, applies returned revisions before the envelope is printed, and returns the shared agent envelope with the push response as `data`. The payload preserves `data.results`, `data.cache.entries`, and `data.suggested_next_actions`. Top-level `suggested_next_actions` is copied from `data.suggested_next_actions`, `warnings` remains empty, and context keeps the default null values because a push can update multiple files.

```
vspec push --format=agent
```

## Export

```
vspec export gherkin <KEY-NNN> [--output tests/<KEY-NNN>.feature]
vspec export markdown <KEY-NNN> [--output specs/<KEY-NNN>.md]
vspec export project --format markdown|gherkin --output <dir>   # 🔵 Planned
```

## API Keys (admin)

```
vspec api-key create --name "<text>" --scopes read,write
vspec api-key list
vspec api-key revoke <id>
```

### Agent Format — API Keys

`vspec api-key create --format=agent`, `vspec api-key list --format=agent`,
and `vspec api-key revoke <id> --format=agent` return the shared agent
envelope with default null context values.

Create and revoke copy `suggested_next_actions` from the API response. Create
exposes `data.api_key.id` and the one-time `data.plaintext_token`. List exposes
`data.api_keys`, leaves `suggested_next_actions` empty, and does not include a
`plaintext_token field`.

```
vspec api-key create --name "<text>" --scopes read,write --format=agent
vspec api-key list --format=agent
vspec api-key revoke <id> --format=agent
```

## Membership (admin)

```
vspec member invite --email <email> [--role editor|owner]
vspec member list   # 🔵 Planned
vspec member set-role <user> --role editor|owner   # 🔵 Planned
vspec member remove <user>   # 🔵 Planned
```

### Agent Format — Membership

`vspec member invite --email <email> --role editor --format=agent` returns the
shared agent envelope with default null context values. The payload exposes
`data.invitation.email`, and the command copies `suggested_next_actions` from
the API response. The current CLI implementation still requires `--role`; this
section documents agent formatting only.

```
vspec member invite --email <email> --role editor --format=agent
```

---

## Self-Teaching Behaviors 🔵 Planned (largely unimplemented in MVP)

These are **mandatory** for every command.

### 1. Errors carry next-action hints

```
$ vspec usecase create

❌  A use case needs a title.

💡  Try:
    vspec usecase create --title "Submit an order" --primary-actor customer

📚  Cockburn: titles are verb phrases.

🔍  More: vspec help usecase create
```

### 2. Soft warnings, not hard rejections

```
$ vspec usecase create --title "Click the button"

⚠️  Heuristic check: this title looks like a UI action, not a goal.

Suggested:
  - "Submit an order"
  - "Log in"

Override:
  vspec usecase create --title "Click the button" --force
```

### 3. Status panel shows multi-agent context

```
$ vspec status

📍 project: vspec  |  branch: main  |  session: (none)

🤖 Active sessions in this workspace: 4
  • #112 Alice (cursor)   PAY-001  semantic-locked  23m
  • #113 Bob (codex)      REF-002  branch:session/refund-... 12m
  • #114 Charlie (human)  AUTH-003 4m
  • #115 You (codex)      —        idle, no pins

💡 To start your session:
    vspec session start --intent "..." --pin <KEY>
```

### 4. `--format=agent` payload

```json
{
  "data": { ... },
  "context": {
    "project_key": "VSPEC",
    "branch": "main",
    "session_id": null,
    "revision": "rev_abc"
  },
  "suggested_next_actions": [
    { "command": "vspec session start --intent \"...\"", "reason": "Pin a stable snapshot before editing." }
  ],
  "warnings": [],
  "format_version": 1
}
```

### 5. `vspec ai-guide` — the agent crash course

Outputs a markdown document covering:

- Why sessions exist.
- The mandatory workflow for an agent.
- The `--format=agent` payload contract.
- The forbidden actions (write without pin, force a merge, etc.).
- A worked example end-to-end.

Cached on the server; refreshed when CLI is updated.

### 6. `vspec doctor` — quality diagnostic

Project diagnostics roll up every active use case in the project. `status: ok`
means the project exists and all visible use cases have passing quality checks;
any failing or warning use-case check makes the project diagnostic return
`issues_found` with `vspec doctor --usecase <KEY>` next actions.

```
$ vspec doctor PAY-001

✓ All required fields present.
✗ No StakeholderInterest defined (Cockburn requires ≥1).
✓ Main success scenario has 5 steps.
⚠ Extension 3a has no outcome.
✓ Verbs in active voice.

Fix recommendations:
  - vspec usecase add-stakeholder PAY-001 --stakeholder customer --interest "..."
  - vspec scenario edit <3a-id> --outcome failure
```

---

## Exit Codes

| Code | Meaning                                |
| ---- | -------------------------------------- |
| 0    | Success                                |
| 1    | Generic error                          |
| 2    | Validation / misuse                    |
| 3    | Authentication / authorization failure |
| 4    | Optimistic concurrency / lock conflict |
| 5    | Network / server error                 |
| 6    | Local config / state error             |

All exit codes are stable across CLI versions.

---

## Help System

```
vspec help                Same as `vspec --help`.
vspec help <command>      Command-specific help.
```

`vspec --help` shows grouped command families instead of every command flag.
`--help` for a command and `vspec help <command>` use the same command-specific
renderer. Command help includes:

- One-line summary.
- Synopsis (positional + flags).
- A worked example.
- Pointer to a related concept page.
