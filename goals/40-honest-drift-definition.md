# Goal 40 -- Honest drift definition

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

Define "spec drift" as the deterministic `vspec verify` surface and align docs
plus landing copy so the product no longer implies semantic code/spec judgment.

## Why This Goal Exists

This promotes T4 from
`docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md`. Goals 37-39
made link-based verification real. The remaining trust gap is wording: the
landing must describe the shipped deterministic behavior, not a broader
semantic agreement check that would require non-deterministic LLM judgment.

## Completion Conditions

1. `vspec verify --format=agent` exposes drift kinds
   `broken_link`, `failing_test`, and `unlinked_step`.
2. `docs/07-cli-spec.md` states that drift is not semantic mismatch detection
   and is limited to those deterministic conditions.
3. `HowItWorks.astro` and `Onboarding.astro` describe link/test-based
   verification instead of semantic spec/code agreement.

## Sources Of Truth

- `docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md`
- `docs/07-cli-spec.md`
- `apps/cli/src/commands/verify.ts`
- `apps/cli/tests/unit/verify-command.test.ts`
- `apps/www/src/components/sections/HowItWorks.astro`
- `apps/www/src/components/sections/Onboarding.astro`
- `apps/www/tests/unit/landing-drift-copy.test.ts`

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm --filter @vooster/www typecheck
pnpm exec vitest run apps/cli/tests/unit/verify-command.test.ts apps/www/tests/unit/landing-drift-copy.test.ts
bash goals/40-honest-drift-definition.gates.sh
bash scripts/completion-check.sh
```
