---
case_id: DF-001
severity: P1
resolved: true
---

# Goal 68: Dogfood Finding Follow-Up

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

Resolve the dogfood finding **On-PATH `vspec` broken at startup: missing runtime
deps require manual symlink repair**.

The finding is recorded inline in this file (see _Source finding_ below); the
`resolved:` flag in the frontmatter above is the structural anchor that
`68-...gates.sh` reads. Flip it to `true` only after the fix lands with test
evidence.

Root-cause area: `apps/cli` (bin launcher + `package.json` packaging /
`bundledDependencies`); distribution of the global `@vooster/cli` install.

## Source finding

A freshly installed, on-PATH `vspec` failed at startup with
`Error: Cannot find module 'tsx'` / `code: 'MODULE_NOT_FOUND'` and a launcher
fallback that threw
`Object.assign(new Error("Use source CLI"), { code: "ERR_MODULE_NOT_FOUND" })`
(`ERR code: ERR_MODULE_NOT_FOUND`). The agent burned its first ~12 tool calls
diagnosing it: "The vspec tool is broken — its launcher can't find the tsx
module" → "the global install ... had a built `dist/` but was missing two
runtime deps" → it recovered only by hand-symlinking `zod@4.4.3` and
`@vooster/contracts` from a monorepo it happened to find. No `vspec` command
worked until that manual repair. A normal agent cannot be expected to discover
and symlink monorepo internals.

## Completion

A. The source finding is resolved: the `resolved:` frontmatter flag in this
file is set to `true` after the implementation addresses the recommendation
below.

B. The implementation is verified with the smallest relevant test or dogfood
rerun, and this file records that evidence in a _Verification_ section.

## Recommendation

Ensure the published/installed CLI carries its runtime dependencies so
`vspec --version` (and other commands) works immediately after a clean global
install with no source/`tsx` fallback. Bundle the runtime deps the launched
entrypoint imports — at minimum `zod` and `@vooster/contracts` — via
`bundledDependencies`, or declare them as hard `dependencies` so install
resolves them. The packaged bin must not depend on `tsx` or on a sibling
monorepo being present on disk. Prove it the way a real install behaves: pack
the CLI (`pnpm pack` / `npm pack`), install the tarball into a throwaway
prefix, and assert `vspec --version` exits 0 without any
`MODULE_NOT_FOUND` / `ERR_MODULE_NOT_FOUND` / "Use source CLI" output.

## Verification

- RED: `pnpm exec vitest run apps/cli/tests/integration/dogfood-provision-pack.test.ts`
  failed because the packed global `vspec --version` fell through to the source
  fallback and printed `Cannot find module 'tsx'`.
- GREEN: `pnpm exec vitest run apps/cli/tests/integration/dogfood-provision-pack.test.ts`
  now packs the CLI, installs it into a throwaway global prefix, and verifies
  `vspec --version` exits 0 without `MODULE_NOT_FOUND`,
  `ERR_MODULE_NOT_FOUND`, or `Use source CLI` output.
