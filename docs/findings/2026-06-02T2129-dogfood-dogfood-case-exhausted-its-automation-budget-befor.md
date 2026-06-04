---
title: Dogfood case exhausted its automation budget before completion
created_at: 2026-06-02T21:29:58Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260602T211443Z
related:
  - docs/dogfood-loop.md
---

# Dogfood case exhausted its automation budget before completion

**TL;DR.** Reduce cold-start recovery loops: make ai-guide/help/errors teach the authenticated init-to-use-case path without source spelunking or repeated failed commands.

Surfaced by the dogfood loop (cycle `20260602T211443Z`). QUANTS: AT.
Root-cause area: `apps/cli/src and apps/api/src/application/ai-guide.ts`. Routing: codex.

## Evidence

Analyzer fallback reason: analyzer unavailable or timed out. result.json: {"subtype":"error_max_budget_usd","is_error":true,"total_cost_usd":2.00458575,"session_id":"f9587916-3126-44a3-ab22-cf4a536bf316","errors":["Reached maximum budget ($2)"]}

## Recommendation

Reduce cold-start recovery loops: make ai-guide/help/errors teach the authenticated init-to-use-case path without source spelunking or repeated failed commands.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

- `apps/cli/src/config-store.ts` now stops local config discovery at the git
  repo root, preventing stale `~/.vspec/config.json` from shadowing the
  dogfood repo's isolated global config.
- `apps/api/src/application/ai-guide.ts` now includes a greenfield setup path:
  project creation, repo init, actor/stakeholder creation, use case creation,
  stakeholder interest, and scenario creation.

Verification:

- `pnpm exec vitest run apps/cli/tests/unit/config-store.test.ts`
- `pnpm exec vitest run apps/api/tests/e2e/UC-033.test.ts apps/cli/tests/e2e-cli/UC-033.test.ts`
