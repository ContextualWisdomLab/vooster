---
case_id: DF-005
severity: P1
resolved: true
---

# Goal 62: Dogfood Finding Follow-Up

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

Resolve the dogfood finding **Doctor's "N use case(s) visible" count includes
archived specs that `usecase list` hides**.

The finding is recorded inline in this file (see _Source finding_ below); the
`resolved:` flag in the frontmatter above is the structural anchor that
`62-...gates.sh` reads. Flip it to `true` only after the fix lands with test
evidence.

Root-cause area: `apps/api/src/http` (doctor route count) and `apps/cli`
(`usecase list` scope) — vocabulary drift between "visible" and what `list`
returns.

## Source finding

`vspec doctor` reported `"6 use case(s) visible in this project."` while
`vspec usecase list` (and `pull`) showed only POCKET-001..005 = 5. The phantom
6th was an archived spec, POCKET-006: the doctor count included archived use
cases, but the default `usecase list` scope excludes them. The 6-vs-5 gap drove
roughly 15 command groups of investigation and a long dead-end hunt for the
"missing" 6th use case before the archived split was discovered. Drift between
doctor's count and list's scope is a contract bug, not cosmetic.

## Completion

A. The source finding is resolved: the `resolved:` frontmatter flag in this
file is set to `true` after the implementation addresses the recommendation
below.

B. The implementation is verified with the smallest relevant test or dogfood
rerun, and this file records that evidence in a _Verification_ section.

## Recommendation

Make the doctor count agree with the default `usecase list` scope. Either count
only non-archived use cases (so doctor and `list` report the same number), or
relabel the doctor output to make the archived split explicit (e.g. "5 active,
1 archived") so the number can never be mistaken for what `list` returns. The
two surfaces must not disagree silently — a count the agent reads as "use cases
it can act on" must match the scope of the command that lists them. Per rubric
principle, the output must not mislead the agent into a dead-end hunt
(`docs/06-api-contract.md`).

## Verification

- Added an integration regression in
  `apps/api/tests/integration/http/doctor-route.test.ts` that creates one
  active and one archived use case, then asserts `doctor`'s visible count
  matches the default list result.
- Verification:
  `pnpm exec vitest run apps/api/tests/integration/http/doctor-route.test.ts`;
  `pnpm --filter @vooster/api typecheck`.
