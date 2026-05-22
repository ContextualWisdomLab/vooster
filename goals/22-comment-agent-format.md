# Goal 22: Comment Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 21 moved `revert` out of the agent-format findings queue. The next small
implemented slice is the comment lifecycle:

```
comment add
comment list
comment edit
comment resolve
comment delete
```

The findings queue currently contains this comment group. This goal promotes
that single use-case lifecycle and leaves unrelated member/API-key, sync,
project/workspace, status, merge, and lock renewal debt queued.

`comment` already exists and has human-output coverage. This goal adds
`--format=agent` for the five implemented comment verbs. Agent mode emits one
JSON envelope write and no human lines.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-22-comment-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is mostly additive, with one required case (a) Retarget:

- **Retarget:** Gates and next-task shims for Goals 18, 19, 20, and 21 used
  the comment findings bullet as the remaining-debt sentinel. This goal removes
  that bullet, so those files are retargeted to the next unrelated sentinel,
  `member invite` / `api-key create|list|revoke`.
- No prior invariant is loosened. The invariant remains "unrelated debt still
  exists"; only the sentinel literal changes.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding a branch in `comment.ts` makes those checks
  cover this command file automatically.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The comment agent-format debt is removed without clearing unrelated
    debt.** The `comment add|list|edit|resolve|delete` bullet is gone, and the
    `member invite` / `api-key create|list|revoke` bullet remains.

A2. **Prior findings sentinels are retargeted without weakening their
    invariant.** Goal 18, Goal 19, Goal 20, and Goal 21 gate and next-task
    files no longer require the comment bullet and instead require the
    `member invite` / `api-key create|list|revoke` bullet.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents comment agent format.** A marked
    `### Agent Format — Comments` section exists under Comments and includes:

    ```
    vspec comment add <KEY-NNN> --body "<text>" --format=agent
    vspec comment list <KEY-NNN> --format=agent
    vspec comment edit <comment-id> --body "<text>" --format=agent
    vspec comment resolve <comment-id> --format=agent
    vspec comment delete <comment-id> --format=agent
    ```

    The section states that context stays at the default null values,
    `comment list` leaves `suggested_next_actions` empty, write handlers copy
    `suggested_next_actions` from the API response, write payloads expose
    `data.comment.id`, and list payloads expose `data.comments`.

### Tranche C — CLI Implementation

C1. **`apps/cli/src/commands/comment.ts` is discovered by the same source of
    truth as Goal 7.** The gate runs
    `grep -rl 'format === "agent"' apps/cli/src/commands` and requires
    `apps/cli/src/commands/comment.ts` to appear.

C2. **All comment handlers build an agent envelope when requested.** The gate
    extracts `addComment`, `listComments`, `editComment`, `resolveComment`,
    and `deleteComment` from `apps/cli/src/commands/comment.ts` and requires
    `format === "agent"` plus `buildAgentEnvelope` in each handler or in a
    local helper called by the handler.

C3. **Comment write handlers preserve guidance.** The add, edit, resolve, and
    delete handlers pass `body.suggested_next_actions` to
    `buildAgentEnvelope`.

C4. **Comment list keeps default guidance.** The list handler builds an agent
    envelope with the API body and does not synthesize
    `suggested_next_actions`.

C5. **Comment delete omits human-only confirmation in agent mode.** The delete
    handler returns from the agent branch before the human-only `Deleted true`
    write.

C6. **`comment` exposes the format flag.** `CommentCommand.flags` includes
    `format: Flags.string()`.

### Tranche D — Unit Proof

D1. **Comment has focused unit proof for each agent verb and human lifecycle
    output.** The file `apps/cli/tests/unit/comment-agent-format.test.ts`
    contains test titles `agent comment add`, `agent comment list`,
    `agent comment edit`, `agent comment resolve`, `agent comment delete`, and
    `human comment lifecycle`. Agent tests invoke the relevant verb with
    `--format=agent`, parse stdout as one JSON object before negative substring
    assertions, assert `format_version`, assert the full default null context,
    assert `data.comment.id` for write handlers, assert `data.comments` for
    list, assert copied `suggested_next_actions` for write handlers, and assert
    default empty warnings.

### Tranche E — Honest E2E Proof

E1. **Comment has honest E2E proof.** The file
    `apps/cli/tests/e2e-cli-honest/comment-agent-format.test.ts` contains test
    title `agent comment lifecycle`, invokes `runCli([ "comment", ... ])` with
    `--format=agent` for add, list, edit, resolve, and delete, uses
    `VSPEC_CONFIG_PATH`, does not call `fetch(`, captures `data.comment.id`
    from the add envelope and passes it to edit, resolve, and delete, parses
    JSON, asserts `format_version`, asserts the full default null context,
    asserts comment id stability across the lifecycle, asserts list includes
    the comment, asserts resolve sets `resolved: true`, and asserts delete
    returns the comment payload without human `Deleted true`.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
    new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
    `goals/7-cli-spec-parity.gates.sh` contains no comment-agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/22-comment-agent-format.md` passes.**

## Scope Guards

- No member or API-key agent branches.
- No push agent branch.
- No project/workspace/status agent branches in Goal 22; Goal 24 supersedes
  this guard for local context commands.
- No lock release/renew implementation.
- No merge resolve implementation.
- No API response shape change.
- No synthetic `deleted: true` field in agent output.
- No prior goal gate may be weakened to pass this goal.
