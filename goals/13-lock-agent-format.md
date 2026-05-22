# Goal 13: Lock Acquire Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 12 moved `branch create` out of the agent-format findings queue. The first
remaining debt is now:

```
lock (acquire/release/renew)
```

Direct inspection shows the current CLI implements only lock acquisition:
`vspec lock <KEY-NNN> ...` posts to `/v1/locks`. `lock renew`, release/unlock,
and list remain out of the current dispatcher. This goal therefore adds
`--format=agent` to the implemented acquire path and splits the findings debt so
the remaining lock verbs stay queued honestly.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is additive.

- No prior gate is retargeted.
- No prior invariant is loosened.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding a branch in `lock.ts` makes those checks cover
  this command file automatically.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The lock findings bullet is narrowed honestly.** The old
`lock (acquire/release/renew)` bullet is gone. A remaining bullet for
`lock release / lock renew` exists.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents lock acquire agent format.** A marked
`### Agent Format for Locks` section exists under Locks and includes:

    ```
    vspec lock <KEY-NNN> --format=agent
    ```

    The section includes a fenced JSON example containing `held_by_session_id`
    and states that `context.session_id` comes from the caller's `--session`
    flag, not from the lock holder.

### Tranche C — CLI Implementation

C1. **`apps/cli/src/commands/lock.ts` is discovered by the same source of truth
as Goal 7.** The gate runs
`grep -rl 'format === "agent"' apps/cli/src/commands` and requires
`apps/cli/src/commands/lock.ts` to appear.

C2. **`lock` acquire builds an agent envelope when `--format=agent` is
requested.** The gate requires `runLock` to route lock output through the
lock renderer, and requires that renderer to contain both
`format === "agent"` and `buildAgentEnvelope`. Goal 28 may share this
renderer with lock renew without weakening the acquire invariant.

C3. **The dispatcher still scopes this goal to acquire only.** `apps/cli/src/index.ts`
keeps the existing `lock` dispatch guard that excludes `renew`, and no
`unlock` dispatch exists.

### Tranche D — Unit Proof

D1. **`lock` acquire has focused unit proof for agent and human output.** The
file `apps/cli/tests/unit/lock-agent-format.test.ts` contains test titles
`agent lock acquire` and `human lock acquire`. The agent test invokes the
command with `--format=agent`, parses JSON, asserts `format_version`, asserts
`data.lock.id`, `data.lock.lock_type`, `data.lock.target_id`,
`data.lock.held_by_session_id`, `context.session_id`, and asserts outer
`suggested_next_actions` contains the response guidance.

### Tranche E — Honest E2E Proof

E1. **`lock` acquire has honest E2E proof.** The file
`apps/cli/tests/e2e-cli-honest/lock-agent-format.test.ts` contains test
title `agent lock acquire`, invokes `runCli([ "lock", ... ])` with
`--format=agent`, uses `VSPEC_CONFIG_PATH`, does not call `fetch(`, parses
JSON, asserts `format_version`, and asserts the same data/context keys as
D1 against a real seeded use case.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
`goals/7-cli-spec-parity.gates.sh` contains no lock-agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/13-lock-agent-format.md` passes.**

## Scope Guards

- No `lock renew`, `unlock`, `lock list`, or release implementation in this
  goal.
- No API response shape change.
- No prior goal gate may be weakened to pass this goal.
