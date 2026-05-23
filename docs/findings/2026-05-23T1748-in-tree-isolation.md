---
title: "Survey in-tree shared resources for parallel gate isolation"
created_at: 2026-05-23T17:48:00Z
priority: P0
resolved: true
resolved_by: bf8c5d0
related:
  - scripts/completion-check.sh
  - docs/findings/2026-05-23T1745-build-dedup.md
  - docs/findings/2026-05-23T1715-world-state-separation.md
  - scripts/check-managed-db.sh
---

# Findings — survey in-tree shared resources for parallel gate isolation

## TL;DR

The build race fixed in
[`2026-05-23T1745-build-dedup.md`](./2026-05-23T1745-build-dedup.md)
is the first known instance of a broader class: **parallel gate
workers stepping on each other through shared mutable state inside
the working tree** (`dist/`, log files, temp dirs, possibly
`node_modules/.cache`, etc.). This file queues the systematic sweep.

Three patterns address such conflicts:

1. **Deduplicate** — same expensive action invoked from multiple
   places → consolidate to one owner. _Already applied to `pnpm
build`._
2. **Isolate per-worker** — mutable state cheaply namespaced per
   worker (DB schema, network port, log file, temp dir).
3. **Lock** — single shared external resource that cannot be
   isolated or deduplicated. Last resort.

Most expected hits fall into (1) or (2). (3) is rare and mostly
covered by the world-state separation work
([2026-05-23T1715-world-state-separation.md](./2026-05-23T1715-world-state-separation.md)).

## Survey methodology

For each `*.gates.sh` and each `scripts/check-*.sh`:

1. Grep for **expensive shared outputs**:
   - `pnpm build`, `pnpm install`, `pnpm exec tsc`
   - `npx vitest run` (writes coverage/, logs)
   - `prisma generate`, `prisma migrate`
   - Anything writing to `dist/`, `.next/`, `.turbo/`, `coverage/`,
     `node_modules/.cache/`, `.state/`, `apps/*/dist/`
2. Grep for **shared mutable state**:
   - Hardcoded ports (`:5432`, `:8080`, etc.)
   - Hardcoded log paths (`/tmp/*.log` without `$$` or `$RANDOM`)
   - Database names without per-worker prefix
   - Temp files in shared locations
3. Grep for **external system calls** (these already moved off the
   chain per world-state separation — verify):
   - `docker run/exec/build`
   - `vercel `
   - `gh api`
   - `curl https://`

Classify each hit:

- **Already safe** — has `$SUFFIX` / `$$` / `$RANDOM` namespace, or
  is read-only.
- **Needs dedup** — expensive shared action duplicated across gates.
- **Needs isolate** — mutable state with no namespace.
- **Needs lock or world-state moveout** — neither dedup nor isolate
  applies.

## Known starting points

- ✓ **`check-managed-db.sh`** uses `vspec_managed_pg_${SUFFIX}` and
  `vspec_managed_app_${SUFFIX}` — already isolate-per-worker.
- ✗ **`dogfood-test.sh`** was building into shared `dist/` — fixed
  by 2026-05-23T1745 dedup.
- ? **`/tmp/_meta-vitest.log`** — hardcoded path. If two `_meta`
  workers somehow ran in parallel (they don't, M.3 is gated by
  SKIP_DEEP) this would conflict. Low risk but worth namespacing.
- ? **`.state/dogfood.log`** — same hardcoded-path pattern.
- ? **`coverage/`** — `VSPEC_COVERAGE_DIR` env var exists. If
  defaulted, no per-worker isolation; if env-driven, fine.
- ? **`.state/gate-cache/<goal-name>`** — already per-goal
  namespaced. Should be safe.

## Why P0

Bumped from P1 to P0 because the survey + fixes affect _every_ future
parallel chain run. One observed race
([build-dedup](./2026-05-23T1745-build-dedup.md)) is already a
demonstrated efficiency tax on every iteration; remaining unknown
races likely follow the same pattern. Harness reliability multiplies
across all downstream work.

The survey itself is cheap (a couple of hours, no architectural
change). Acting on the map is per-finding and each item can be
small. Front-loading this before any goal-30-style TDD work pays for
itself in fewer flaky-iteration debugging sessions.

## Suggested next-step shape

If this becomes a goal, the universal claim would be:

> Every parallel-worker invocation in `goals/*.gates.sh` and
> `scripts/check-*.sh` that touches mutable in-tree state either
> deduplicates to a single owner or isolates via per-worker
> namespace.

The matching universal gate would enumerate every `*.gates.sh` /
`check-*.sh` and run a structured grep for the danger patterns above.
Negative-grep invariant — "no hardcoded port literals, no shared
output paths without namespace" — fits cleanly in the (II) category
from `docs/goal-design.md §1.5`.

## Why I'm filing instead of fixing

Diagnosis is cheap; fixes are file-by-file. Doing the whole sweep in
one session is scope creep. Filing here lets a future agent (or the
same agent in a fresh session) pick up with the methodology and the
known starting points already laid out.

## Resolution

Closed by `bf8c5d0` (`fix(harness): isolate parallel gate state`).

Survey result:

- `scripts/dogfood-test.sh` now writes a per-invocation `.state`
  dogfood log instead of `.state/dogfood.log`.
- `scripts/check-bootable.sh` and `scripts/check-persistence.sh` no
  longer run `pnpm build`; they consume the existing `dist/` output
  owned by `_meta` M.4.
- `_meta`, goal 2, and goal 4 diagnostic logs now use `mktemp`
  paths instead of fixed `/tmp/*` names.
- `scripts/check-deployable.sh` and `scripts/check-managed-db.sh`
  now use per-invocation cookie/body temp files.
- New `goals/30-in-tree-isolation.*` enforces the negative universal
  invariant across `goals/*.gates.sh`, `scripts/check-*.sh`, and
  `scripts/dogfood-test.sh`.

Verification:

- `bash goals/30-in-tree-isolation.gates.sh`
- `bash scripts/completion-check.sh`
