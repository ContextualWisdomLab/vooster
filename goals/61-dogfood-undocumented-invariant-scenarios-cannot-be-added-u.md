---
case_id: DF-004
severity: P1
resolved: true
---

# Goal 61: Dogfood Finding Follow-Up

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

Resolve the dogfood finding **Undocumented invariant: scenarios cannot be added
until the use case has >=1 stakeholder interest, surfaced only as a late
`SCHEMA_INVALID`**.

The finding is recorded inline in this file (see _Source finding_ below); the
`resolved:` flag in the frontmatter above is the structural anchor that
`61-...gates.sh` reads. Flip it to `true` only after the fix lands with test
evidence.

Root-cause area: `apps/api/src/http/scenario-routes.ts`,
`apps/api/src/http/scenario-support.ts`,
`apps/api/src/application/ai-guide.ts`.

## Source finding

The agent repeatedly misread a scenario-add failure as "transient" across
multiple retries on POCKET-003/005/004, then discovered the real rule only on
POCKET-004: `SCHEMA_INVALID: Use case needs at least one stakeholder interest`.
The prerequisite — that a use case must have at least one stakeholder interest
before any scenario can be added — is not stated in `ai-guide`, and the
scenario-add error carried no `suggested_next_actions` pointing at
`usecase add-stakeholder`. With no remedy in the error and no ordering hint up
front, the agent burned turns guessing.

## Completion

A. The source finding is resolved: the `resolved:` frontmatter flag in this
file is set to `true` after the implementation addresses the recommendation
below.

B. The implementation is verified with the smallest relevant test or dogfood
rerun, and this file records that evidence in a _Verification_ section.

## Recommendation

Attach `suggested_next_actions` to the `SCHEMA_INVALID` "needs at least one
stakeholder interest" error so it points at `usecase add-stakeholder` and
teaches the remedy in-band — the agent should never have to guess the
prerequisite. Document the ordering (stakeholder interest before scenarios) in
`ai-guide` so the dependency is discoverable before it is hit. Consider as a
follow-up whether scenario creation should hard-block on stakeholder interests
at all, or warn instead. Per rubric principle 2, errors must be self-teaching
(`docs/06-api-contract.md`).

## Verification

- Added application coverage in
  `apps/api/tests/unit/application/scenario-authoring.test.ts` proving the
  missing stakeholder-interest result carries the use case key.
- Added HTTP coverage in `apps/api/tests/unit/http/scenario-results.test.ts`
  proving the `SCHEMA_INVALID` response suggests
  `vspec usecase add-stakeholder <key> ...`.
- Added guide coverage in `apps/api/tests/unit/application/ai-guide.test.ts`
  proving markdown and JSON guide output state the ordering before scenario
  creation.
- Verification:
  `pnpm exec vitest run apps/api/tests/unit/application/scenario-authoring.test.ts apps/api/tests/unit/http/scenario-results.test.ts apps/api/tests/unit/application/ai-guide.test.ts`;
  `pnpm --filter @vooster/api typecheck`.
