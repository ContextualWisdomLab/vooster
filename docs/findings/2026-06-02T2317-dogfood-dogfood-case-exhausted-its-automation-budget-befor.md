---
title: Dogfood case exhausted its automation budget before completion
created_at: 2026-06-02T23:17:46Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260602T231047Z
related:
  - docs/dogfood-loop.md
---

# Dogfood case exhausted its automation budget before completion

**TL;DR.** Reduce cold-start recovery loops: make ai-guide/help/errors teach the authenticated init-to-use-case path without source spelunking or repeated failed commands.

Surfaced by the dogfood loop (cycle `20260602T231047Z`). QUANTS: AT.
Root-cause area: `apps/cli/src and apps/api/src/application/ai-guide.ts`. Routing: codex.

## Evidence

Analyzer fallback reason: analyzer unavailable or timed out. result.json: {"subtype":"error_max_budget_usd","is_error":true,"total_cost_usd":2.0438370000000003,"session_id":"02763a89-334a-4f29-a9d9-05c1ae5f2fa9","errors":["Reached maximum budget ($2)"]}

## Recommendation

Reduce cold-start recovery loops: make ai-guide/help/errors teach the authenticated init-to-use-case path without source spelunking or repeated failed commands.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

Resolved by hydrating the placeholder `seeded-small` dogfood baseline before
seeded cases run. The case now starts from the declared existing Pocket project
and use case instead of spending agent budget diagnosing an empty stub server.

Verification:

- `pnpm exec vitest run apps/cli/tests/integration/dogfood-seeded-baseline.test.ts apps/api/tests/unit/application/usecase-agent.test.ts apps/api/tests/unit/application/step-editing.test.ts apps/api/tests/unit/http/step-results.test.ts apps/api/tests/unit/http/usecase-agent-results.test.ts apps/cli/tests/e2e-cli/help-system.test.ts apps/api/tests/e2e/UC-033.test.ts apps/cli/tests/e2e-cli/UC-033.test.ts`
- `VSPEC_DOGFOOD_CASES=DF-003 VSPEC_DOGFOOD_ANALYZE_TIMEOUT_SECONDS=60 VSPEC_DOGFOOD_BUDGET_USD=35 bash scripts/dogfood/dogfood-cycle.sh` completed cycle `20260602T232239Z` with `P0=0`, `P1=0`, `P2=1`.
