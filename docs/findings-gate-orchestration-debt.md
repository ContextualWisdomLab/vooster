# Findings — Gate Orchestration: Cold-Run Cost from Nested Tranche D

_Captured 2026-05-21 after `bb07214` ("perf(gates): key per-goal cache on
input fingerprint, not clean tree"). The cache fix solves the dominant
pain (re-runs while editing in parallel); this document records a
second-order improvement that was investigated, scoped, and deferred
because Goal 5 is still iterating on the same files._

## TL;DR

Each `goals/<n>-*.gates.sh` ends with a **Tranche D regression block**
that shells out to `goals/0..<n-1>-*.gates.sh` one by one. That gives N²
nested invocations across the suite. When per-goal caches are warm, each
nested call hits the cache and returns in ≈0.4 s, so the design is
near-free. When caches are cold (fresh clone, `.state/gate-cache/`
busted, `VSPEC_GATES_NO_CACHE=1`), the same N² shape forces the full
vitest + docker-build stack to run multiple times.

The proposed fix is to **lift Tranche D out of each per-goal script** and
have `scripts/completion-check.sh` (a) run all goals in parallel where
the chain allows and (b) be the single owner of the "no prior-goal
regression" semantics. This is a behavioural change (gates lose their
standalone "and the chain is still green" contract) and is deferred
until Goal 5 stops actively rewriting these files.

## Measurement (2026-05-21, after `bb07214`)

Cold full run of just `goals/5-monorepo.gates.sh` after `rm -rf
.state/gate-cache/`:

```
bash goals/5-monorepo.gates.sh  568.92s user 82.41s system 69% cpu 15:39.10 total
```

The 15:39 wall clock is dominated by Tranche D recursively running
goal-0..4 cold:

- **goal-0** `vitest run --coverage` + `tsc --noEmit` + `eslint .` +
  `dogfood-test.sh` — ≈60 s on this machine per
  `docs/findings-test-perf-debt.md`.
- **goal-2** `persistence-matrix.test.ts` (18 serial fastify boots,
  ≈40 s by itself) + `UC-001-real-oauth.test.ts` + `check-deployable.sh`
  (`docker compose build`, ≈30–90 s depending on cache).
- **goal-3** `persistence-matrix.test.ts` re-run against Postgres +
  `check-managed-db.sh` + `check-ci.sh`.
- **goal-4** full `eslint . --max-warnings 0` + boundary fixture lint +
  every prior chain again via its own D-block.
- **goal-5** Tranche D iterates `(0-init, 1-runnable, 2-shippable,
  3-managed-db, 4-honest-boundaries)` and calls each script — which
  themselves recurse into their own D-blocks.

Warm-cache behaviour (after `bb07214`, same machine, second invocation):

```
[cache hit] goal 0-init inputs unchanged
bash goals/0-init.gates.sh  0.24s user 0.14s system 103% cpu 0.375 total
```

So the production-path cost (running `completion-check.sh` once per
working session) is already amortized. The remaining cost is paid only
in cold scenarios.

## Why The Nested D-Chain Exists

Each per-goal gate script is designed to be **standalone**: `bash
goals/3-managed-db.gates.sh` must encode the full claim of goal 3,
including "no prior goal regressed". That contract is what justifies the
nested invocation: goal 3 cannot mark itself green without re-asserting
goal 0/1/2.

The design then leans on the per-goal cache to avoid quadratic blow-up.
In the warm case the nested calls are O(N) total wall clock; in the cold
case they're O(N²) because every recurrence re-runs the same heavy work
its parent already ran.

`scripts/completion-check.sh` enforces the same chain at the top level
(it iterates `goals/*.md` in numeric order). So in the normal workflow
the chain is paid twice: once by the orchestrator, once by Tranche D
inside each script. With warm caches that's still cheap; with cold
caches it doubles the worst case.

## Why a Simple "Just Parallelise It" Doesn't Work

Three concrete obstacles:

1. **Linear dependency**: goal N's narrative requires goal N-1 to be
   green. Parallelising 0..5 from a cold state means goal 4 may finish
   its own A/B/C tranche before goal 0 has saved a cache file — its
   internal Tranche D re-runs goal 0 in a second process while the
   orchestrator's goal-0 worker is still running. Two cold goal-0
   workers double the CPU/disk pressure and race for `.state/gate-cache/`.

2. **Resource contention**: `persistence-matrix.test.ts` alone spawns
   ~36 fastify children sequentially. Goal 2 and goal 3 both run it
   (against SQLite and Postgres respectively). In parallel that's 72
   fastify boots competing for ports + Postgres schemas + Docker's
   single daemon. On a laptop this thrashes; in CI it makes flake
   inevitable.

3. **Standalone contract**: removing Tranche D from each gate file means
   `bash goals/3-managed-db.gates.sh` alone no longer detects a goal-1
   regression. Codex's TDD harness uses single-gate invocations during
   iteration (it tightens loops by running just the affected goal); the
   harness would need to be retrained to call `completion-check.sh`
   instead. That's a workflow contract change, not a scripting tweak.

## The Recommended Fix (After Goal 5 Lands)

A focused PR that does all of the following together — partial
application breaks the standalone contract without delivering the
parallelism win:

