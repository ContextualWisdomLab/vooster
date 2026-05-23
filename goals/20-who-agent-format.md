# Goal 20: Who Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 19 moved `impact` out of the agent-format findings queue. The next small
implemented slice is:

```
who
```

The findings queue currently groups `revert`, `who`, and comment verbs. This
goal narrows that group by promoting `who` only. `revert` and comment verbs
remain queued.

`who` already exists and has human-output coverage. This goal adds
`--format=agent` for that one read-only coordination command. Agent mode emits
one JSON envelope write and no human lines.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-20-who-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is mostly additive, with one required case (a) Retarget:

- **Retarget:** Gates and next-task shims for Goals 18 and 19 used the grouped
  `revert` / `who` / comment findings bullet as the remaining-debt sentinel.
  This goal narrows that bullet, so those files are retargeted to the post-who
  `revert` / comment sentinel.
- No prior invariant is loosened. The invariant remains "remaining debt still
  exists"; only the sentinel literal changes.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding a branch in `who.ts` makes those checks cover
  this command file automatically.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The who agent-format debt is removed without clearing unrelated debt.**
The grouped `revert`, `who`, and comment bullet is gone. A narrowed
`revert` and comment bullet remains, and the `member invite` /
`api-key create|list|revoke` bullet remains.

A2. **Prior findings sentinels are retargeted without weakening their
invariant.** Goal 18 and Goal 19 gate and next-task files no longer require
the grouped `revert`, `who`, and comment bullet and instead require the
narrowed `revert` and comment bullet.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents who agent format.** A marked
`### Agent Format — Who` section exists under Sessions and includes:

    ```
    vspec who <KEY-NNN> --format=agent
    ```

    The section states that `suggested_next_actions` is copied from the API
    response, context stays at the default null values, and the payload exposes
    `data.sessions`, `data.locks`, and `data.merge_requests`.

### Tranche C — CLI Implementation

C1. **`apps/cli/src/commands/who.ts` is discovered by the same source of truth
as Goal 7.** The gate runs
`grep -rl 'format === "agent"' apps/cli/src/commands` and requires
`apps/cli/src/commands/who.ts` to appear.

C2. **`who` builds an agent envelope when requested.** The gate extracts
`runWho` from `apps/cli/src/commands/who.ts` and requires both
`format === "agent"` and `buildAgentEnvelope` inside that function.

C3. **`who` maps guidance and keeps default context.** `runWho` passes
`body.suggested_next_actions` to `buildAgentEnvelope` and does not pass a
custom context object.

C4. **`who` exposes the format flag.** `WhoCommand.flags` includes
`format: Flags.string()`.

### Tranche D — Unit Proof

D1. **Who has focused unit proof for agent and human output.** The file
`apps/cli/tests/unit/who-agent-format.test.ts` contains test titles
`agent who with active work`, `agent who without active work`, and
`human who`. Agent tests invoke the command with `--format=agent`, parse
stdout as one JSON object before negative substring assertions, assert
`format_version`, assert `data.usecase.key`, assert `data.sessions`,
assert `data.locks`, assert `data.merge_requests`, assert copied
`suggested_next_actions` by command substring, assert the full default null
context object, and assert default empty warnings. The active-work fixture
includes at least one session, one lock, and one merge request so human
row-label suppression is meaningful.

### Tranche E — Honest E2E Proof

E1. **Who has honest E2E proof.** The file
`apps/cli/tests/e2e-cli-honest/who-agent-format.test.ts` contains test
title `agent who`, invokes `runCli([ "who", ... ])` with `--format=agent`,
uses `VSPEC_CONFIG_PATH`, does not call `fetch(`, parses JSON, asserts
`format_version`, asserts `data.usecase.key`, asserts `data.sessions`,
asserts `data.locks`, asserts `data.merge_requests`, asserts the full
default null context object, and asserts a `vspec session start` suggested
action for the no-active-work case.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
`goals/7-cli-spec-parity.gates.sh` contains no who-agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/20-who-agent-format.md` passes.**

## Scope Guards

- No `revert` or comment agent branches.
- No lock release/renew implementation.
- No merge resolve implementation.
- No API response shape change.
- No prior goal gate may be weakened to pass this goal.
