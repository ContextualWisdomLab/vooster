# Goal 14: Step Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 13 moved lock acquire out of the agent-format findings queue. The next
implemented CLI verbs in the queue are:

```
step add
step edit
```

Both verbs already exist and have human-output honest coverage. This goal adds
`--format=agent` for those two implemented step verbs. Agent mode emits one
JSON envelope write and no human lines.

`step add` can populate `context.revision` from `data.revision.id`. `step edit`
cannot: the current API response exposes revision severity/version, but not a
revision id. This goal records that asymmetry in the findings doc instead of
silently inventing context.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is additive.

- No prior gate is retargeted.
- No prior invariant is loosened.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding branches in `step.ts` makes those checks cover
  this command file automatically.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The step agent-format debt is removed without clearing unrelated debt.**
The `step add` / `step edit` bullet is gone, later goals may continue
narrowing the queue, and `docs/findings/2026-05-21T1856-cli-spec-gaps.md` records that
`step edit` leaves `context.revision` null because the API response lacks
`revision.id`.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents step agent format.** A marked
`### Agent Format — Steps` section exists under Scenarios & Steps and
includes examples for:

    ```
    vspec step add <scenario-id> --format=agent
    vspec step edit <id> --format=agent
    ```

    The section states that `step add` sets `context.revision` and `step edit`
    leaves it null.

### Tranche C — CLI Implementation

C1. **`apps/cli/src/commands/step.ts` is discovered by the same source of truth
as Goal 7.** The gate runs
`grep -rl 'format === "agent"' apps/cli/src/commands` and requires
`apps/cli/src/commands/step.ts` to appear.

C2. **Both step handlers build an agent envelope.** The gate extracts `addStep`
and `editStep` from `apps/cli/src/commands/step.ts` and requires each body
to contain both `format === "agent"` and `buildAgentEnvelope`.

C3. **Scope stays on the two implemented step verbs.** The only
`action === "..."` branches in `step.ts` are `add` and `edit`.

### Tranche D — Unit Proof

D1. **Step add/edit have focused unit proof for agent and human output.** The
file `apps/cli/tests/unit/step-agent-format.test.ts` contains test titles
`agent step add`, `agent step edit`, `human step add`, and
`human step edit`. Agent tests invoke commands with `--format=agent`, parse
JSON, assert `format_version`, assert `data.step.id`, and assert
`context.revision` is the revision id for add and null for edit.

### Tranche E — Honest E2E Proof

E1. **Step add/edit have honest E2E proof.** The file
`apps/cli/tests/e2e-cli-honest/step-agent-format.test.ts` contains distinct
test titles `agent step add` and `agent step edit`, invokes
`runCli([ "step", ... ])` with `--format=agent`, uses `VSPEC_CONFIG_PATH`,
does not call `fetch(`, parses JSON, asserts `format_version`, and asserts
the same data/context keys as D1 against real seeded scenario/step setup.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
`goals/7-cli-spec-parity.gates.sh` contains no step-agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/14-step-agent-format.md` passes.**

## Scope Guards

- No `step move` or `step delete`.
- No API response shape change.
- No prior goal gate may be weakened to pass this goal.
