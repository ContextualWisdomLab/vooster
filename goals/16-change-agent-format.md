# Goal 16: Change Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 15 moved `scenario add` out of the agent-format findings queue. The queue
still lists `lock release` / `lock renew`, but the current CLI lock command
implements acquire only. The next implemented CLI verbs in the queue are:

```
change propose
change commit
```

Both verbs already exist and have human-output coverage. This goal adds
`--format=agent` for those two implemented change verbs. Agent mode emits one
JSON envelope write and no human lines.

`change propose` previews a future edit and therefore leaves
`context.revision` null. `change commit` creates revisions and sets
`context.revision` to the first committed revision id when one exists.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-16-change-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is additive.

- No prior gate is retargeted.
- No prior invariant is loosened.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding branches in `change.ts` makes those checks
  cover this command file automatically.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The change agent-format debt is removed without clearing unrelated
    debt.** The `change propose` / `change commit` bullet is gone, while the
    `lock release` / `lock renew` bullet remains and later goals may continue
    narrowing the queue without reviving change debt.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents change agent format.** A marked
    `### Agent Format — Changes` section exists under Versioning & Impact or an
    additive Changes & Reviews section and includes examples for:

    ```
    vspec change propose --format=agent
    vspec change commit --format=agent
    ```

    The section states that `suggested_next_actions` is copied from the API
    response, `change propose` leaves `context.revision` null, and
    `change commit` sets `context.revision` from
    `data.revisions[0].revision_id`.

### Tranche C — CLI Implementation

C1. **`apps/cli/src/commands/change.ts` is discovered by the same source of
    truth as Goal 7.** The gate runs
    `grep -rl 'format === "agent"' apps/cli/src/commands` and requires
    `apps/cli/src/commands/change.ts` to appear.

C2. **Both change handlers build an agent envelope.** The gate extracts
    `proposeChange` and `commitChange` from
    `apps/cli/src/commands/change.ts` and requires each body to contain both
    `format === "agent"` and `buildAgentEnvelope`.

C3. **Scope stays on the two implemented change verbs.** The sorted
    `action === "..."` branches in `change.ts` are exactly `commit propose`.

C4. **Agent envelopes preserve API guidance.** `proposeChange` passes
    `body.suggested_next_actions` and `body.warnings` to `buildAgentEnvelope`;
    `commitChange` passes `body.suggested_next_actions` and sets
    `context.revision` from `body.revisions[0]?.revision_id ?? null`.

### Tranche D — Unit Proof

D1. **Change propose/commit have focused unit proof for agent and human
    output.** The file `apps/cli/tests/unit/change-agent-format.test.ts`
    contains test titles `agent change propose`, `agent change commit`,
    `agent change commit without revisions`, `human change propose`, and
    `human change commit`. Agent tests invoke commands with `--format=agent`,
    parse JSON, assert `format_version`, assert `data.preview_id` or
    `data.revisions[0].revision_id`, assert `data.revisions[0].entity_id`,
    assert `context.revision`, assert copied `suggested_next_actions`, assert
    copied warnings for propose, and assert no human-renderer tokens are mixed
    into stdout.

### Tranche E — Honest E2E Proof

E1. **Change propose/commit have honest E2E proof.** The file
    `apps/cli/tests/e2e-cli-honest/change-agent-format.test.ts` contains test
    title `agent change propose and commit`, invokes
    `runCli([ "change", ... ])` with `--format=agent`, uses
    `VSPEC_CONFIG_PATH`, does not call `fetch(`, parses JSON, and asserts the
    same data/context keys as D1 against a real seeded use case. The test reads
    the base revision from `usecase show --format=agent` via `context.revision`,
    not `data.usecase.current_revision_id`.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
    new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
    `goals/7-cli-spec-parity.gates.sh` contains no change-agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/16-change-agent-format.md` passes.**

## Scope Guards

- No `merge` verbs.
- No lock release/renew implementation.
- No API response shape change.
- No prior goal gate may be weakened to pass this goal.
