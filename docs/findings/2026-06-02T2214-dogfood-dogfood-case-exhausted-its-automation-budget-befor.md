---
title: Dogfood case exhausted its automation budget before completion
created_at: 2026-06-02T22:14:13Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260602T220106Z
related:
  - docs/dogfood-loop.md
---

# Dogfood case exhausted its automation budget before completion

**TL;DR.** Reduce cold-start recovery loops: make ai-guide/help/errors teach the authenticated init-to-use-case path without source spelunking or repeated failed commands.

Surfaced by the dogfood loop (cycle `20260602T220106Z`). QUANTS: AT.
Root-cause area: `apps/cli/src and apps/api/src/application/ai-guide.ts`. Routing: codex.

## Evidence

Analyzer fallback reason: analyzer unavailable or timed out. result.json: {"subtype":"error_max_budget_usd","is_error":true,"total_cost_usd":2.0272845,"session_id":"4cb434d7-e2ff-4f51-a806-9ecdf151a128","errors":["Reached maximum budget ($2)"]}

## Recommendation

Reduce cold-start recovery loops: make ai-guide/help/errors teach the authenticated init-to-use-case path without source spelunking or repeated failed commands.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

The dogfood harness now propagates the seeded stub identity into headless runs,
so an agent-triggered `VSPEC_AUTH_STUB=1 vspec login` returns the same seeded
workspace instead of switching to the default `cli` stub account. CLI help now
surfaces `ai-guide` and the real greenfield authoring flags for stakeholder,
scenario, and step commands. The AI guide now teaches agents to preserve an
existing auth context, create a supporting product actor such as `Pocket`, write
active-voice steps, and add validation extensions with `--at`.

## Verification

- `pnpm exec vitest run apps/cli/tests/integration/dogfood-run-budget-evidence.test.ts`
- `pnpm exec vitest run apps/cli/tests/e2e-cli/help-system.test.ts apps/api/tests/e2e/UC-033.test.ts apps/cli/tests/e2e-cli/UC-033.test.ts`
