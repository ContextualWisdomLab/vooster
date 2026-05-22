# Goal 29: Merge Resolve Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 28 left two known agent-format coverage gaps:

```
lock release
merge resolve
```

`merge resolve` already has an API route and a CLI command. This goal adds the
shared agent envelope to the existing command while keeping the separate public
conflict-setup debt queued honestly.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-29-merge-resolve-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is additive, with one required case (a) Retarget and one explicit
supersession:

- **Retarget:** Prior gates and next-task shims use `merge resolve` as a
  remaining-debt sentinel. This goal splits agent-format debt from public setup
  debt, so those files are retargeted to `merge resolve public conflict setup`
  or `lock release`.
- **Supersedes:** Goal 17.C5 temporarily required `resolveMerge` to remain
  envelope-free. This goal replaces that temporary guard with explicit
  merge-resolve agent-format proof.
- No prior invariant is silently loosened. The public setup limitation remains
  queued as its own finding.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A - Findings Debt

A1. **The merge-resolve agent-format debt is removed without clearing unrelated
    debt.** The exact `merge resolve` agent-format bullet is gone, `lock
    release` remains, and `merge resolve public conflict setup` remains as a
    non-agent-format finding.

A2. **Every prior merge-resolve sentinel is retargeted without weakening its
    invariant.** Every prior `goals/*.gates.sh` and `goals/*.next-task.sh` file
    no longer requires the exact `merge resolve` agent-format bullet when it
    needs a remaining-debt sentinel.

### Tranche B - CLI Spec

B1. **`docs/07-cli-spec.md` documents merge resolve agent format.** The stale
    sentence saying `merge resolve --format=agent` remains queued is gone. A
    marked `### Agent Format - Merge Resolve` section exists and includes:

    ```
    vspec merge resolve <id> --format=agent
    ```

    The section states that `data.merge_request`, `data.new_revisions`,
    `data.source_branch`, `context.branch`, `context.revision`, and
    `suggested_next_actions` are exposed.

### Tranche C - CLI Implementation

C1. **`resolveMerge` builds an agent envelope when requested.** The gate
    extracts `resolveMerge` from `apps/cli/src/commands/merge.ts` and requires
    `format === "agent"`, `buildAgentEnvelope`, `data: body`, copied
    `suggested_next_actions`, and context mapping.

C2. **Merge resolve response typing exposes revision ids.**
    `MergeResolveResponse.new_revisions` is typed as
    `Array<{ id: string }>` so `context.revision` is typed from the existing
    API response shape.

C3. **No test-only setup leaks into production.** `apps/cli/src/commands/merge.ts`
    contains no `__test` string.

### Tranche D - Unit Proof

D1. **Merge resolve has focused unit proof for agent and human output.** The
    file `apps/cli/tests/unit/merge-resolve-agent-format.test.ts` contains test
    titles `agent merge resolve`, `agent merge resolve without new revision`,
    and `human merge resolve output`. Agent tests parse stdout with
    `JSON.parse(stdout)`, assert `format_version`, assert
    `data.merge_request.id`, assert `data.new_revisions`, assert
    `data.source_branch`, assert `context.branch`, assert `context.revision`,
    assert copied `suggested_next_actions`, and assert empty `warnings`.

### Tranche E - CLI E2E Proof

E1. **Merge resolve has CLI E2E proof with setup-only test endpoints.** The file
    `apps/cli/tests/e2e-cli/merge-resolve-agent-format.test.ts` contains test
    title `agent merge resolve`, invokes
    `runCli([ "merge", "resolve", ... ])` with `--format=agent`, parses JSON,
    asserts `format_version`, asserts `data.merge_request.id`, asserts
    `data.new_revisions`, asserts `data.source_branch`, asserts
    `context.branch`, asserts `context.revision`, and asserts copied
    `suggested_next_actions`.

E2. **The E2E proof does not pretend to be honest public setup.** The new file
    is under `apps/cli/tests/e2e-cli/`, no
    `apps/cli/tests/e2e-cli-honest/merge-resolve-agent-format.test.ts` file
    exists, `HONEST_UC_SET` in `goals/7-cli-spec-parity.gates.sh` contains no
    merge-resolve agent entry, and any `fetch(` calls in the new E2E file target
    `/__test/` setup endpoints rather than `/v1/merges/.../resolve`.

### Tranche F - Rigor

F1. **`scripts/check-gate-rigor.sh goals/29-merge-resolve-agent-format.md`
    passes.**

## Scope Guards

- No public conflict-setup feature.
- No `__test` use in command implementation.
- No direct `/v1/merges/.../resolve` fetch in the new E2E test; use `runCli`.
- No lock release/unlock implementation.
- No API response shape change.
- No change to merge open behavior.
- No prior goal gate may be weakened to pass this goal.
