# Goal 21: Revert Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 20 moved `who` out of the agent-format findings queue. The next small
implemented slice is:

```
revert
```

The findings queue currently groups `revert` and comment verbs. This goal
narrows that group by promoting `revert` only. Comment verbs remain queued.

`revert` already exists and has human-output coverage. This goal adds
`--format=agent` for that one write command. Agent mode emits one JSON envelope
write and no human lines.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-21-revert-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is mostly additive, with one required case (a) Retarget:

- **Retarget:** Gates and next-task shims for Goals 18, 19, and 20 used the
  grouped `revert` / comment findings bullet as the remaining-debt sentinel.
  This goal narrows that bullet, so those files are retargeted to the
  comment-only sentinel.
- No prior invariant is loosened. The invariant remains "remaining debt still
  exists"; only the sentinel literal changes.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding a branch in `revert.ts` makes those checks
  cover this command file automatically.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The revert agent-format debt is removed without clearing unrelated
debt.** The grouped `revert` and comment bullet is gone. A narrowed
comment-only bullet remains, and the `member invite` /
`api-key create|list|revoke` bullet remains.

A2. **Prior findings sentinels are retargeted without weakening their
invariant.** Goal 18, Goal 19, and Goal 20 gate and next-task files no
longer require the grouped `revert` and comment bullet and instead require
the narrowed comment-only bullet.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents revert agent format.** A marked
`### Agent Format — Revert` section exists under Versioning & Impact and
includes:

    ```
    vspec revert <KEY-NNN> --to <revision-id> --format=agent
    ```

    The section states that `suggested_next_actions` is copied from the API
    response, `warnings` are preserved, `context.revision` is populated from
    `data.revision.id`, and the payload exposes
    `data.usecase.current_revision_id`.

### Tranche C — CLI Implementation

C1. **`apps/cli/src/commands/revert.ts` is discovered by the same source of
truth as Goal 7.** The gate runs
`grep -rl 'format === "agent"' apps/cli/src/commands` and requires
`apps/cli/src/commands/revert.ts` to appear.

C2. **`revert` builds an agent envelope when requested.** The gate extracts
`runRevert` from `apps/cli/src/commands/revert.ts` and requires both
`format === "agent"` and `buildAgentEnvelope` inside that function.

C3. **`revert` maps revision context, guidance, and warnings.** `runRevert`
passes `body.suggested_next_actions` to `buildAgentEnvelope`, passes
`body.warnings ?? []` as warnings, and sets `context.revision` from
`body.revision.id`.

C4. **`revert` exposes the format flag.** `RevertCommand.flags` includes
`format: Flags.string()`.

### Tranche D — Unit Proof

D1. **Revert has focused unit proof for agent and human output.** The file
`apps/cli/tests/unit/revert-agent-format.test.ts` contains test titles
`agent revert` and `human revert`. The agent test invokes the command with
`--format=agent`, parses stdout as one JSON object before negative
substring assertions, asserts `format_version`, asserts
`data.usecase.current_revision_id`, asserts `data.revision.id`, asserts
`context.revision`, asserts copied `warnings`, asserts copied
`suggested_next_actions` by `vspec history` command substring, and asserts
`context.revision`, `data.revision.id`, and
`data.usecase.current_revision_id` are equal.

### Tranche E — Honest E2E Proof

E1. **Revert has honest E2E proof.** The file
`apps/cli/tests/e2e-cli-honest/revert-agent-format.test.ts` contains test
title `agent revert`, invokes `runCli([ "revert", ... ])` with
`--format=agent`, uses `VSPEC_CONFIG_PATH`, does not call `fetch(`, captures
the initial target revision before advancing the use case, advances the use
case through `addMainStepViaCli`, parses JSON, asserts `format_version`,
asserts `data.revision.id`, asserts `data.usecase.current_revision_id`,
asserts `context.revision`, asserts the returned revert revision differs
from the captured target revision, and asserts `suggested_next_actions`
includes a `vspec history` command.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
`goals/7-cli-spec-parity.gates.sh` contains no revert-agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/21-revert-agent-format.md` passes.**

## Scope Guards

- No comment agent branches.
- No lock release/renew implementation.
- No merge resolve implementation.
- No API response shape change.
- No prior goal gate may be weakened to pass this goal.
