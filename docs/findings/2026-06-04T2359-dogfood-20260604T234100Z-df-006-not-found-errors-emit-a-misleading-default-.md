---
title: NOT_FOUND errors emit a misleading default `vspec login` / "Restart signup" recovery suggestion
created_at: 2026-06-04T23:59:45Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T234100Z
related:
  - docs/dogfood-loop.md
---

# NOT_FOUND errors emit a misleading default `vspec login` / "Restart signup" recovery suggestion

**TL;DR.** Remove the signup-flavored default from the shared `problem()` helper (or scope it to auth routes only). Give entity-NOT_FOUND responses a recovery action that teaches the real fix, e.g. `{ command: "vspec usecase show <KEY>", reason: "Re-read the use case to get the current scenario/step ids." }`. Audit all `problem()` callers that rely on the default suggestion.

Surfaced by the dogfood loop (cycle `20260604T234100Z`). QUANTS: ANS.
Root-cause area: `apps/api/src/http/signup-support.ts (problem() default), apps/api/src/http/scenario-results.ts, apps/api/src/http/step-results.ts`. Routing: codex.

## Evidence

Digest narration (line 124): on `step add` with a wrong id the agent got `"code": "NOT_FOUND", "message": "Scenario not found"` (digest lines 80-81) and "the error's suggested_next_action was a misleading vspec login / 'Restart signup', which had nothing to do with the actual problem." The agent retried `step add f775fb6e…` twice (digest cmds 27 & 32) before recovering. Root cause confirmed: `problem()` in apps/api/src/http/signup-support.ts:254-258 defaults `suggestedNextActions = [{ command: "vspec login", reason: "Restart signup." }]`, and `problem(404, "Scenario not found")` (scenario-results.ts:96) and `problem(404, "Step not found")` (step-results.ts:11) both omit an explicit suggestion, inheriting the login/signup default.

## Recommendation

Remove the signup-flavored default from the shared `problem()` helper (or scope it to auth routes only). Give entity-NOT_FOUND responses a recovery action that teaches the real fix, e.g. `{ command: "vspec usecase show <KEY>", reason: "Re-read the use case to get the current scenario/step ids." }`. Audit all `problem()` callers that rely on the default suggestion.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.
