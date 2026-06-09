---
title: `current_revision_id` is easily confused with a scenario id in agent envelopes
created_at: 2026-06-04T23:59:45Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T234100Z
related:
  - docs/dogfood-loop.md
---

# `current_revision_id` is easily confused with a scenario id in agent envelopes

**TL;DR.** Make scenario/step responses point unambiguously at the id to use next (e.g. echo `scenario_id` in the `step add` suggested_next_action template, or label revision ids distinctly). Add a one-line note to ai-guide clarifying that `current_revision_id` is an audit pointer, not the id passed to `step add`/`scenario` commands.

Surfaced by the dogfood loop (cycle `20260604T234100Z`). QUANTS: NT.
Root-cause area: `packages/contracts/src (response shapes), apps/api/src/application/ai-guide.ts, docs/07-cli-spec.md`. Routing: codex.

## Evidence

Digest narration (lines 99-100, 124): "f775fb6e was the revision ID, not the scenario ID" — the agent grepped for `"id"` in `scenario add`/`usecase show` output (digest cmds 25, 41) and picked the use case's `current_revision_id`, causing the NOT_FOUND above. The ai-guide does say to re-read the use case for ids, but the envelope surfaces multiple UUID-shaped `*_id` fields that look interchangeable.

## Recommendation

Make scenario/step responses point unambiguously at the id to use next (e.g. echo `scenario_id` in the `step add` suggested_next_action template, or label revision ids distinctly). Add a one-line note to ai-guide clarifying that `current_revision_id` is an audit pointer, not the id passed to `step add`/`scenario` commands.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
