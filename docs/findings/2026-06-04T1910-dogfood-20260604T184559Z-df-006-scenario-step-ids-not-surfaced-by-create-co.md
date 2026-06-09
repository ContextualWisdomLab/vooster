---
title: Scenario/step IDs not surfaced by create commands; agent must re-show and parse JSON
created_at: 2026-06-04T19:10:26Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# Scenario/step IDs not surfaced by create commands; agent must re-show and parse JSON

**TL;DR.** CLI/contract fix: `scenario add` should return the new scenario id prominently in its envelope `data` and bake it into the suggested_next_actions (e.g. a ready-to-run `step add <scenario-id> ...` command), so the agent never has to re-show and JSON-parse to chain the next step.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: NTA.
Root-cause area: `apps/cli/src/domain/envelope.ts, apps/cli/src/commands (scenario add / step add), apps/api/src/application (suggested_next_actions construction)`. Routing: codex.

## Evidence

Command 16 `scenario add ... --format=agent` (line 38) was grepped for an id, then command 17 `usecase show TODO-001 --format=agent | python3 ...` (line 39) was needed just to extract the scenario id before `step add`. Agent narration (line 108): "Step/scenario IDs aren't surfaced by the create commands in an obvious place — I had to re-show ... --format=agent and dig through JSON to get the scenario id before adding steps."

## Recommendation

CLI/contract fix: `scenario add` should return the new scenario id prominently in its envelope `data` and bake it into the suggested_next_actions (e.g. a ready-to-run `step add <scenario-id> ...` command), so the agent never has to re-show and JSON-parse to chain the next step.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
