---
title: `vspec help session complete` omits the positional `<session-id>` argument
created_at: 2026-06-04T19:10:26Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# `vspec help session complete` omits the positional `<session-id>` argument

**TL;DR.** Help/CLI fix: declare and document the optional `<session-id>` positional in `session complete` (ARGUMENTS section + USAGE), noting it defaults to the active session. This pairs with the envelope fix so a failed bare invocation can also point the agent at the id-supplying form.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: NA.
Root-cause area: `apps/cli/src/commands/session (complete) help/usage metadata; docs/07-cli-spec.md`. Routing: codex.

## Evidence

Digest cmd 16 `vspec help session complete` output (lines 685-692) shows only `USAGE $ vspec session complete [options]` and a FLAGS section (`--format`, `-h`); there is no ARGUMENTS section documenting the positional session-id that cmd 17 had to supply to succeed. The agent only recovered because it still had the id from the `session start` envelope, not from the help.

## Recommendation

Help/CLI fix: declare and document the optional `<session-id>` positional in `session complete` (ARGUMENTS section + USAGE), noting it defaults to the active session. This pairs with the envelope fix so a failed bare invocation can also point the agent at the id-supplying form.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
