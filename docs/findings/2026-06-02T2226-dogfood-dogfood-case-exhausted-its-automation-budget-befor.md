---
title: Dogfood case exhausted its automation budget before completion
created_at: 2026-06-02T22:26:51Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260602T221935Z
related:
  - docs/dogfood-loop.md
---

# Dogfood case exhausted its automation budget before completion

**TL;DR.** Reduce cold-start recovery loops: make ai-guide/help/errors teach the authenticated init-to-use-case path without source spelunking or repeated failed commands.

Surfaced by the dogfood loop (cycle `20260602T221935Z`). QUANTS: AT.
Root-cause area: `apps/cli/src and apps/api/src/application/ai-guide.ts`. Routing: codex.

## Evidence

Analyzer fallback reason: analyzer unavailable or timed out. result.json: {"subtype":"error_max_budget_usd","is_error":true,"total_cost_usd":2.022991,"session_id":"def38bdc-bb4f-48df-ac03-f7c23aa32f2b","errors":["Reached maximum budget ($2)"]}

## Recommendation

Reduce cold-start recovery loops: make ai-guide/help/errors teach the authenticated init-to-use-case path without source spelunking or repeated failed commands.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

Dogfood auth seeding now writes `current_workspace_id` and
`current_workspace_slug` into the isolated global config. This lets greenfield
agents create the first project without reverse-engineering workspace discovery.
The AI guide also now includes `--type EXTERNAL` for the initial stakeholder
command, matching the CLI contract.

## Verification

- `pnpm exec vitest run apps/cli/tests/integration/dogfood-seed-auth-config.test.ts apps/cli/tests/integration/dogfood-run-budget-evidence.test.ts`
- `pnpm exec vitest run apps/cli/tests/e2e-cli/help-system.test.ts apps/api/tests/e2e/UC-033.test.ts apps/cli/tests/e2e-cli/UC-033.test.ts`
