---
title: scenario add does not surface the new scenario id for the next `step add`
created_at: 2026-06-04T23:03:54Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T224051Z
related:
  - docs/dogfood-loop.md
---

# scenario add does not surface the new scenario id for the next `step add`

**TL;DR.** API/CLI fix: on successful `scenario add --format=agent`, attach a suggested_next_actions entry with the concrete `vspec step add <scenario.id> --actor ... --action ...` command (templating the real id), and have the CLI human output lead with the scenario id (printScenario already prints `Scenario <id>` — keep it). Optionally add a `vspec scenario list <usecase>` command so the id is recoverable without parsing `usecase show` JSON.

Surfaced by the dogfood loop (cycle `20260604T224051Z`). QUANTS: TNA.
Root-cause area: `apps/api/src/http/scenario-results.ts (CREATED path returns scenario+revision+steps but no suggested_next_actions); apps/api/src/http/scenario-support.ts:92 (`command: "vspec step add"`with no id); apps/api/src/application/ai-guide.ts:94/181 (literal`vspec step add <main-scenario-id>` placeholder)`. Routing: codex.

## Evidence

Digest line 38 `vspec scenario add TODO-001 ... --format=agent | grep -A2 '"id"'` followed by repeated `vspec usecase show TODO-001 --format=agent | python3 ... data['scenarios'][].id` at lines 39, 41, 43, 49; subcommand frequency shows `6 vspec usecase show` (line 56). Agent narration (lines 113-114): "Step adds need a scenario id, not the use-case key. The guide's examples use <main-scenario-id> but neither usecase create nor scenario add's tail output surfaced that id clearly. I had to dig it out of usecase show ... A scenario list command, or echoing the new scenario id prominently on scenario add, would close that gap."

## Recommendation

API/CLI fix: on successful `scenario add --format=agent`, attach a suggested_next_actions entry with the concrete `vspec step add <scenario.id> --actor ... --action ...` command (templating the real id), and have the CLI human output lead with the scenario id (printScenario already prints `Scenario <id>` — keep it). Optionally add a `vspec scenario list <usecase>` command so the id is recoverable without parsing `usecase show` JSON.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
