#!/usr/bin/env bash
set -uo pipefail
cat <<'TASK'
TASK: Resolve the dogfood finding "On-PATH `vspec` broken at startup: missing runtime deps require manual symlink repair".

1. Read goals/68-dogfood-on-path-vspec-broken-at-startup-missing-runtime-de.md (the finding is recorded inline under "Source finding").
2. Add a failing test that captures the finding's user-visible failure: a clean install of the packaged @vooster/cli must run `vspec --version` (exit 0) with NO `MODULE_NOT_FOUND`, `ERR_MODULE_NOT_FOUND`, or "Use source CLI" output, and without `tsx` or a sibling monorepo being present on disk. Drive it via a pack/install rerun: `pnpm pack` (or `npm pack`) the CLI, install the tarball into a throwaway prefix, then invoke the installed bin.
3. Implement the smallest fix in the stated root-cause area (apps/cli bin launcher + package.json packaging): ensure the launched entrypoint's runtime deps — at minimum `zod` and `@vooster/contracts` — ship with the package via `bundledDependencies`, or are declared as hard `dependencies` so install resolves them. The packaged bin must not require `tsx` or fall back to a source CLI.
4. Run the targeted test and the relevant gate.
5. Record verification evidence in the .md (fill in the "## Verification" section with the failing-then-passing test or the pack/install dogfood rerun and the exact command used) and set `resolved: true` in its frontmatter.
TASK
