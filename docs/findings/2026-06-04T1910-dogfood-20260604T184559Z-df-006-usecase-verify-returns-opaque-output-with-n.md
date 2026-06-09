---
title: `usecase verify` returns opaque output with no pass/fail signal
created_at: 2026-06-04T19:10:26Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# `usecase verify` returns opaque output with no pass/fail signal

**TL;DR.** CLI/API fix: `usecase verify` must emit an explicit machine-readable verdict (pass/fail, list of checks, and any failing invariants) in both human and --format=agent envelopes, with suggested_next_actions on failure. A verification command that prints a bare banner defeats its purpose and forced an agent workaround.

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: SAN.
Root-cause area: `apps/cli/src (usecase verify command) / apps/api/src/application (verify use case), docs/07-cli-spec.md`. Routing: codex.

## Evidence

Command 25 `vspec usecase verify TODO-001 2>&1 | head -20` (digest line 45). Agent narration (line 109): "vspec usecase verify TODO-001 printed only a cryptic `vspec CLI` line with no pass/fail signal — unclear whether it ran or needed different arguments. I fell back to usecase show to confirm the result visually." Narration line 92: "`verify` output was terse."

## Recommendation

CLI/API fix: `usecase verify` must emit an explicit machine-readable verdict (pass/fail, list of checks, and any failing invariants) in both human and --format=agent envelopes, with suggested_next_actions on failure. A verification command that prints a bare banner defeats its purpose and forced an agent workaround.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

`usecase verify` now emits an explicit verdict in human, JSON, and agent formats.
The structured result includes implementation-link checks, spec checks,
structural checks, deterministic drift, and `suggested_next_actions` for every
failing check. The agent envelope carries the same suggestions at top level, and
the human output prints them under `Next actions`.

Verified:

- `pnpm exec vitest run apps/cli/tests/unit/usecase-verify-next-actions.test.ts apps/cli/tests/unit/verify-command.test.ts apps/cli/tests/unit/usecase-verify-routing.test.ts apps/cli/tests/unit/usecase-verify-checks.test.ts`
- `bash goals/55-dogfood-usecase-verify-returns-opaque-output-with-no-pass-.gates.sh`
