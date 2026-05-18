# 07 — CLI Specification

The CLI is the **primary surface** for both humans and AI coding agents. Every
design decision here favors discoverability over brevity.

## Binary

`vspec` (npm package `@vooster/vspec-cli`, single executable).

## Output Formats

| Flag                 | Audience               | Notes                                              |
| -------------------- | ---------------------- | -------------------------------------------------- |
| (default) `--format=human` | Humans            | Tables, colors, emoji, next-action hints.          |
| `--format=json`      | Scripts                | Pure JSON. No prose.                               |
| `--format=agent`     | AI coding agents       | JSON + `suggested_next_actions[]` + `context`.      |

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
vspec explain                    Plain-language summary of current state + next actions.
vspec ai-guide                   Print the AI-agent guide to stdout.
vspec doctor [<usecase>]         Diagnose quality issues.
vspec why <command>              Explain why a command is recommended.
vspec examples <topic>           Print copy-pastable examples.
```

## Workspaces & Projects

```
vspec workspace create --name <n> --slug <s>
vspec workspace list
vspec workspace switch <slug>

vspec project create --name <n> --key <k>
vspec project list
vspec project show [<key>]
vspec project switch <key>
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
vspec usecase list [--status=] [--actor=] [--q=] [--level=]
vspec usecase show <KEY-NNN> [--revision=] [--session=]
vspec usecase edit <KEY-NNN>            Opens $EDITOR on the markdown form.
vspec usecase set <KEY-NNN> --field <name> --value "<value>"
vspec usecase add-stakeholder <KEY-NNN> --stakeholder <s> --interest "<text>"
vspec usecase archive <KEY-NNN>
vspec usecase restore <KEY-NNN>
vspec usecase search <q>
```

## Scenarios & Steps

```
vspec scenario add <KEY-NNN> --type main-success|extension [--at <step>a] [--condition "<text>"] [--outcome success|failure|partial]
vspec scenario list <KEY-NNN>
vspec scenario edit <id>
vspec scenario delete <id>

vspec step add <scenario-id|extension-point> --actor <actor> --action "<verb phrase>"
vspec step edit <id>
vspec step move <id> --to <position>
vspec step delete <id>
```

## Sessions

```
vspec session start --intent "<text>" [--pin <KEY,KEY,...>] [--auto-branch] [--agent-type cursor|claude-code|windsurf|codex|other]
vspec session list [--mine|--workspace] [--status=]
vspec session show [<id>]                Defaults to current session.
vspec session pin <KEY-NNN>              Add a pin to current session.
vspec session unpin <KEY-NNN>
vspec session complete [--summary "<text>"] [--no-merge]
vspec session abandon
vspec who <KEY-NNN>                      Who is working on this use case?
vspec watch                              Live view of active sessions.
```

## Branches & Merges

```
vspec branch create <name> [--from main]
vspec branch list [--status=]
vspec branch checkout <name>
vspec branch diff <name> [<other-name>]
vspec branch delete <name>

vspec merge preview <branch> [--into main]
vspec merge open <branch> [--into main] [--strategy fast-forward|squash]
vspec merge list [--status=]
vspec merge show <id>
vspec merge resolve <id> [--strategy mine|theirs|manual]
vspec merge approve <id>
vspec merge abort <id>
```

## Locks

```
vspec lock <KEY-NNN> --type soft|semantic|hard [--reason "<text>"] [--ttl <minutes>]
vspec lock list [--mine]
vspec unlock <KEY-NNN>
vspec lock renew <KEY-NNN>
```

## Versioning & Impact

```
vspec history <KEY-NNN> [--limit N]
vspec diff <KEY-NNN> <rev1> <rev2>
vspec revert <KEY-NNN> --to <rev>
vspec impact <KEY-NNN> [--proposed-change <file>]
vspec impact session [<session-id>]
```

## Comments

```
vspec comment add <KEY-NNN> --body "<text>"
vspec comment list <KEY-NNN>
vspec comment resolve <id>
vspec comment edit <id> --body "<text>"
vspec comment delete <id>
```

## Sync (file ↔ server)

```
vspec pull [--branch=]
vspec push [--branch=] [--dry-run]
vspec sync                              pull + push, in that order
vspec status                            Shows local changes (works without server)
vspec diff                              Local-vs-server diff
```

## Export

```
vspec export gherkin <KEY-NNN> [--output tests/<KEY-NNN>.feature]
vspec export markdown <KEY-NNN> [--output specs/<KEY-NNN>.md]
vspec export project --format markdown|gherkin --output <dir>
```

## API Keys (admin)

```
vspec api-key create --name "<text>" --scopes read,write
vspec api-key list
vspec api-key revoke <id>
```

## Membership (admin)

```
vspec member invite --email <email> [--role editor|owner]
vspec member list
vspec member set-role <user> --role editor|owner
vspec member remove <user>
```

---

## Self-Teaching Behaviors

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

| Code | Meaning                                       |
| ---- | --------------------------------------------- |
| 0    | Success                                       |
| 1    | Generic error                                 |
| 2    | Validation / misuse                           |
| 3    | Authentication / authorization failure        |
| 4    | Optimistic concurrency / lock conflict        |
| 5    | Network / server error                        |
| 6    | Local config / state error                    |

All exit codes are stable across CLI versions.

---

## Help System

```
vspec help                Same as `vspec --help`.
vspec help <command>      Command-specific help.
vspec help workflows      Walks through canonical workflows.
vspec help concepts       Explains entities and concepts.
```

`--help` for any command includes:

- One-line summary.
- Synopsis (positional + flags).
- A worked example.
- Pointer to a related concept page.
