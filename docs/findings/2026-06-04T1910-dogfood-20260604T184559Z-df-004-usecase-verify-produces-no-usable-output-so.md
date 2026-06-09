---
title: usecase verify produces no usable output, so the agent abandons it and verifies via usecase show
created_at: 2026-06-04T19:10:26Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T184559Z
related:
  - docs/dogfood-loop.md
---

# usecase verify produces no usable output, so the agent abandons it and verifies via usecase show

**TL;DR.** Make `usecase verify` emit a deterministic, non-interactive result with `--format=agent`: a pass/fail status plus a structured list of checks (missing actors, levels, stakeholders, extensions) so agents can act on it. A verify command that yields nothing actionable is a core-workflow gap and duplicates a known issue (cf. df-006 'usecase verify returns opaque output').

Surfaced by the dogfood loop (cycle `20260604T184559Z`). QUANTS: ATSN.
Root-cause area: `apps/cli/src/commands (usecase verify) and apps/api/src/application; docs/07-cli-spec.md`. Routing: codex.

## Evidence

Digest cmd 60 looped `vspec usecase verify $k` over POCKET-003/004/005; cmd 61 checked `help usecase verify`; cmd 62 tried `verify --usecase POCKET-005 --format=agent` with a positional-arg fallback. Narration (line 136): "`verify` isn't producing useful output (likely interactive). Let me do a final structural confirmation via the agent payload for each." The agent dropped verify entirely and used `usecase show --format=agent` (cmd 64) to confirm coherence.

## Recommendation

Make `usecase verify` emit a deterministic, non-interactive result with `--format=agent`: a pass/fail status plus a structured list of checks (missing actors, levels, stakeholders, extensions) so agents can act on it. A verify command that yields nothing actionable is a core-workflow gap and duplicates a known issue (cf. df-006 'usecase verify returns opaque output').

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

`usecase verify` now emits a deterministic structural verdict in every format.
The result payload includes `structural_checks` for `primary_actor`, `level`,
`stakeholders`, and `extensions`; each entry reports `present` or `missing`, and
missing structural checks feed the shared `status`, `exit_code`, and `drift`
rollup. Human output prints the same non-interactive structural lines, and
agent/json output carries the structured checks in `data`.

The verify result also carries `suggested_next_actions` for each failing check,
so an agent no longer has to fall back to `usecase show` to infer the next move.
The shape is documented in `docs/07-cli-spec.md`.

Verified:

- `pnpm exec vitest run apps/cli/tests/unit/usecase-verify-next-actions.test.ts apps/cli/tests/unit/verify-command.test.ts apps/cli/tests/unit/usecase-verify-routing.test.ts apps/cli/tests/unit/usecase-verify-checks.test.ts`
- `bash goals/55-dogfood-usecase-verify-returns-opaque-output-with-no-pass-.gates.sh`
