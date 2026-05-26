---
title: CI runs full lint/typecheck/test matrix on code-free pushes
created_at: 2026-05-25T18:23:52Z
resolved: true
priority: P2
resolved_by:
  - 508c6c2
  - 20f8dd4
status_notes: |
  Path-filter on CI (.github/workflows/ci.yml) — CLOSED on 2026-05-25.
    Skips the lint+typecheck+4-shard test matrix when a push/PR touches only
    proven-non-code paths. Measured to drop 36.6% of pushes with zero
    false-skips of a code change.
  Test-job overhead (build now runs 2x instead of 4x) — CLOSED on 2026-05-27
    by 20f8dd4. The test matrix is shard [1,2] with --shard=i/2, and
    scripts/check-ci.sh now rejects ci.yml matrices above 2 shards plus shard
    denominator drift. Observed CI after the change:
    run 26460852463 (20f8dd4) succeeded with lint-typecheck 41s, test (1) 3m36s,
    and test (2) 3m26s = 9 billable minutes. Previous comparable run
    26460651003 (011c5f2) had lint-typecheck 46s plus four test jobs
    (2m25s, 2m08s, 2m18s, 2m37s) = 13 billable minutes.
  (Priority lowered P1→P2: the P1 driver was the branch-protection/post-hoc-CI
    process item, removed 2026-05-27 — see note below. The remaining shard
    item is now closed.)
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

## Resolved items / recommendations (data-backed)

1. **Test-job overhead (P2, ~9 CI-h/week)**. ~50% of each test shard was fixed
   setup, and `pnpm -r build` (38s) runs **4×** when 1 build would do. Options
   were (a) drop the matrix `shard: [1,2,3,4]` → `[1,2]`; (b) build once in a
   setup job, upload `dist` artifact, download per shard. **Decision LOCKED
   2026-05-27 → option (a)**, the boring/reversible win. Shipped in `20f8dd4`.

> **Removed 2026-05-27 — branch-protection / post-hoc-CI process item.** A
> prior revision raised "route the autonomous agent through PRs + branch
> protection so CI runs before the commit lands on main." That is **mutually
> exclusive** with the agent's `commit → push origin main` workflow: turning on
> branch protection blocks direct pushes, which would wedge the autonomous
> loop. It is a harness-redesign decision, not a resource-waste fix, so it is
> deliberately dropped from this finding. Re-raise as a separate
> harness-redesign finding if/when the team wants PR-gated agent commits.

## Build spec — locked for unattended execution (2026-05-27)

Decision-free; an overnight agent can execute mechanically.

1. In `.github/workflows/ci.yml`, change the test job matrix
   `shard: [1, 2, 3, 4]` → `shard: [1, 2]` (currently at `ci.yml:102-103`).
   Leave the `pnpm -r build` step and everything else untouched — option (b)
   (artifact sharing) is explicitly **not** part of this change.
2. If the shard count is referenced anywhere else (e.g. a `--shard=$i/4`
   argument in `scripts/run-tests.sh` or the workflow), update the denominator
   to `/2` consistently so all tests still run across the 2 shards. Grep:
   `rg -n 'shard|/4|1,2,3,4' .github/workflows scripts` and reconcile.
3. **Measurement requirement** (satisfies the finding's "measure before
   picking"): after the change lands and CI runs once on a code push, append
   the observed before/after `test`-job billable minutes to this finding's
   status_notes (target: 12 → ≤8).
4. **Guard**: if the next CI run on `main` is **red** for a reason caused by
   this change (e.g. a test only ran under shard 3/4 and is now skipped), the
   sharding is mis-wired — revert the commit and record a blocker. A correct
   2-shard split runs **every** test, just across 2 jobs.

## Acceptance signal

- Shipped item: push a `docs/state/`-only change to `main`; **no CI run**
  appears for that SHA (`gh run list --workflow=ci.yml`), while a sibling
  `apps/**` push still triggers all 5 jobs.
- Resolved item 1: after the shard change, the `test` job runs **2** parallel jobs
  (not 4), every test still executes (no count drop vs. the 4-shard run), and
  billable minutes for the `test` job drop from ~12 to ≤8 on a code push.

## Resolution

- `508c6c2` added fail-safe `paths-ignore` coverage for code-free pushes.
- `20f8dd4` reduced the CI test matrix from 4 shards to 2, updated the
  `--shard` denominator, and extended `scripts/check-ci.sh` so future drift is
  rejected. Acceptance evidence: `bash scripts/check-ci.sh`,
  `bash scripts/completion-check.sh`, and GitHub Actions run `26460852463`
  all exited successfully. Observed billable minutes moved from 13
  (run `26460651003`) to 9 (run `26460852463`).
