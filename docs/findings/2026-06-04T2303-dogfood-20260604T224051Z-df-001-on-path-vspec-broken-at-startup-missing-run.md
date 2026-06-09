---
title: On-PATH vspec broken at startup: missing runtime deps require manual symlink repair
created_at: 2026-06-04T23:03:54Z
resolved: true
priority: P1
source: dogfood-loop cycle 20260604T224051Z
related:
  - docs/dogfood-loop.md
---

# On-PATH vspec broken at startup: missing runtime deps require manual symlink repair

**TL;DR.** Ensure the published/installed CLI carries its runtime deps (bundle zod + @vooster/contracts, or declare them as hard dependencies so install resolves them) so `vspec --version` works immediately after install with no source/tsx fallback. A normal agent cannot be expected to discover and symlink monorepo internals.

Surfaced by the dogfood loop (cycle `20260604T224051Z`). QUANTS: ANTS.
Root-cause area: `apps/cli (bin launcher + package.json packaging / bundledDependencies); distribution of the global @vooster/cli install`. Routing: codex.

## Evidence

Error samples lines 80-88: `Error: Cannot find module 'tsx'`, `code: 'MODULE_NOT_FOUND'`, `throw Object.assign(new Error("Use source CLI"), { code: "ERR_MODULE_NOT_FOUND" });`, `ERR code: ERR_MODULE_NOT_FOUND`. Narration lines 98-108 show the agent spending its first ~12 tool calls diagnosing: "The vspec tool is broken — its launcher can't find the tsx module" → "the global install ... had a built dist/ but was missing two runtime deps" → it recovered only by symlinking zod@4.4.3 and @vooster/contracts from a monorepo it happened to find. No vspec command worked until this manual repair.

## Recommendation

Ensure the published/installed CLI carries its runtime deps (bundle zod + @vooster/contracts, or declare them as hard dependencies so install resolves them) so `vspec --version` works immediately after install with no source/tsx fallback. A normal agent cannot be expected to discover and symlink monorepo internals.

## Acceptance signal

Re-running the dogfood case that produced this finding no longer
reports it at P0/P1 severity.

## Resolution

`@vooster/cli` now declares `zod` as a runtime dependency, so the packed global
install carries the runtime module used by the launched CLI. The pack-install
integration test installs the tarball into a throwaway prefix and verifies
`vspec --version` runs without the module-resolution startup errors from this
finding.
