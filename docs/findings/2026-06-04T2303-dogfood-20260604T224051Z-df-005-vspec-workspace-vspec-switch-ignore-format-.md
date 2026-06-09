---
title: `vspec workspace`/`vspec switch` ignore `--format=json` and emit a bare `vspec CLI` banner
created_at: 2026-06-04T23:03:54Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T224051Z
related:
  - docs/dogfood-loop.md
---

# `vspec workspace`/`vspec switch` ignore `--format=json` and emit a bare `vspec CLI` banner

**TL;DR.** CLI/contract fix: honor the global `--format` flag on `workspace`/`switch` (emit the standard envelope showing the current workspace) and provide a discoverable way to list available workspaces; at minimum, a bare invocation with `--format=json` should return JSON, not a human banner.

Surfaced by the dogfood loop (cycle `20260604T224051Z`). QUANTS: NTS.
Root-cause area: `apps/cli/src (workspace/switch commands; global --format handling) and docs/07-cli-spec.md`. Routing: codex.

## Evidence

Command 12: `vspec workspace --format=json 2>&1; vspec switch --format=json 2>&1`. Output (digest lines 632-635): `=== workspace (bare) === / vspec CLI` and `=== switch (bare) === / vspec CLI`. Agent narration (lines 98-99): "`vspec workspace` and `vspec switch` take no list subcommand visibly... The bare commands just print a banner." The agent wanted to discover the current/available workspaces and instead had to recover the slug from `vspec status` (`current_workspace_slug: dogfood-dogfood`, session line 462). The global `--format=json` flag was silently dropped rather than honored or rejected.

## Recommendation

CLI/contract fix: honor the global `--format` flag on `workspace`/`switch` (emit the standard envelope showing the current workspace) and provide a discoverable way to list available workspaces; at minimum, a bare invocation with `--format=json` should return JSON, not a human banner.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
