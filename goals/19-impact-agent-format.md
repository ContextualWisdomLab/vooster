# Goal 19: Impact Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 18 moved `history` out of the agent-format findings queue. The next small
implemented slice is:

```
impact
```

The findings queue currently groups `impact`, `revert`, `who`, and comment
verbs. This goal narrows that group by promoting `impact` only. `revert`,
`who`, and comment verbs remain queued.

`impact` already exists and has human-output coverage. This goal adds
`--format=agent` for that one command. Agent mode emits one JSON envelope write
and no human lines.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-19-impact-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is mostly additive, with one required case (a) Retarget:

- **Retarget:** Gate `18.A1` used the grouped impact/revert/who/comment
  findings bullet as the remaining-debt sentinel. This goal narrows that
  bullet, so Goal 18's gate is retargeted to the post-impact
  `revert` / `who` / comment sentinel.
- No prior invariant is loosened. The invariant remains "remaining debt still
  exists"; only the sentinel literal changes.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding a branch in `impact.ts` makes those checks
  cover this command file automatically.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The impact agent-format debt is removed without clearing unrelated debt.**
    The grouped `impact`, `revert`, `who`, and comment bullet is gone. A
    narrowed `revert`, `who`, and comment bullet remains, and the
    `member invite` / `api-key create|list|revoke` bullet remains.

A2. **Goal 18's findings sentinel is retargeted without weakening its
    invariant.** Gate `18.A1` no longer requires the grouped
    impact/revert/who/comment bullet and instead requires the narrowed
    `revert`, `who`, and comment bullet.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents impact agent format.** A marked
    `### Agent Format — Impact` section exists under Versioning & Impact and
    includes:

    ```
    vspec impact <KEY-NNN> --format=agent
    ```

    The section states that `suggested_next_actions` is copied from the API
    response, `context.revision` is populated from the latest revision used as
    `base_revision`, and the payload exposes `data.preview_id` plus
    `data.impact.input_hash`.

### Tranche C — CLI Implementation

C1. **`apps/cli/src/commands/impact.ts` is discovered by the same source of
    truth as Goal 7.** The gate runs
    `grep -rl 'format === "agent"' apps/cli/src/commands` and requires
    `apps/cli/src/commands/impact.ts` to appear.

C2. **`impact` builds an agent envelope when requested.** The gate extracts
    `runImpact` from `apps/cli/src/commands/impact.ts` and requires both
    `format === "agent"` and `buildAgentEnvelope` inside that function.

C3. **`impact` maps revision context and guidance.** `runImpact` passes
    `body.suggested_next_actions` to `buildAgentEnvelope` and sets
    `context.revision` from the latest revision used for the preview.

C4. **`impact` exposes the format flag.** `ImpactCommand.flags` includes
    `format: Flags.string()`.

### Tranche D — Unit Proof

D1. **Impact has focused unit proof for agent and human output.** The file
    `apps/cli/tests/unit/impact-agent-format.test.ts` contains test titles
    `agent impact` and `human impact`. The agent test invokes the command with
    `--format=agent`, stubs both the revision-history fetch and impact-preview
    fetch, parses stdout as one JSON object, asserts `format_version`, asserts
    `data.preview_id`, asserts `data.impact.input_hash`, asserts
    `context.revision`, asserts copied `suggested_next_actions` by `vspec lock`
    command substring, and asserts no human-renderer tokens are mixed into
    stdout.

### Tranche E — Honest E2E Proof

E1. **Impact has honest E2E proof.** The file
    `apps/cli/tests/e2e-cli-honest/impact-agent-format.test.ts` contains test
    title `agent impact`, invokes `runCli([ "impact", ... ])` with
    `--format=agent`, uses `VSPEC_CONFIG_PATH`, does not call `fetch(`, parses
    JSON, asserts `format_version`, asserts `data.preview_id`, asserts
    `data.impact.input_hash`, asserts `context.revision` is a string, and
    asserts `suggested_next_actions` includes a `vspec lock` command.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
    new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
    `goals/7-cli-spec-parity.gates.sh` contains no impact-agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/19-impact-agent-format.md` passes.**

## Scope Guards

- No `revert`, `who`, or comment agent branches.
- No lock release/renew implementation.
- No merge resolve implementation.
- No API response shape change.
- No prior goal gate may be weakened to pass this goal.
