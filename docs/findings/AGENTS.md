# `docs/findings/` — Working Protocol

This directory holds **debt-and-insight queue documents**: things the
team noticed during a goal iteration that are out-of-scope for the
current goal but must not be lost. A finding lives here until it is
either promoted into a goal, closed in code, or archived.

Findings are not goals. They have no enumerated gates, they do not
gate `completion-check.sh`, and they can be edited freely by anyone
who picks one up. They are a **queue**, not a contract.

---

## Filename convention

```
docs/findings/<UTC-created-at>-<slug>.md
```

- `<UTC-created-at>` — `YYYY-MM-DDTHHMM` (no seconds, no colon, UTC).
  Derived from `git log --diff-filter=A --follow --format='%aI' -- <file>`
  on the original commit, converted to UTC.
- `<slug>` — short, lowercase, hyphenated. Avoid duplicating the date
  in the slug — the prefix already encodes it.

Examples (in this directory):

```
2026-05-21T1635-perf-log.md
2026-05-22T1632-dogfood-snapshot.md
2026-05-23T1700-gates-over-coupling.md
```

---

## Frontmatter schema

Every finding **must** start with a YAML frontmatter block. Fields:

| Field          | Type                    | Required | Default  | Notes                                                                           |
| -------------- | ----------------------- | -------- | -------- | ------------------------------------------------------------------------------- |
| `title`        | string                  | yes      | —        | Mirrors the `# H1` heading; quote if it contains `:` or special chars.          |
| `created_at`   | ISO-8601 UTC            | yes      | —        | Format: `YYYY-MM-DDTHH:MM:SSZ`. Must match the filename prefix to the minute.   |
| `resolved`     | boolean                 | yes      | —        | `false` until **all** items in the doc are closed in code. Then flip to `true`. |
| `priority`     | `high \| medium \| low` | no       | `medium` | Omit for medium. Set `high` for beta-blockers and cross-goal hazards.           |
| `kind`         | string                  | no       | finding  | Use `snapshot` for frozen dogfood/audit runs; `append-only-log` for telemetry.  |
| `status_notes` | multi-line string       | no       | —        | Required when only a _subset_ of items is closed — name which are still open.   |
| `related`      | list of paths           | no       | —        | Other findings, goals, docs, or source paths the reader should jump to.         |

Minimal template:

```yaml
---
title: <short noun phrase>
created_at: 2026-MM-DDTHH:MM:SSZ
resolved: false
related:
  - docs/<other-doc>.md
---
# <Same as title>
```

With explicit priority + partial-closure notes:

```yaml
---
title: <noun phrase>
created_at: 2026-MM-DDTHH:MM:SSZ
resolved: false
priority: high
status_notes: |
  Item 1 — open.
  Item 2 — CLOSED on YYYY-MM-DD (commit <sha>, gate <id>).
related:
  - goals/<n>-<name>.md
---
```

---

## Body structure

Required:

1. **`# H1` title** — matches the frontmatter `title`.
2. **TL;DR** (1–3 sentences) — what's broken / queued, and why it
   isn't fixed yet.
3. **Body** — concrete reproducer with **file:line** references for
   every claim. If you cannot point at a file/line, you do not have a
   finding yet — you have a hunch.

Recommended (use when relevant):

4. **Options / Recommendation** — when the resolution direction is
   debated, list the candidate paths and call out a recommended one.
5. **Acceptance signal** — how a future agent confirms the finding
   has actually been closed. Avoid "tests pass" alone; name the
   specific test or grep that flips from red to green.
6. **Migration plan** — if the resolution is a multi-step refactor,
   sketch the order so a future goal author has a starting point.

Each finding should be **scannable in 60 seconds.** If yours runs
past ~400 lines, split it.

---

## Honesty rules

- **Verify against code before claiming closure.** A doc may say
  "Goal X closes A1" — that's a _plan_, not a fact. Run `grep`/Read
  on the cited file:line and confirm the change actually landed
  before marking `resolved: true` or moving the item to a "closed"
  section.
- **Forward-looking markers.** When an item is scoped by a goal that
  has not yet merged, label it `_(Goal <n> will close)_` inline and
  keep it under "Open" — do not pretend it's closed.
- **Quote your evidence.** When you flip an item to closed, paste
  the matching `<file>:<line>` or test name so the next reader can
  re-verify in seconds.
- **No silent bullet removal.** If you delete a bullet from a
  finding, the deletion must be backed by a commit message line
  naming the closing commit / gate.

---

## Lifecycle

1. **Create** — when a debt item surfaces during a goal iteration
   that is out-of-scope for the active goal. Author the file with
   frontmatter + body, commit on the same branch as the work that
   surfaced it.
2. **Update** — append `status_notes` lines (newest first) as
   sub-items close. Cross-link the closing commit / gate.
3. **Promote** — when a finding warrants its own goal, author
   `goals/<n>-<name>.md` and have the goal's `## Why This Goal Exists`
   section cite the finding. Do **not** delete the finding when
   promoting; mark `status_notes` with "promoted to goal N".
4. **Resolve** — when every item in the finding is closed in code
   _and_ verified, flip `resolved: true`. Leave the file in place
   for history; do not delete.
5. **Archive** — append-only logs (`kind: append-only-log`) that
   exceed ~100 entries or 6 months of history are archived under
   `docs/archive/findings/<slug>-<YYYY>-Q<n>.md` per
   `harness-engineer.md` "Log hygiene".

---

## Cross-references

When linking from a finding to another file, use the full
repo-rooted path (`docs/findings/<file>.md`, `goals/<n>-<name>.md`,
`apps/api/src/...`) — not `./` or `../` relative paths, except when
the target sits in the same directory and the link is part of an
inline markdown anchor.

When other docs reference a finding, prefer the **directory path**
form (`docs/findings/<file>.md`). Bare globs (`docs/findings/*.md`)
are reserved for harness/agent-prompt language that walks the whole
queue.

---

## Migration history

Findings docs used to live at the top of `docs/` with the
`findings-<slug>.md` filename pattern (no date prefix, no
directory). On 2026-05-23 they were migrated into `docs/findings/`
with the `YYYY-MM-DDTHHMM-<slug>.md` convention; timestamps were
derived from each file's first-commit author date in UTC. See
the `docs: move findings docs into docs/findings/` commit for the
exact path rewrites.
