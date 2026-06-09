---
case_id: DF-005
severity: P1
resolved: true
---

# Goal 65: Dogfood Finding Follow-Up

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

Resolve the dogfood finding **`verify` flags `unlinked_steps` / demands
`implements` refs in a code-less, DRAFT spec repo (false positive)**.

The finding is recorded inline in this file (see _Source finding_ below); the
`resolved:` flag in the frontmatter above is the structural anchor that
`65-...gates.sh` reads. Flip it to `true` only after the fix lands with test
evidence.

Root-cause area: `apps/api/src/application` (the `verify` step-linking
heuristic) and `apps/cli/src/commands/verify` — the `unlinked_steps` check
fires even when the project has no implementation or test surface to link to,
and the use cases are still at `DRAFT`.

## Source finding

A task asked the agent to act on what `verify` reported. For POCKET-001..005,
`verify` flagged *every* step as `unlinked` and suggested adding `implements`
refs — while `verify` itself reported `Tests not run`, the repo contained no
implementation code, and all five use cases were still at `DRAFT`. Meanwhile
every real spec gate was green (`actors_registered`, `scenario_completeness`,
`extension_points_resolved`, `cockburn_fidelity`). The agent correctly pushed
back rather than fabricate `implements` links to code that does not exist.
Pressuring the agent to add `implements` refs to nonexistent code is a
doctor/verify false positive that, if obeyed, would degrade an otherwise good
spec — exactly the failure mode the rubric warns against.

## Completion

A. The source finding is resolved: the `resolved:` frontmatter flag in this
file is set to `true` after the implementation addresses the recommendation
below.

B. The implementation is verified with the smallest relevant test or dogfood
rerun, and this file records that evidence in a _Verification_ section.

## Recommendation

Gate the `unlinked_steps` check so it does not fire when the project has no
surface to link against. Concretely: `verify` must only raise `unlinked_steps`
(and only then suggest adding `implements` refs) once the project has an
implementation/test surface OR the use case has advanced past `DRAFT`. When the
repo is code-less and the use case is at `DRAFT`, `unlinked_steps` must not be
reported and `verify` must not pressure the agent to add `implements` refs to
code that does not exist. This gating must apply uniformly to every use case
`verify` evaluates — it must not special-case one key while leaving the same
false positive live on the others. The real spec gates (`actors_registered`,
`scenario_completeness`, `extension_points_resolved`, `cockburn_fidelity`)
must continue to fire as before. Per rubric principle, `verify` output must not
mislead the agent into degrading a clean spec to satisfy a check that cannot
yet be satisfied (`docs/06-api-contract.md`).

## Verification

- RED: `pnpm exec vitest run apps/cli/tests/unit/verify-command.test.ts apps/api/tests/unit/application/doctor.test.ts`
  failed because DRAFT, code-less specs still emitted `unlinked_steps` and
  doctor `steps.unlinked`.
- GREEN: `pnpm exec vitest run apps/cli/tests/unit/usecase-verify-next-actions.test.ts apps/cli/tests/unit/usecase-verify-routing.test.ts apps/cli/tests/unit/verify-command.test.ts apps/api/tests/unit/application/doctor.test.ts`
  passes.
- Typecheck: `pnpm exec tsc -p tsconfig.json --noEmit` passes.
- Lint: `pnpm exec eslint . --max-warnings 0` passes.
