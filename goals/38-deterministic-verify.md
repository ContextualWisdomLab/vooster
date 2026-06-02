# Goal 38 -- Deterministic verify command

> An agent taking this goal active must first read
> `guidelines/goal-iteration.md` for the iteration protocol.

## Mission

`vspec verify <KEY-NNN>` must deterministically check whether spec-step
implementation links resolve to local files or symbols, and optionally delegate
linked test execution to a caller-provided command.

## Why This Goal Exists

This promotes T2 from
`docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md`. Goal 37
added first-class `implements` refs to scenario steps. The next trust gap is
the missing CLI command behind the landing promise: a repeatable local check
that can later be wrapped by CI without relying on LLM semantic judgment.

## Completion Conditions

1. `vspec verify <KEY-NNN>` is routed by the CLI dispatcher.
2. Linked refs resolve deterministically against the working tree:
   file refs require an existing file, and `path:symbol` refs require a present
   symbol string in that file.
3. Broken links exit with code `1` and list broken refs; unlinked steps exit
   with code `7` when no broken links exist.
4. When all links resolve, `--test-cmd` is delegated and only its exit code
   affects the verify result.
5. Ten repeated runs on the same input produce identical JSON output and exit
   code.

## Sources Of Truth

- `docs/findings/2026-06-02T1804-spec-code-verification-trust-gap.md`
- `docs/07-cli-spec.md`
- `apps/cli/src/commands/verify.ts`
- `apps/cli/src/index.ts`
- `apps/cli/tests/unit/verify-command.test.ts`
- `apps/cli/tests/unit/dispatcher-routes.test.ts`

## Verification

```
pnpm --filter @vooster/cli typecheck
pnpm exec vitest run apps/cli/tests/unit/verify-command.test.ts apps/cli/tests/unit/dispatcher-routes.test.ts
bash goals/38-deterministic-verify.gates.sh
bash scripts/completion-check.sh
```