1. **Delete the Tranche D block from every
   `goals/<n>-*.gates.sh`** (n = 1..5). The block today is the loop
   `for g in PRIOR_GOALS … bash goals/${g}.gates.sh`. Replace nothing —
   the no-regression semantics moves up one level.

2. **Rewrite `scripts/completion-check.sh` as a parallel orchestrator:**
   - Topologically order goals (today the order is linear: 0 → 1 → 2 →
     3 → 4 → 5). Run each as a background process; aggregate exits.
   - Stream each goal's stdout into a per-goal buffer; print buffers in
     deterministic order at the end. Do not interleave live output (the
     `[cache hit]` / `[5.A1]` / `✓ pass` lines must remain readable per
     goal for debugging).
   - Preserve `VSPEC_GATES_SKIP_DEEP=1` and `VSPEC_GATES_NO_CACHE=1` env
     propagation to children.
   - Set `.state/active-goal` to the first goal (in numeric order) that
     failed — same semantics as today.

3. **Update `docs/goal-design.md` §1 "Per-goal cache"** to record that
   per-goal scripts no longer enforce regression and that
   `completion-check.sh` is now the only orchestrator of the chain.
   Note the new "iterating one goal in isolation may miss a regression
   you introduced elsewhere — run `scripts/completion-check.sh` before
   declaring done" line.

4. **Update `AGENTS.md` / the autonomous-build harness prompt** to call
   `scripts/completion-check.sh` for the "is the goal really green"
   check, instead of running a single `goals/<n>-*.gates.sh` and
   trusting Tranche D inside it. This is the load-bearing prompt
   change; without it codex will continue to call single-gate scripts
   and silently lose regression coverage.

5. **Bound the parallelism**: cap to `min(N_goals, $(nproc))` or
   similar. `persistence-matrix` + Docker contention means unbounded
   `&` is worse than serial. Start with parallel = 2 (goal-0..3 cluster
   serial, goal-4..5 cluster serial, the two clusters in parallel) and
   measure before opening it wider.

## Why The Fix Is Deferred

Live conflict surface (verified 2026-05-21 against the last 30 commits):

| File | My refactor touches | Codex recent edits | Conflict tier |
| --- | --- | --- | --- |
| `goals/1-runnable.gates.sh` | delete D1 | 2× | low (different hunks) |
| `goals/2-shippable.gates.sh` | delete D1/D2 | 3× (body retargets at lines 115, 202) | low |
| `goals/3-managed-db.gates.sh` | delete D1/D2/D3 | 3× (body retarget at lines 53-58) | low |
| `goals/4-honest-boundaries.gates.sh` | delete D2..D5 | 2× | low |
| `goals/5-monorepo.gates.sh` | delete D1 | 3× | low |
| `scripts/_gate-cache.sh` | unchanged (already done in `bb07214`) | 0× since `78fc704` | none |
| `scripts/completion-check.sh` | rewrite as orchestrator | 0× since `4d1c0d1` | none |
| `scripts/check-*.sh` | unchanged | 7× | none |

Line-level conflicts are unlikely (codex retargets gate **bodies**,
this refactor deletes gate **tails**), but two design-level reasons keep
this deferred:

1. **Goal 5 D1 is still red.** The 1st run above showed
   `5.D1` failing on `3-managed-db` and `4-honest-boundaries` because
   codex hasn't finished retargeting paths inside those scripts to the
   new `apps/api/...` layout. Until those land, the D-block is the
   loudest diagnostic codex has ("goal 3 regressed" vs. an opaque
   "goal 5 failed"). Removing it now degrades codex's debugging signal
   exactly when codex is iterating against it.

2. **Standalone-contract change wants an audience.** Removing D from
   the gate files changes the contract every per-goal script makes.
   That deserves a single commit + a doc change reviewed against an
   otherwise green tree — not landed against a tree that already has
   two red goals from in-flight migration work.

## Action After Goal 5 Lands

Trigger condition: `bash scripts/completion-check.sh` exits 0 on `main`
with all six `.state/gate-cache/<n>-*` files present, **and** no
`fix(monorepo): retarget …` commits in the previous 24 h (proxy for
"codex has stopped iterating the gate scripts").

Then open a single PR that applies all five items in "The Recommended
Fix" above, in one commit per item. Acceptance signals:

- `bash scripts/completion-check.sh` on a freshly-busted cache
  (`rm -rf .state/gate-cache`) completes in **under 6 minutes** wall
  clock on the same hardware that today reports 15:39. (Lower bound:
  goal-2 + goal-3 share the `persistence-matrix` cost and cannot
  meaningfully overlap; the wins come from removing the D-chain
  duplication, not from beating the single-test bottleneck.)
- Re-running `scripts/completion-check.sh` immediately after returns in
  **under 3 seconds** wall clock (all six goals hit cache; orchestrator
  overhead only).
- `bash goals/3-managed-db.gates.sh` standalone still passes structural
  checks (A/B/C) but no longer asserts goal-0..2 — confirmed by reading
  the script and finding no D block. (This is the contract change, not
  a regression.)
- `docs/goal-design.md` and `AGENTS.md` both reflect the new contract:
  single-gate runs are diagnostic, full chain requires the orchestrator.

If any of those signals fails, revert in one commit and re-open this
finding with the new data.
