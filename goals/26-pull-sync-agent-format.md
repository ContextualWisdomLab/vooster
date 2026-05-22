# Goal 26: Pull and Sync Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 25 moved `project create` out of the agent-format findings queue. The next
small implemented slice is the pull path:

```
pull
sync
```

`pull` and `sync` currently share the same implementation path:
`runSync(flags, "sync")` behaves like a pull. This goal adds
`--format=agent` to the existing behavior and deliberately leaves `push` queued
for a follow-up goal because push has separate cache and guidance semantics.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-26-pull-sync-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is additive, with one required case (a) Retarget and one explicit
supersession:

- **Retarget:** Prior gates and next-task shims used the `pull`, `push`, `sync`
  findings bullet as the remaining-debt sentinel. This goal narrows that bullet
  to `push`, so those files are retargeted to the next sentinel, `push`.
- **Supersedes:** Goal 22 through Goal 25 scope guards kept pull/push/sync
  agent branches out of their slices. This goal intentionally replaces that
  stale guard for the pull path only.
- No prior invariant is loosened. The invariant remains "unrelated debt still
  exists"; only the sentinel literal changes.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding the branch in `sync.ts` makes those checks
  cover the shared implementation.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The pull/sync agent-format debt is removed without clearing unrelated
    debt.** The `pull`, `push`, `sync` bullet is gone, and the `push` bullet
    remains.

A2. **Prior findings sentinels are retargeted without weakening their
    invariant.** Every prior `goals/*.gates.sh` and `goals/*.next-task.sh` file
    no longer requires the `pull`, `push`, `sync` bullet and instead requires
    the `push` bullet when it needs a remaining-debt sentinel.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents pull/sync agent format.** A marked
    `### Agent Format — Pull and Sync` section exists and includes:

    ```
    vspec pull --format=agent
    vspec sync --format=agent
    ```

    The section states that context stays at the default null values, `pull`
    and current `sync` behavior both expose `data.cursor` and `data.files`,
    files are written before the envelope is emitted, and
    `suggested_next_actions` remains empty.

### Tranche C — CLI Implementation

C1. **`sync.ts` is discovered by the same source of truth as Goal 7.** The gate
    runs `grep -rl 'format === "agent"' apps/cli/src/commands` and requires
    `apps/cli/src/commands/sync.ts` to appear.

C2. **`pullFiles` builds an agent envelope when requested.** The gate extracts
    `pullFiles` from `apps/cli/src/commands/sync.ts` and requires
    `format === "agent"` plus `buildAgentEnvelope`.

C3. **`pull`, `sync`, and the shared sync flags expose the format flag.**
    `PullCommand.flags` and `SyncCommand.flags` include
    `format: Flags.string()`, and the shared flag type contains
    `format?: string`.

C4. **`push` remains queued until superseded by Goal 27.** Goal 26 itself does
    not implement push agent format; Goal 27 may replace this temporary guard
    with explicit push proof.

### Tranche D — Unit Proof

D1. **Pull/sync has focused unit proof for agent and human output.** The file
    `apps/cli/tests/unit/pull-sync-agent-format.test.ts` contains test titles
    `agent pull`, `agent sync uses pull behavior`, and `human pull output`.
    Agent tests use temp roots, parse stdout as one JSON object, assert
    `format_version`, assert the full default null context, assert
    `data.cursor`, assert `data.files`, assert written files exist, and assert
    default empty `suggested_next_actions` and `warnings`.

### Tranche E — Honest E2E Proof

E1. **Pull/sync has honest E2E proof.** The file
    `apps/cli/tests/e2e-cli-honest/pull-sync-agent-format.test.ts` contains
    test title `agent pull and sync write canonical files`, invokes
    `runCli([ "pull", ... ])` and `runCli([ "sync", ... ])` with
    `--format=agent`, uses `VSPEC_CONFIG_PATH`, does not call `fetch(`, parses
    JSON, asserts `format_version`, asserts the full default null context,
    asserts `data.cursor`, asserts `data.files`, and asserts the pulled files
    exist under the temp roots.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
    new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
    `goals/7-cli-spec-parity.gates.sh` contains no pull/sync agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/26-pull-sync-agent-format.md`
    passes.**

## Scope Guards

- No push agent branch in Goal 26; this temporary guard is superseded by
  Goal 27.
- No lock release/renew implementation.
- No merge resolve implementation.
- No API response shape change.
- No change to current `sync` semantics.
- No prior goal gate may be weakened to pass this goal.
