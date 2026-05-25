---
title: CI runs full lint/typecheck/test matrix on code-free pushes
created_at: 2026-05-25T18:23:52Z
resolved: partial
priority: P1
resolved_by:
  - 508c6c2
status_notes: |
  Path-filter on CI (.github/workflows/ci.yml) — CLOSED on 2026-05-25.
    Skips the lint+typecheck+4-shard test matrix when a push/PR touches only
    proven-non-code paths. Measured to drop 36.6% of pushes with zero
    false-skips of a code change.
  Test-job overhead (build run 4x, ~50% of each shard is fixed setup) — OPEN.
    Candidate: drop matrix shard 4→2, or build-once + share dist. See below.
  Process: CI is post-hoc on direct pushes to main; main was red ~84% of the
    last 5 days; no branch protection. Out of scope for "resource waste" but
    surfaced here — OPEN.
related:
  - .github/workflows/ci.yml
  - .github/workflows/verify.yml
---

# CI runs full lint/typecheck/test matrix on code-free pushes

## TL;DR

Every push to `main` ran the full blocking CI (~13 billable min: lint +
typecheck + a 4-shard Postgres test matrix). Over 213 real pushes
(2026-05-20..25), **39.4% touched no code at all** — they were
`docs/state/next-task.md` + `progress.md` harness bookkeeping, `goals/*`,
`docs/findings/*`, `.claude/*`. A measured, test-dependency-safe
`paths-ignore` denylist now skips **36.6% of pushes** with **zero
false-skips of a code change**, cutting ~18 CI-hours/week.

## Evidence (all from `gh api` + git, 2026-05-20..25)

- **Volume**: 232 CI runs / 7 days (~37/day). 1193 commits total; pushes
  batch ~6–7 commits each.
- **Cost per run** (job-step timing, GitHub bills each job ⌈min⌉):
  - `lint-typecheck`: ~45s wall → **1 min**.
  - `test` matrix ×4: each ~126s = ~60s fixed overhead (postgres init 11s,
    `pnpm -r build` 38s, setup ~11s) + ~62s actual vitest → **3 min each**.
  - Total **≈ 13 billable min/run** → 232 × 13 ≈ **3016 min/week (~50 h)**.
  - GitHub's `/timing` API reports `billable.UBUNTU.total_ms = 0` for this
    repo, so costs were reconstructed from per-job `started_at/completed_at`.
- **Code-free push rate**: reconstructed each push's diff from consecutive
  CI `head_sha` tips on `main` (213 pushes). **84/213 (39.4%)** touched no
  file under `apps/ scripts/ src/ tests/ .github/workflows/` or a build
  config (`package.json`, lockfile, `tsconfig*`, `vitest*`, `eslint*`).
  Dominant subtree: `docs/state/` (106 pushes — the harness next-task /
  progress files).
- **Test-dependency safety check**: grepped every test for
  `readFile`/`path.join` against these dirs. Only **`docs/build-harness.md`**
  (+ `docs/09-bootstrap.md`) is read by a test
  (`apps/api/tests/integration/readme.test.ts`). `commit-check.test.ts`
  references `goals/…` paths as **string args only**, never reading them.
  `docs/state/**`, `docs/findings/**`, `goals/**`, `cycles/**`, `prompts/**`,
  `.claude/**` have **no** test dependency.
- **Filter coverage**: simulating GitHub's `paths-ignore` semantics (skip iff
  _every_ changed file matches an ignore glob) over the 213 pushes, the
  shipped denylist skips **78/84 = 93%** of code-free pushes and **0** code
  pushes. The 6 misses are `docs/` root-file edits, deliberately left running.

## What shipped

`.github/workflows/ci.yml` — `paths-ignore` on both `push` and
`pull_request`, listing only `docs/` subtrees + non-code top-level dirs with
zero test dependency. `docs/` root files (`build-harness.md`, `09-bootstrap.md`)
are intentionally **not** ignored. `Verify` was left untouched: its concurrency
group already collapses most queued runs (only 16 ran in 7 days) so it costs
~128 min/week, and its gate sweep reads `goals/*.gates.sh` — filtering it
safely is more work than it saves.

Why a denylist, not an allowlist: anything new (a new top-level dir, a new
config) defaults to **running** CI. Fail-safe toward correctness.

Why not a required-check stub: `main` has **no branch protection / required
checks** (`gh api …/branches/main/protection` → 404), so a skipped CI never
blocks a merge — no stub job needed.

## Open items / recommendations (data-backed, not yet done)

1. **Test-job overhead (P2, ~9 CI-h/week)**. ~50% of each test shard is fixed
   setup, and `pnpm -r build` (38s) runs **4×** when 1 build would do. Options:
   (a) drop the matrix `shard: [1,2,3,4]` → `[1,2]` (12→8 billable min on the
   test job; ~4 min/code-run; trades ~2min extra wall latency); (b) build once
   in a setup job, upload `dist` artifact, download per shard. (a) is the
   boring win; (b) keeps 4-way parallelism. Measure before picking.
2. **Process: post-hoc CI on a red main (P1, structural)**. 166/183 changes
   reach `main` by **direct push**, and CI runs _after_ merge. CI failed
   ~84% of the last 5 days (now green for the last ~10 runs). The blocking
   gate gates nothing for the agent. If stability is the goal, route the
   autonomous agent through PRs + branch protection so CI runs _before_ the
   commit lands on `main`. Bigger change — left for a deliberate decision.

## Acceptance signal

- Shipped item: push a `docs/state/`-only change to `main`; **no CI run**
  appears for that SHA (`gh run list --workflow=ci.yml`), while a sibling
  `apps/**` push still triggers all 5 jobs.
- Open item 1: after a shard/build change, `test` job billable minutes drop
  from 12 to ≤8 on a code push (job-step timing).
