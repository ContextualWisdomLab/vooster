---
title: New scenario id from `scenario add --format=agent` is not readily discoverable for the follow-up `step add`
created_at: 2026-06-04T23:59:45Z
resolved: false
priority: P2
source: dogfood-loop cycle 20260604T234100Z
related:
  - docs/dogfood-loop.md
---

# New scenario id from `scenario add --format=agent` is not readily discoverable for the follow-up `step add`

**TL;DR.** CLI/contract fix: make the just-created scenario id unambiguous and copy-pasteable in the `scenario add --format=agent` envelope — surface it at a stable, documented path and ideally echo it in a suggested_next_action that names the exact `step add <scenario-id>` command. Document the `data.scenario.id` field in docs/07-cli-spec.md so agents don't grep/guess field names or re-run `usecase show` to recover the id.

Surfaced by the dogfood loop (cycle `20260604T234100Z`). QUANTS: TNA.
Root-cause area: `apps/api/src/http/scenario-results.ts (scenario add agent envelope), apps/cli/src/commands/scenario.ts, docs/07-cli-spec.md`. Routing: codex.

## Evidence

Digest cmd 23 (line 46): `vspec scenario add POCKET-003 --type MAIN_SUCCESS --outcome SUCCESS --format=agent | grep -iE '"id"|scenario_id|"type"' | head` — the agent grepped multiple candidate field names ('id', 'scenario_id') to find the new scenario id. Narration (line 118): "Let me see the full structure to identify the scenario id field clearly." Then cmd 25 (line 47): `vspec usecase show POCKET-003 --format=agent | python3 -c "...print([{'id':s['id'],...} for s in d['data']['scenarios']])"` — an extra round-trip + ad-hoc JSON parse just to recover the id. Only after this did the agent learn the path was `data.scenario.id` (used directly in cmd 33, line 51).

## Recommendation

CLI/contract fix: make the just-created scenario id unambiguous and copy-pasteable in the `scenario add --format=agent` envelope — surface it at a stable, documented path and ideally echo it in a suggested_next_action that names the exact `step add <scenario-id>` command. Document the `data.scenario.id` field in docs/07-cli-spec.md so agents don't grep/guess field names or re-run `usecase show` to recover the id.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
