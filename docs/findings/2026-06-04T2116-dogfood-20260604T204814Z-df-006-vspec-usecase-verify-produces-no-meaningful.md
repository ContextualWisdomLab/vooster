---
title: vspec usecase verify produces no meaningful output
created_at: 2026-06-04T21:16:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# vspec usecase verify produces no meaningful output

**TL;DR.** CLI fix: `usecase verify` must emit a structured result (checks run, pass/fail, and suggested_next_actions on failure) and respect --format=agent. A core verification command falling through to the bare 'vspec CLI' banner is a workflow gap; if verify is not yet implemented for this path it should say so explicitly rather than print nothing.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: NS.
Root-cause area: `apps/cli/src/commands/verify.ts, apps/cli/src/commands/verify-spec-checks.ts`. Routing: codex.

## Evidence

Command 20 (`vspec usecase verify TODO-001 2>&1 | tail -15`) and narration line 112: 'vspec usecase verify produced no real output ("vspec CLI"), so its purpose remains unclear.' The agent could not determine what verify checks or whether its spec passed.

## Recommendation

CLI fix: `usecase verify` must emit a structured result (checks run, pass/fail, and suggested_next_actions on failure) and respect --format=agent. A core verification command falling through to the bare 'vspec CLI' banner is a workflow gap; if verify is not yet implemented for this path it should say so explicitly rather than print nothing.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

The dispatcher now registers `usecase verify` and routes it through
`runUsecase(..., "verify", ...)`, which reaches the same verdict producer as the
top-level `vspec verify` command. A dispatch unit test covers the route key and
the non-banner verdict path.
