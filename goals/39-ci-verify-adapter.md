# Goal 39 -- CI verify adapter

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

Ship a GitHub Action adapter for `vspec verify` so deterministic spec-code
verification can block pull requests without a separate cloud service.

## Why This Goal Exists

This promotes T3 from
`docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md`. Goal 38
proved the local deterministic command. The next trust gap is the public CI
promise: "PR blocked" must be backed by a thin Action/workflow layer that runs
the same binary and surfaces the same result in GitHub.

## Completion Conditions

1. `action.yml` runs the CLI verify implementation and maps exit code 0 to
   pass, exit code 1 to fail, and exit code 7 through configurable
   unlinked-step policy.
2. `.github/workflows/vspec-verify.yml` is a copy-paste workflow that invokes
   the local Action and comments on pull requests when verification fails.
3. `vspec init --verify-workflow` writes a ready workflow template for a
   caller's repository.
4. The adapter takes API URL/session inputs but does not require Vooster cloud;
   callers can point it at local config, self-hosted API, or the hosted API.

## Sources Of Truth

- `docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md`
- `docs/07-cli-spec.md`
- `action.yml`
- `.github/workflows/vspec-verify.yml`
- `apps/cli/src/commands/init.ts`
- `apps/cli/tests/unit/init-command.test.ts`
- `apps/cli/tests/unit/verify-action.test.ts`

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/init-command.test.ts apps/cli/tests/unit/verify-action.test.ts
bash goals/39-ci-verify-adapter.gates.sh
bash scripts/completion-check.sh
```
