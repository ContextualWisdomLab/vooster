---
title: usecase add-stakeholder duplicate returns raw `ApiError: API request failed with 409.` with no structured code under --format=agent
created_at: 2026-06-04T19:10:26Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# usecase add-stakeholder duplicate returns raw `ApiError: API request failed with 409.` with no structured code under --format=agent

**TL;DR.** Map 409 conflicts to the agent envelope with a stable code (e.g. STAKEHOLDER_ALREADY_ATTACHED), a human message, and suggested_next_actions ("already present — no action needed" or "use ... to update"). Under --format=agent no raw `ApiError: API request failed with N` string should ever reach the agent. Per rubric principle 2, errors must be self-teaching.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: ANS.
Root-cause area: `apps/cli/src (HTTP error handling / envelope.ts) and apps/api/src/http (Problem Details for 409 conflict)`. Routing: codex.

## Evidence

Digest cmds 17-19 ran `vspec usecase add-stakeholder POCKET-003 ... --format=agent`; the failure sample shows `ApiError: API request failed with 409.` (digest line 114/421), and "Error codes seen in tool results" lists ONLY TITLE_NOT_VERB_PHRASE — i.e. the 409 carried no stable machine code. Agent had to infer the meaning (narration line 131: "Both were already added (the 409 was a duplicate)"). Even though --format=agent was requested, a raw ApiError string leaked instead of the documented envelope.

## Recommendation

Map 409 conflicts to the agent envelope with a stable code (e.g. STAKEHOLDER_ALREADY_ATTACHED), a human message, and suggested_next_actions ("already present — no action needed" or "use ... to update"). Under --format=agent no raw `ApiError: API request failed with N` string should ever reach the agent. Per rubric principle 2, errors must be self-teaching.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

`usecase add-stakeholder --format=agent` now routes through the shared mutation
runner, so duplicate API conflicts render as an agent error envelope instead of
throwing `ApiError`. The duplicate Problem Details body now includes
`code: STAKEHOLDER_ALREADY_ATTACHED`, preserves `existing_interest`, and suggests
`vspec usecase show <usecase-id>` as a routable next action.

Verified:

- `pnpm exec vitest run apps/cli/tests/unit/usecase-add-stakeholder-envelope.test.ts apps/api/tests/unit/http/stakeholder-interest-results.test.ts apps/api/tests/unit/application/stakeholder-interest.test.ts`
- `pnpm exec vitest run apps/api/tests/e2e/UC-010.test.ts`
