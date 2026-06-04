---
title: Dogfood case exhausted its automation budget before completion
created_at: 2026-06-02T21:51:13Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260602T213837Z
related:
  - docs/dogfood-loop.md
---

# Dogfood case exhausted its automation budget before completion

**TL;DR.** Reduce cold-start recovery loops: make ai-guide/help/errors teach the authenticated init-to-use-case path without source spelunking or repeated failed commands.

Surfaced by the dogfood loop (cycle `20260602T213837Z`). QUANTS: AT.
Root-cause area: `apps/cli/src and apps/api/src/application/ai-guide.ts`. Routing: codex.

## Evidence

Analyzer fallback reason: analyzer unavailable or timed out. result.json: {"subtype":"error_max_budget_usd","is_error":true,"total_cost_usd":2.0318140000000007,"session_id":"6c66ee71-d80b-427c-a325-9a34bbfe22c4","errors":["Reached maximum budget ($2)"]}

## Recommendation

Reduce cold-start recovery loops: make ai-guide/help/errors teach the authenticated init-to-use-case path without source spelunking or repeated failed commands.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

The dogfood stub API now starts with `VSPEC_FORCE_MEMORY_STORE=1`, and the API
entrypoint treats that flag as authoritative even when an ambient
`DATABASE_URL` exists. This keeps the dogfood server on isolated memory stores
and avoids stale Prisma schemas during cold-start agent runs.

## Verification

- `pnpm exec vitest run apps/api/tests/unit/index.test.ts`
- Direct dogfood-smoke CLI run against `http://127.0.0.1:8799` with a fresh
  stub user created a project, initialized the repo, added actor/stakeholder,
  created `TODO-001`, added a scenario and step, then successfully ran
  `vspec usecase show TODO-001 --format agent` and `vspec export markdown TODO-001`.
