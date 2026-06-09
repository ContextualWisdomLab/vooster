---
title: `verify` flags `unlinked_steps` / demands `implements` refs in a code-less, DRAFT spec repo (false positive)
created_at: 2026-06-04T21:16:57Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T204814Z
related:
  - docs/dogfood-loop.md
---

# `verify` flags `unlinked_steps` / demands `implements` refs in a code-less, DRAFT spec repo (false positive)

**TL;DR.** Gate `unlinked_steps` on whether the project has any implementation/test surface (or use-case status past DRAFT). Pressuring the agent to add `implements` refs to nonexistent code is a doctor/verify false positive that, if obeyed, degrades a good spec — exactly the failure the task warned against.

Surfaced by the dogfood loop (cycle `20260604T204814Z`). QUANTS: NSQ.
Root-cause area: `apps/api/src/application (verify step-linking heuristic) + apps/cli/src/commands/verify`. Routing: codex.

## Evidence

Narration line 146: verify flags every step on POCKET-001..005 as "unlinked" and suggests adding `implements` refs, while verify itself reports `Tests not run` and the repo has no implementation code; use cases are at DRAFT. The agent correctly pushed back rather than fabricate links. All real spec gates (actors_registered, scenario_completeness, extension_points_resolved, cockburn_fidelity) were green.

## Recommendation

Gate `unlinked_steps` on whether the project has any implementation/test surface (or use-case status past DRAFT). Pressuring the agent to add `implements` refs to nonexistent code is a doctor/verify false positive that, if obeyed, degrades a good spec — exactly the failure the task warned against.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution evidence

- `verify` suppresses `unlinked_steps` for DRAFT use cases when the local root
  has no source/test surface, while still reporting unlinked steps when source
  or tests exist or the use case is past DRAFT.
- API doctor no longer reports `steps.unlinked` for DRAFT use cases.
- `pnpm exec vitest run apps/cli/tests/unit/usecase-verify-next-actions.test.ts apps/cli/tests/unit/usecase-verify-routing.test.ts apps/cli/tests/unit/verify-command.test.ts apps/api/tests/unit/application/doctor.test.ts`
  passes.
- `pnpm exec tsc -p tsconfig.json --noEmit` and
  `pnpm exec eslint . --max-warnings 0` pass.
