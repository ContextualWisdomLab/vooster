# Goal 27: Push Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 26 moved `pull` and the current pull-like `sync` path out of the
agent-format findings queue. The remaining sync-family surface is:

```
push
```

`push` has different behavior from pull: it reads local files, sends them to
the API, applies returned revisions or conflicts, and prints cache/guidance
output. This goal adds `--format=agent` to that existing push behavior without
changing `pull` or current `sync` semantics.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-27-push-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is additive, with one required case (a) Retarget:

- **Retarget:** Prior gates and next-task shims use the `push` findings bullet
  as the remaining-debt sentinel. This goal removes that bullet, so those files
  are retargeted to the next durable sentinel:
  `` `lock release` / `lock renew` ``.
- **Retarget:** Goal 26 positively required the `push` findings bullet after it
  split pull/sync from push. This goal keeps that invariant and only changes
  the literal sentinel to `` `lock release` / `lock renew` ``.
- **Supersedes:** Goal 26's C4 gate and "No push agent branch" scope guard kept
  push queued for this follow-up goal. This goal replaces that temporary guard
  with the push agent-format implementation and proof below.
- No prior invariant is loosened. The invariant remains "unrelated debt still
  exists"; only the sentinel literal changes. The temporary "push remains
  queued" invariant is superseded by this goal's explicit push proof.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The push agent-format debt is removed without clearing unrelated debt.**
The `push` bullet is gone, and the
`` `lock release` / `lock renew` `` and `merge resolve` bullets remain.

A2. **Every prior findings sentinel is retargeted without weakening its
invariant.** Every prior `goals/*.gates.sh` and `goals/*.next-task.sh` file
no longer requires the `push` bullet and instead requires
`` `lock release` / `lock renew` `` when it needs a remaining-debt
sentinel.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents push agent format.** A marked
`### Agent Format - Push` section exists and includes:

    ```
    vspec push --format=agent
    ```

    The section states that context stays at the default null values,
    `data.results`, `data.cache.entries`, and `data.suggested_next_actions` are
    preserved, `suggested_next_actions` is copied to the envelope top level,
    `warnings` remains empty, and the command applies returned revisions before
    the envelope is emitted.

### Tranche C — CLI Implementation

C1. **`PushCommand` exposes the format flag.** `PushCommand.flags` includes
`format: Flags.string()`, and the push flag type contains `format?: string`.

C2. **`pushFiles` builds an agent envelope when requested.** The gate extracts
`pushFiles` from `apps/cli/src/commands/sync.ts` and requires
`format === "agent"`, `buildAgentEnvelope`, and
`suggested_next_actions: body.suggested_next_actions`.

C3. **Push agent output preserves current write ordering.** The `pushFiles`
implementation still calls `applySyncResults` before its agent envelope
branch.

C4. **Pull and current sync behavior stay out of scope.** `pullFiles` still
writes files before the pull/sync envelope, and `runSync` still routes only
the `"push"` action to `pushFiles`.

### Tranche D — Unit Proof

D1. **Push has focused unit proof for agent and human output.** The file
`apps/cli/tests/unit/push-agent-format.test.ts` contains test titles
`agent push`, `agent push applies revisions before output`,
`agent dry-run leaves files unchanged`, and `human push output`. Agent tests
use temp roots, parse stdout as one JSON object, assert `format_version`,
assert the full default null context, assert `data.results`, assert
`data.cache.entries`, assert `data.suggested_next_actions`, assert copied
top-level `suggested_next_actions`, assert empty `warnings`, and prove file
revisions are applied for non-dry-run push but unchanged for dry-run push.

### Tranche E — Honest E2E Proof

E1. **Push has honest E2E proof.** The file
`apps/cli/tests/e2e-cli-honest/push-agent-format.test.ts` contains test
title `agent push writes canonical file revisions`, invokes
`runCli([ "push", ... ])` with `--format=agent`, uses `VSPEC_CONFIG_PATH`,
does not call `fetch(`, parses JSON, asserts `format_version`, asserts the
full default null context, asserts `data.results`, asserts
`data.cache.entries`, asserts `data.suggested_next_actions`, asserts copied
top-level `suggested_next_actions`, and asserts the pushed file revision is
updated on disk.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
`goals/7-cli-spec-parity.gates.sh` contains no push agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/27-push-agent-format.md` passes.**

## Scope Guards

- No lock release/renew implementation.
- No merge resolve implementation.
- No API response shape change.
- No change to pull behavior.
- No change to current `sync` semantics.
- No conflict-content-specific test expansion.
- No prior goal gate may be weakened to pass this goal.
- Goal 26's findings sentinel invariant remains; Goal 26's temporary push queue
  guard is superseded here.
