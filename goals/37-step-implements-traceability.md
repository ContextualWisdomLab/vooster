# Goal 37 -- Step implementation traceability

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

Scenario steps must carry explicit implementation references so a spec step can
be traced to the code or test artifact that implements it.

## Why This Goal Exists

This promotes T1 from
`docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md`. The
project could already express which use cases a step invokes, but it had no
machine-readable link from a step to code or tests. That left "verified by
implementation" claims dependent on prose and memory instead of a persisted
contract.

## Completion Conditions

1. Persisted steps include an `implements` string array with a default empty
   value.
2. API and contract schemas accept and return implementation references, and
   malformed refs are rejected before the API fetch path in the CLI.
3. Markdown import/export round-trips trailing
   `_(implements: path, path:symbol)_` annotations alongside invocation
   annotations.
4. Revision content hashes include step implementation links.
5. Doctor reports a `steps.unlinked` warning when scenario steps have no
   implementation links.

## Sources Of Truth

- `docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md`
- `apps/api/prisma/schema.prisma`
- `packages/contracts/src/scenario.ts`
- `apps/api/src/domain/entities/step.ts`
- `apps/api/src/infrastructure/prisma-signup-mappers.ts`
- `apps/api/src/application/markdown-invocations.ts`
- `apps/api/src/application/markdown-renderer.ts`
- `apps/api/src/application/doctor.ts`
- `apps/api/src/http/step-routes.ts`
- `apps/cli/src/commands/step.ts`

## Verification

```
pnpm --filter @vooster/contracts build
pnpm --filter @vooster/api typecheck
pnpm exec vitest run packages/contracts/tests/scenario.test.ts apps/api/tests/unit/http/sync-markdown.test.ts apps/api/tests/unit/application/markdown-export.test.ts apps/api/tests/unit/application/doctor.test.ts apps/api/tests/unit/prisma-signup-mappers.test.ts apps/cli/tests/unit/step-agent-format.test.ts
bash goals/37-step-implements-traceability.gates.sh
bash scripts/completion-check.sh
```
