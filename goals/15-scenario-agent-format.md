# Goal 15: Scenario Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 14 moved step add/edit out of the agent-format findings queue. The next
implemented CLI verb in the queue is:

```
scenario add
```

`scenario add` already exists and has human-output honest coverage. This goal
adds `--format=agent` for that one implemented scenario verb. Agent mode emits
one JSON envelope write and no human lines.

The scenario-create API response includes `revision.id`, but the CLI
`ScenarioResponse` type currently omits it. This goal widens the CLI type and
uses `data.revision.id` as `context.revision`.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-15-scenario-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is additive.

- No prior gate is retargeted.
- No prior invariant is loosened.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding a branch in `scenario.ts` makes those checks
  cover this command file automatically.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The scenario-add agent-format debt is removed without clearing unrelated
    debt.** The `scenario add` bullet is gone, and later goals may continue
    narrowing the queue without reviving scenario-add debt.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents scenario add agent format.** A marked
    `### Agent Format — Scenarios` section exists under Scenarios & Steps and
    includes:

    ```
    vspec scenario add <usecase-id> --format=agent
    ```

    The section states that `context.revision` is populated from
    `data.revision.id`.

### Tranche C — CLI Implementation

C1. **`apps/cli/src/commands/scenario.ts` is discovered by the same source of
    truth as Goal 7.** The gate runs
    `grep -rl 'format === "agent"' apps/cli/src/commands` and requires
    `apps/cli/src/commands/scenario.ts` to appear.

C2. **`scenario add` builds an agent envelope when requested.** The gate
    extracts `addScenario` from `apps/cli/src/commands/scenario.ts` and requires
    both `format === "agent"` and `buildAgentEnvelope` inside that function.

C3. **Scope stays on the one implemented scenario verb.** The only
    `action === "..."` branch in `scenario.ts` is `add`.

C4. **The CLI response type exposes the revision id used for context.** The
    `ScenarioResponse` type includes `revision.id`.

### Tranche D — Unit Proof

D1. **Scenario add has focused unit proof for agent and human output.** The file
    `apps/cli/tests/unit/scenario-agent-format.test.ts` contains test titles
    `agent scenario add` and `human scenario add`. The agent test invokes the
    command with `--format=agent`, parses JSON, asserts `format_version`,
    asserts `data.scenario.id`, `data.revision.id`, and `context.revision`, and
    asserts the agent output does not contain human-renderer tokens.

### Tranche E — Honest E2E Proof

E1. **Scenario add has honest E2E proof.** The file
    `apps/cli/tests/e2e-cli-honest/scenario-agent-format.test.ts` contains test
    title `agent scenario add`, invokes `runCli([ "scenario", ... ])` with
    `--format=agent`, uses `VSPEC_CONFIG_PATH`, does not call `fetch(`, parses
    JSON, asserts `format_version`, and asserts the same data/context keys as
    D1 against a real seeded use case.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
    new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
    `goals/7-cli-spec-parity.gates.sh` contains no scenario-agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/15-scenario-agent-format.md` passes.**

## Scope Guards

- No `scenario list`, `scenario edit`, or `scenario delete`.
- No API response shape change.
- No prior goal gate may be weakened to pass this goal.
