---
title: doctor's per-use-case scoping is undiscoverable from the suggested next action
created_at: 2026-06-04T19:10:26Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# doctor's per-use-case scoping is undiscoverable from the suggested next action

**TL;DR.** Have doctor's suggested_next_actions carry the exact command (`vspec doctor --usecase <KEY>`) and list the available keys, and document the scoping flag in `vspec help doctor` so the deeper-check path is self-teaching.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: NT.
Root-cause area: `apps/api/src/application (doctor suggested_next_actions) / docs/07-cli-spec.md / help text`. Routing: codex.

## Evidence

Project-level `vspec doctor` returned ok and suggested "Choose a use case for deeper quality checks" but no literal command (narration lines 131, 145). The agent first guessed a positional form `vspec doctor POCKET-001` before landing on `vspec doctor --usecase POCKET-001` (command 11, line 37; narration line 137), spending extra turns to discover the scoping flag.

## Recommendation

Have doctor's suggested_next_actions carry the exact command (`vspec doctor --usecase <KEY>`) and list the available keys, and document the scoping flag in `vspec help doctor` so the deeper-check path is self-teaching.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
