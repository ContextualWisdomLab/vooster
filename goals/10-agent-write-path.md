# Goal 10: Agent Envelope Write-Path Proof

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 7 introduced the `buildAgentEnvelope` shape and Goal 9 expanded it to
project/actor/stakeholder/goal/doctor command files. The remaining problem is
proof: `docs/findings-cli-spec-gaps.md` still lists core write-path agent
envelope debt, and one high-traffic write path (`usecase create`) still prints
human output even when an agent asks for `--format=agent`.

This goal promotes that debt into a narrow, testable step. It covers the first
agent-facing creation/list/promotion verbs that agents hit while bootstrapping a
spec:

```
actor create
stakeholder create
goal create
goal list
goal promote
usecase create
```

The CLI may synthesize the envelope locally. API responses do not need to grow
`context`, `suggested_next_actions`, or `warnings`; `buildAgentEnvelope` may
fill null context and empty arrays. The required behavior is uniform shape, not
richer server guidance.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is additive. It does not retarget, loosen, or supersede any prior
goal invariant.

- Goal 7 A3/A4/A5 already enumerate command files that contain an agent branch.
  Adding or preserving branches in actor/stakeholder/goal/usecase command files
  makes those prior checks stricter automatically.
- Goal 9 includes `apps/cli/src`, the honest CLI directory, and the findings
  file in its cache inputs, so no prior gate retargeting is required.
- The findings cleanup removes stale queue entries only after this goal adds
  direct unit and honest E2E proof for the declared verbs.

## The Goal

All conditions below hold. Gates enumerate the declared verb sets; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The stale write-path entries are gone from the
    `docs/findings-cli-spec-gaps.md` `--format=agent` coverage debt list.**
    Source of truth:

    ```
    goal create
    goal list
    goal promote
    actor create
    stakeholder create
    ```

    The gate scopes to bullet lines in that section and checks each token.

### Tranche B — Handler-Level Agent Branches

B1. **Every core write-path handler builds an agent envelope when
    `--format=agent` is requested.** Source of truth:

    ```
    actor create        -> apps/cli/src/commands/actor.ts:createActor
    stakeholder create  -> apps/cli/src/commands/stakeholder.ts:createStakeholder
    goal create         -> apps/cli/src/commands/goal.ts:createGoal
    goal list           -> apps/cli/src/commands/goal.ts:listGoals
    goal promote        -> apps/cli/src/commands/goal.ts:promoteGoal
    usecase create      -> apps/cli/src/commands/usecase.ts:createUsecase
    ```

    The gate extracts each function body and requires both
    `format === "agent"` and `buildAgentEnvelope` inside that function.

### Tranche C — Unit Proof

C1. **Every core write-path verb has a distinct unit proof.** The file
    `apps/cli/tests/unit/agent-format-write-path.test.ts` contains a distinct
    test title of the form `agent <verb>`, invokes the command with
    `--format=agent`, parses the output JSON, and asserts `format_version`.

### Tranche D — Honest E2E Proof

D1. **Every core write-path verb has a distinct honest E2E proof.** The file
    `apps/cli/tests/e2e-cli-honest/agent-format-write-path.test.ts` contains a
    distinct test title of the form `agent <verb>`, invokes `runCli([ ... ])`
    with the exact topic/action tokens and `--format=agent`, uses
    `VSPEC_CONFIG_PATH`, does not call `fetch(`, parses the output JSON, and
    asserts `format_version`.

### Tranche E — Rigor

E1. **`scripts/check-gate-rigor.sh goals/10-agent-write-path.md` passes.**

## Scope Guards

- No session, branch, lock, step, scenario, change, merge, member, or api-key
  envelope rollout in this goal.
- No API response contract change is required.
- No prior goal gate may be weakened to pass this goal.

## Recommended Order

1. Remove the stale write-path bullets from `docs/findings-cli-spec-gaps.md`.
2. Add the missing `usecase create --format=agent` branch.
3. Add focused unit proofs for the declared verbs.
4. Add one honest E2E file covering the declared verbs.
5. Run `bash goals/10-agent-write-path.gates.sh`, then
   `bash scripts/active-check.sh`.
