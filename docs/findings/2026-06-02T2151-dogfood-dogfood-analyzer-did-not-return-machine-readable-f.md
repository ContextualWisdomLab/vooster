---
title: Dogfood analyzer did not return machine-readable findings
created_at: 2026-06-02T21:51:13Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260602T213837Z
related:
  - docs/dogfood-loop.md
---

# Dogfood analyzer did not return machine-readable findings

**TL;DR.** Keep analyzer calls bounded and preserve dogfood run evidence as fallback findings when Claude analysis is unavailable.

Surfaced by the dogfood loop (cycle `20260602T213837Z`). QUANTS: AT.
Root-cause area: `scripts/dogfood/dogfood-analyze.sh`. Routing: codex.

## Evidence

Analyzer fallback reason: analyzer unavailable or timed out. result.json: {"subtype":"success","is_error":false,"total_cost_usd":1.417795,"session_id":"a5179eb0-b551-4308-b9f5-f13fbceb968f","errors":null}

## Recommendation

Keep analyzer calls bounded and preserve dogfood run evidence as fallback findings when Claude analysis is unavailable.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

Analyzer fallback now preserves successful dogfood runs as P2 analyzer debt
instead of manufacturing a P1. Budget/error runs still produce actionable P1
evidence.

## Verification

- `pnpm exec vitest run apps/cli/tests/integration/dogfood-analyze-fallback.test.ts`
