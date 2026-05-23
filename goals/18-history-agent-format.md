# Goal 18: History Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 17 moved `merge open` out of the agent-format findings queue. The next
small implemented slice is:

```
history
```

The findings queue currently groups `history`, `impact`, `revert`, `who`, and
comment verbs. This goal narrows that group by promoting `history` only.
`impact`, `revert`, `who`, and comment verbs remain queued.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-18-history-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is mostly additive, with a required case (a) Retarget:

- **Retarget:** Gates `14.A1`, `15.A1`, `16.A1`, and `17.A1` used the grouped
  history/impact/comment findings bullet as the unrelated-debt sentinel. This
  goal narrows that bullet, so those gates are retargeted to the next unrelated
  sentinel, `member invite` / `api-key create|list|revoke`.
- No prior invariant is loosened. The invariant remains "unrelated debt still
  exists"; only the sentinel literal changes.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding a branch in `history.ts` makes those checks
  cover this command file automatically.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The history agent-format debt is removed without clearing unrelated
debt.** The grouped `history`, `impact`, `revert`, `who`, and comment bullet
is gone. A narrowed `impact`, `revert`, `who`, and comment bullet remains,
and the `member invite` / `api-key create|list|revoke` bullet remains.

A2. **Prior findings sentinels are retargeted without weakening their
invariant.** Gates `14.A1`, `15.A1`, `16.A1`, and `17.A1` no longer require
the grouped history/impact/comment bullet and instead require the
`member invite` / `api-key create|list|revoke` bullet.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents history agent format.** A marked
`### Agent Format — History` section exists under Versioning & Impact and
includes:

    ```
    vspec history <KEY-NNN> --format=agent
    ```

    The section states that `suggested_next_actions` is copied from the API
    response, revisions are newest-first, and `context.revision` is populated
    from `data.revisions[0].revision` when present.

### Tranche C — CLI Implementation

C1. **`apps/cli/src/commands/history.ts` is discovered by the same source of
truth as Goal 7.** The gate runs
`grep -rl 'format === "agent"' apps/cli/src/commands` and requires
`apps/cli/src/commands/history.ts` to appear.

C2. **`history` builds an agent envelope when requested.** The gate extracts
`runHistory` from `apps/cli/src/commands/history.ts` and requires both
`format === "agent"` and `buildAgentEnvelope` inside that function.

C3. **`history` maps revision context and guidance.** `runHistory` passes
`body.suggested_next_actions` to `buildAgentEnvelope` and sets
`context.revision` from `body.revisions[0]?.revision ?? null`.

### Tranche D — Unit Proof

D1. **History has focused unit proof for agent and human output.** The file
`apps/cli/tests/unit/history-agent-format.test.ts` contains test titles
`agent history`, `agent history without revisions`, and `human history`.
Agent tests invoke the command with `--format=agent`, parse JSON, assert
`format_version`, assert `data.usecase.key`, assert the first revision id,
assert `context.revision`, assert copied
`suggested_next_actions` by command substring, and assert no human-renderer
tokens or raw bare-line `change_summary` text are mixed into stdout.

### Tranche E — Honest E2E Proof

E1. **History has honest E2E proof.** The file
`apps/cli/tests/e2e-cli-honest/history-agent-format.test.ts` contains test
title `agent history`, invokes `runCli([ "history", ... ])` with
`--format=agent`, uses `VSPEC_CONFIG_PATH`, does not call `fetch(`, parses
JSON, asserts `format_version`, asserts `context.revision` is a string,
asserts `context.revision` equals the first returned revision, and asserts
`suggested_next_actions` includes a `vspec usecase show` command.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
`goals/7-cli-spec-parity.gates.sh` contains no history-agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/18-history-agent-format.md` passes.**

## Scope Guards

- No `impact`, `revert`, `who`, or comment agent branches.
- No lock release/renew implementation.
- No API response shape change.
- No prior goal gate may be weakened to pass this goal.
