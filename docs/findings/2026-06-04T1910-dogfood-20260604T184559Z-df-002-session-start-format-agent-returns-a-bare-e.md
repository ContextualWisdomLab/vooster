---
title: session start --format=agent returns a bare 'Error: Missing --pin.' string instead of the agent envelope
created_at: 2026-06-04T19:10:26Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# session start --format=agent returns a bare 'Error: Missing --pin.' string instead of the agent envelope

**TL;DR.** Route required-flag/validation errors through the documented agent envelope (stable code, message, suggested_next_actions) even when --format=agent is set, so agent-facing surfaces never leak bare strings. Also have ai-guide explain what a --pin is and how a greenfield agent obtains one (or that session start is optional on the greenfield path), since the agent hit a dead end here.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: NAS.
Root-cause area: `apps/cli/src (flag/arg validation short-circuits before envelope formatting); apps/api/src/application/ai-guide.ts (guide steers agents to `session start` without clarifying the --pin precondition)`. Routing: codex.

## Evidence

`vspec session start --intent "Add use case: User exports their expenses to CSV" --format=agent` (digest line 34) produced `Error: Missing --pin.` with Exit code 1 (digest lines 348-349) — a plain prose string, not the structured envelope. Contrast with the title error on the very next command, which returned a full envelope (status/error.code/error.message/suggested_next_actions). The agent could not recover via structured data and abandoned session start, narrating: "Session start requires a pin, but the use case doesn't exist yet" (line 95).

## Recommendation

Route required-flag/validation errors through the documented agent envelope (stable code, message, suggested_next_actions) even when --format=agent is set, so agent-facing surfaces never leak bare strings. Also have ai-guide explain what a --pin is and how a greenfield agent obtains one (or that session start is optional on the greenfield path), since the agent hit a dead end here.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

`session start --format=agent` now renders local missing-`--pin` validation as a
structured error envelope with a stable code and suggested next actions. The AI
guide now explains that `--pin` requires an existing use case key and is optional
before a greenfield use case exists.

Verified with:

- `pnpm exec vitest run apps/cli/tests/unit/session-agent-format.test.ts`
- `pnpm --filter @vooster/cli typecheck`
- `pnpm --filter @vooster/api typecheck`
