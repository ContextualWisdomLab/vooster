---
title: step add requires an opaque scenario UUID while use cases use stable keys, forcing --format=agent JSON parsing to chain authoring
created_at: 2026-06-04T21:16:57Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# step add requires an opaque scenario UUID while use cases use stable keys, forcing --format=agent JSON parsing to chain authoring

**TL;DR.** CLI/contract ergonomics fix: let `step add` (and `scenario add`) accept a usecase key + scenario position address (e.g. `vspec step add POCKET-001 --scenario MAIN_SUCCESS` or `--scenario 2a`) instead of only an opaque UUID, OR have the human-format `scenario add` output prominently echo the scenario id so chaining doesn't require `--format=agent` parsing. This lowers the intellectual load and round-trips of multi-step authoring while keeping UUIDs as the stable underlying handle.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: NT.
Root-cause area: `apps/cli/src/commands/step.ts (and scenario add output / docs/07-cli-spec.md)`. Routing: codex.

## Evidence

Digest 'vspec commands in order': steps 18/20/22 are `vspec step add $SID --actor ... --action ...` (the agent captured the main scenario UUID into $SID after `scenario add --format=agent`), and step 24 is `vspec step add 01b61cc0-1476-4897-9108-3a9976bea20e ...` (the extension's literal UUID pasted in). Narration: 'Main scenario ID is `c1571137-3c91-4eb2-a4c9-6c3df53ef819`. Now add the three steps.' All 4 `--format=agent` uses were needed largely to recover these ids. `apps/cli/src/commands/step.ts:282` confirms `step add` takes a required positional `scenario-id` (`requiredArgument(scenarioId, "scenario-id")`), whereas use cases are addressed by human key (POCKET-001).

## Recommendation

CLI/contract ergonomics fix: let `step add` (and `scenario add`) accept a usecase key + scenario position address (e.g. `vspec step add POCKET-001 --scenario MAIN_SUCCESS` or `--scenario 2a`) instead of only an opaque UUID, OR have the human-format `scenario add` output prominently echo the scenario id so chaining doesn't require `--format=agent` parsing. This lowers the intellectual load and round-trips of multi-step authoring while keeping UUIDs as the stable underlying handle.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
