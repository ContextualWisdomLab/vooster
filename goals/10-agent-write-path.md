# Goal 10: Agent Envelope Write-Path Proof

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 7 introduced the `buildAgentEnvelope` shape and Goal 9 expanded it to
project/actor/stakeholder/goal/doctor command files. The remaining problem is
proof: `docs/findings/2026-05-21T1856-cli-spec-gaps.md` still lists core write-path agent
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

All conditions below hold. The focused unit and honest CLI proofs enumerate the
declared verb set; one example cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The stale write-path entries are gone from the
`docs/findings/2026-05-21T1856-cli-spec-gaps.md` `--format=agent` coverage debt list.**
Source of truth:

    ```
    goal create
    goal list
    goal promote
    actor create
    stakeholder create
    ```

    The gate scopes to bullet lines in that section and checks each token.

### Tranche B — Unit Proof

B1. **The focused unit proof covers the core write-path verbs.** Source of
truth:

    ```
    actor create
    stakeholder create
    goal create
    goal list
    goal promote
    usecase create
    ```

    `pnpm exec vitest run apps/cli/tests/unit/agent-format-write-path.test.ts`
    must pass. That test file invokes each command with `--format=agent`,
    parses the output JSON, and asserts the agent envelope contract.

### Tranche C — Honest E2E Proof

C1. **The focused honest E2E proof covers the core write-path verbs.**
`pnpm exec vitest run apps/cli/tests/e2e-cli-honest/agent-format-write-path.test.ts`
must pass. That test file exercises the same declared verbs through `runCli`,
uses isolated CLI config, parses the output JSON, and asserts the agent
envelope contract.

### Tranche D — Rigor

D1. **`scripts/check-gate-rigor.sh goals/10-agent-write-path.md` passes.**

## Scope Guards

- No session, branch, lock, step, scenario, change, merge, member, or api-key
  envelope rollout in this goal.
- No API response contract change is required.
- No prior goal gate may be weakened to pass this goal.

## Recommended Order

1. Remove the stale write-path bullets from `docs/findings/2026-05-21T1856-cli-spec-gaps.md`.
2. Add the missing `usecase create --format=agent` branch.
3. Add focused unit proofs for the declared verbs.
4. Add one honest E2E file covering the declared verbs.
5. Run `bash goals/10-agent-write-path.gates.sh`, then
   `VSPEC_GATES_CONCURRENCY=1 bash scripts/completion-check.sh`.
