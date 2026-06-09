---
title: `usecase verify` returns opaque output with no pass/fail/warnings in any format
created_at: 2026-06-04T18:11:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T180511Z
related:
  - docs/dogfood-loop.md
---

# `usecase verify` returns opaque output with no pass/fail/warnings in any format

**TL;DR.** CLI/API fix: `usecase verify` must emit a clear human verdict (PASS/FAIL + warning list) and, under --format=agent, a structured envelope with a stable result field (e.g. status, warnings[], errors[]) so an agent can branch on it. If verify is currently a stub, either implement it or have it return a documented 'not yet implemented' code instead of printing the CLI banner.

Surfaced by the dogfood loop (cycle `20260604T180511Z`). QUANTS: ASN.
Root-cause area: `apps/cli/src/ (usecase verify command) + apps/api/src/application (verify use case)`. Routing: codex.

## Evidence

Commands 23-25 (digest lines 41-43) call `vspec usecase verify TODO-001`, then again with `--format=agent` grepping for status/warning/error/valid/pass/fail, then `--format=agent | head -60`. Narration line 88: "The `verify` command output is opaque." and line 104: "verify TODO-001 printed only `vspec CLI` with no pass/fail/warnings in any format — I couldn't tell if it's a stub or expected different invocation, so I validated manually via `show` + `export` instead." The agent burned 3 invocations and fell back to manual validation.

## Recommendation

CLI/API fix: `usecase verify` must emit a clear human verdict (PASS/FAIL + warning list) and, under --format=agent, a structured envelope with a stable result field (e.g. status, warnings[], errors[]) so an agent can branch on it. If verify is currently a stub, either implement it or have it return a documented 'not yet implemented' code instead of printing the CLI banner.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

Resolved in Goal 43. Verification:

- `pnpm exec vitest run apps/cli/tests/unit/usecase-verify-routing.test.ts apps/cli/tests/unit/verify-command.test.ts`
  passed on 2026-06-04T18:43Z.
- `bash goals/43-dogfood-usecase-verify-returns-opaque-output-with-no-pass-.gates.sh`
  passed on 2026-06-04T18:43Z.
