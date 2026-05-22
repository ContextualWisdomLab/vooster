# Goal 17: Merge Open Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 16 moved `change propose` / `change commit` out of the agent-format
findings queue. The next feasible implemented slice is:

```
merge open
```

The findings queue currently groups `merge open` / `merge resolve`. This goal
narrows that debt to `merge resolve` only. `merge resolve` is implemented, but
the current honest CLI conflict setup relies on `__test` HTTP endpoints rather
than public CLI-only setup, so it remains queued for a later goal.

`merge open` already exists and has human-output coverage. This goal adds
`--format=agent` for that one implemented merge verb. Agent mode emits one JSON
envelope write and no human lines.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-17-merge-open-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is additive.

- No prior gate is retargeted.
- No prior invariant is loosened.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding a branch in `merge.ts` makes those checks
  cover this command file automatically.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The merge-open agent-format debt is removed without clearing unrelated
    debt.** The grouped `merge open` / `merge resolve` bullet is gone, a
    narrowed `merge resolve` bullet remains, the `lock release` / `lock renew`
    bullet remains, and the next unrelated history/impact/revert/who/comment
    bullet remains. The findings doc records that `merge resolve` remains queued
    because honest conflict setup currently depends on `__test` endpoints.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents merge open agent format.** A marked
    `### Agent Format — Merges` section exists under Branches & Merges and
    includes:

    ```
    vspec merge open <branch-id> --format=agent
    ```

    The section states that `suggested_next_actions` is copied from the API
    response, `context.branch` is populated from `data.source_branch.name`,
    warnings stay as the default empty array, and `merge resolve --format=agent`
    remains queued.

### Tranche C — CLI Implementation

C1. **`apps/cli/src/commands/merge.ts` is discovered by the same source of
    truth as Goal 7.** The gate runs
    `grep -rl 'format === "agent"' apps/cli/src/commands` and requires
    `apps/cli/src/commands/merge.ts` to appear.

C2. **`merge open` builds an agent envelope when requested.** The gate extracts
    `openMerge` from `apps/cli/src/commands/merge.ts` and requires both
    `format === "agent"` and `buildAgentEnvelope` inside that function.

C3. **Scope stays on the two implemented merge verbs.** The sorted
    `action === "..."` branches in `merge.ts` are exactly `open resolve`.

C4. **`merge open` maps branch context and guidance.** `openMerge` passes
    `body.suggested_next_actions` to `buildAgentEnvelope`, sets
    `context.branch` from `body.source_branch.name`, and the CLI
    `MergeOpenResponse.source_branch` type includes `name`.

C5. **`merge resolve` remains out of scope.** The extracted `resolveMerge`
    function does not contain `format === "agent"` or `buildAgentEnvelope`.

### Tranche D — Unit Proof

D1. **Merge open has focused unit proof for agent and human output.** The file
    `apps/cli/tests/unit/merge-open-agent-format.test.ts` contains test titles
    `agent merge open` and `human merge open`. The agent test invokes the
    command with `--format=agent`, parses JSON, asserts `format_version`, asserts
    `data.merge_request.id`, `data.source_branch.id`, `data.source_branch.name`,
    `context.branch`, copied `suggested_next_actions`, default empty warnings,
    and no human-renderer tokens mixed into stdout.

### Tranche E — Honest E2E Proof

E1. **Merge open has honest E2E proof.** The file
    `apps/cli/tests/e2e-cli-honest/merge-open-agent-format.test.ts` contains
    test title `agent merge open`, invokes `runCli([ "merge", "open", ... ])`
    with `--format=agent`, uses `VSPEC_CONFIG_PATH`, does not call `fetch(`,
    parses JSON, and asserts the same data/context keys as D1 against a real
    branch created through `branch create --format=agent`.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
    new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
    `goals/7-cli-spec-parity.gates.sh` contains no merge-agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/17-merge-open-agent-format.md`
    passes.**

## Scope Guards

- No `merge resolve --format=agent`.
- No lock release/renew implementation.
- No API response shape change.
- No prior goal gate may be weakened to pass this goal.
