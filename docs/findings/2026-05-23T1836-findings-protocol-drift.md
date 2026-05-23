---
title: "`docs/findings/AGENTS.md` drifted from actual finding conventions"
created_at: 2026-05-23T18:36:00Z
priority: P2
resolved: false
related:
  - docs/findings/AGENTS.md
  - docs/findings/CLAUDE.md
---

# Findings — `AGENTS.md` schema documentation lags reality

## TL;DR

`docs/findings/AGENTS.md` (and its mirror `docs/findings/CLAUDE.md`)
documents a frontmatter schema that diverges from how all 8 existing
findings are actually authored. Four concrete drifts: priority enum,
resolved type, and two undocumented fields (`resolved_by`, `was`).
Future agents reading the protocol will produce non-conforming docs.
Doc-only fix; trivial PR.

## Reproducer — four drifts

Compare `docs/findings/AGENTS.md` (and the identical
`docs/findings/CLAUDE.md`) against the 8 existing findings in
`docs/findings/`:

| Field         | AGENTS.md says                           | Actual usage (8/8 findings)                                   |
| ------------- | ---------------------------------------- | ------------------------------------------------------------- |
| `priority`    | `high \| medium \| low` (default medium) | **`P0 \| P1 \| P2`** — all 8 findings use P-style             |
| `resolved`    | `boolean`                                | **`true \| false \| partial`** — `partial` used in 2 findings |
| `resolved_by` | _undocumented_                           | **commit SHA or list of SHAs** — used in 6 of 8 findings      |
| `was`         | _undocumented_                           | **previous goal path** when finding was promoted-then-demoted |

### Evidence

```
$ grep -h '^priority:' docs/findings/*.md | sort -u
priority: P0
priority: P1
priority: P2
```

```
$ grep -h '^resolved:' docs/findings/*.md | sort -u
resolved: false
resolved: partial
resolved: true
```

`resolved_by` usage examples:
`docs/findings/2026-05-23T1745-build-dedup.md:6`
(`resolved_by: 7cc4396`),
`docs/findings/2026-05-23T1750-dogfood-roundtrip.md:6-13` (list form).

`was` usage example:
`docs/findings/2026-05-23T1750-dogfood-roundtrip.md:14`
(`was: goals/30-dogfood-roundtrip.md`).

## Proposed fix

Edit `docs/findings/AGENTS.md` (and mirror to
`docs/findings/CLAUDE.md`):

1. Change `priority` row to:
   - Type: `P0 | P1 | P2`
   - Default: omit when P2-ish; explicit otherwise.
   - Notes: `P0` = data-integrity / chain-blocker, `P1` = pre-beta
     hazard, `P2` = post-beta cleanup.
2. Change `resolved` row to:
   - Type: `boolean | "partial"`
   - When using `partial`, `status_notes` is required to enumerate
     remaining open sub-items.
3. Add `resolved_by` row:
   - Type: string (commit SHA) or list of strings
   - Required: no, but **strongly recommended** when flipping
     `resolved: true` so the closing commit is auditable.
4. Add `was` row:
   - Type: path (typically `goals/<n>-<name>.md`)
   - Required: no
   - Notes: present when a finding was promoted to a goal that later
     dissolved back into the finding queue.
5. Update the minimal template to reflect P-style priority.

Apply the same edits to `docs/findings/CLAUDE.md`. (Side note: the
two files are duplicates — consider making one a symlink, or
collapsing into a single source. Out of scope for this finding.)

## Acceptance signal

- `grep -E '^\| `priority`' docs/findings/AGENTS.md` shows the new
  P-style enum.
- `grep -E '^\| `resolved_by`' docs/findings/AGENTS.md` returns 1 row.
- `grep -E '^\| `was`' docs/findings/AGENTS.md` returns 1 row.
- Both `AGENTS.md` and `CLAUDE.md` updated identically (or one is a
  symlink to the other after a follow-up).

## Goal promotion judgment

**No** — pure doc fix, no production code touched, no gate-able
invariant.

## Note on this finding's own frontmatter

This finding uses `priority: P2` per the actual convention (not the
stale documented one). The act of writing it under the real
convention is itself proof of the drift.
