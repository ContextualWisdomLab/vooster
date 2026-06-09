---
title: usecase verify produces opaque output with no pass/fail result
created_at: 2026-06-04T19:10:26Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# usecase verify produces opaque output with no pass/fail result

**TL;DR.** Make `usecase verify` emit a concrete result: per-check pass/fail (actors registered, scenario completeness, extension points resolved, Cockburn fidelity), an overall verdict, and a non-zero exit on failure; add a structured --format=agent envelope so agents can gate push on it.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: SNQ.
Root-cause area: `apps/cli/src (usecase verify command) and corresponding application/HTTP verify path; docs/07-cli-spec.md`. Routing: codex.

## Evidence

Command 32 `vspec usecase verify POCKET-001` printed only `============ VERIFY ============` / `vspec CLI` and EXIT 0 (lines ~373-375) — no checks run, no pass/fail summary, no findings. The agent could not rely on verify and instead validated correctness by reading `usecase show` (narration line 118 "The spec reads correctly"), making the verify step dead weight before push.

## Recommendation

Make `usecase verify` emit a concrete result: per-check pass/fail (actors registered, scenario completeness, extension points resolved, Cockburn fidelity), an overall verdict, and a non-zero exit on failure; add a structured --format=agent envelope so agents can gate push on it.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

Added a single shared `runSpecChecks` producer and wired `vspec verify` /
`vspec usecase verify` to emit per-check spec-fidelity results in human, JSON,
and agent output.

Verified with:

- `pnpm --filter @vooster/cli typecheck`
- `pnpm exec vitest run apps/cli/tests/unit/usecase-verify-checks.test.ts apps/cli/tests/unit/verify-command.test.ts apps/cli/tests/unit/usecase-verify-routing.test.ts`
- `bash goals/48-dogfood-usecase-verify-produces-opaque-output-with-no-pass.gates.sh`
