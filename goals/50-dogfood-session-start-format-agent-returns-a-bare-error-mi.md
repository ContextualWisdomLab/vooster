# Goal 50: Dogfood Finding Follow-Up

Resolve the dogfood finding **session start --format=agent returns a bare 'Error: Missing --pin.' string instead of the agent envelope**.

Source finding: `docs/findings/2026-06-04T1910-dogfood-20260604T184559Z-df-002-session-start-format-agent-returns-a-bare-e.md`

Root-cause area: `apps/cli/src (flag/arg validation short-circuits before envelope formatting); apps/api/src/application/ai-guide.ts (guide steers agents to `session start` without clarifying the --pin precondition)`

## Completion

A. The source finding is marked `resolved: true` after the implementation
addresses the recommendation below.

B. The implementation has been verified with the smallest relevant test or
dogfood rerun, and the finding document records that evidence.

## Recommendation

Route required-flag/validation errors through the documented agent envelope (stable code, message, suggested_next_actions) even when --format=agent is set, so agent-facing surfaces never leak bare strings. Also have ai-guide explain what a --pin is and how a greenfield agent obtains one (or that session start is optional on the greenfield path), since the agent hit a dead end here.
