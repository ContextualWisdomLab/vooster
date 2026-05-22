# Goal 12: Branch Create Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 9 completed the read-path verbs called out in the CLI findings note. Goals
10 and 11 then moved the first write/session agent-envelope debt into proven
CLI behavior. The first remaining `--format=agent` debt in
`docs/findings/2026-05-21T1856-cli-spec-gaps.md` is now:

```
branch create
```

`branch create` already exists and has human-output honest coverage. This goal
adds the agent envelope for that one implemented branch verb without changing
the API response contract.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is additive.

- No prior gate is retargeted.
- No prior invariant is loosened.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding a branch in `branch.ts` makes those checks
  cover this command file automatically.

## Supersedes

- **Goal 11 A1 branch-create guard.** Goal 11 deliberately required
  `branch create` to remain in `docs/findings/2026-05-21T1856-cli-spec-gaps.md` as unrelated
  debt after removing session debt. This goal promotes that exact debt, so it
  supersedes the Goal 11 A1 subcondition that `branch create` remain. Goal 11
  A1 continues to require the next unrelated `lock` debt to remain.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The branch-create agent-format debt is removed from
`docs/findings/2026-05-21T1856-cli-spec-gaps.md`, without clearing unrelated debt.**
The `branch create` bullet is gone, the `lock` bullet remains, and the
remaining queue can continue to narrow in later goals without reviving
branch-create debt.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents branch create agent format.** A marked
`### Agent Format for Branches` section exists under Branches & Merges and
includes:

    ```
    vspec branch create <name> --format=agent
    ```

    The section states that `context.branch` is populated from
    `data.branch.name`.

### Tranche C — CLI Implementation

C1. **`apps/cli/src/commands/branch.ts` is discovered by the same source of
truth as Goal 7.** The gate runs
`grep -rl 'format === "agent"' apps/cli/src/commands` and requires
`apps/cli/src/commands/branch.ts` to appear.

C2. **`branch create` builds an agent envelope when `--format=agent` is
requested.** The gate extracts `createBranch` from
`apps/cli/src/commands/branch.ts` and requires both `format === "agent"`
and `buildAgentEnvelope` inside that function.

C3. **The API branch route does not grow an envelope contract.** Branch API
files under `apps/api/src/http/branch-*.ts` do not mention
`buildAgentEnvelope`, `format_version`, or `format === "agent"`.

### Tranche D — Unit Proof

D1. **`branch create` has focused unit proof for agent and human output.** The
file `apps/cli/tests/unit/branch-agent-format.test.ts` contains test titles
`agent branch create` and `human branch create`. The agent test invokes the
command with `--format=agent`, parses JSON, asserts `format_version`, and
asserts `data.branch.id`, `data.branch.name`, `data.branch.status`, and
`context.branch`.

### Tranche E — Honest E2E Proof

E1. **`branch create` has honest E2E proof.** The file
`apps/cli/tests/e2e-cli-honest/branch-agent-format.test.ts` contains test
title `agent branch create`, invokes `runCli([ "branch", "create", ... ])`
with `--format=agent`, uses `VSPEC_CONFIG_PATH`, does not call `fetch(`,
parses JSON, asserts `format_version`, and asserts the same data/context
keys as D1.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
`goals/7-cli-spec-parity.gates.sh` contains no branch-agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/12-branch-agent-format.md` passes.**

## Scope Guards

- No `branch list`, `branch checkout`, `branch diff`, or `branch delete`.
- No merge command work.
- No API response shape change.
- No prior goal gate may be weakened to pass this goal.
