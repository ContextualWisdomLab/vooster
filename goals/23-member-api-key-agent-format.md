# Goal 23: Member and API Key Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 22 moved the comment lifecycle out of the agent-format findings queue.
The next implemented admin slice is:

```
member invite
api-key create
api-key list
api-key revoke
```

These commands are already server-backed and have human-output coverage. This
goal adds `--format=agent` without changing membership semantics, API-key token
semantics, or the currently required `member invite --role` flag.

The findings queue currently contains the member/API-key group. This goal
promotes that group and leaves unrelated sync, project/workspace, status,
merge, and lock renewal debt queued.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-23-member-api-key-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is additive, with one required case (a) Retarget:

- **Supersedes:** Goal 9 Tranche E2 and its matching scope guard kept
  `member.ts` and `api-key.ts` envelope-free only as a temporary scope-down
  decision. This goal intentionally replaces that stale exclusion for the
  member/API-key admin slice.
- **Retarget:** Prior gates and next-task shims used the member/API-key
  findings bullet as the remaining-debt sentinel. This goal removes that
  bullet, so every prior gate/next-task file that checked it is retargeted to
  the next unrelated sentinel, `pull` / `push` / `sync`.
- No prior invariant is loosened. The invariant remains "unrelated debt still
  exists"; only the sentinel literal changes.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding branches in `member.ts` and `api-key.ts`
  makes those checks cover these command files automatically.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The member/API-key agent-format debt is removed without clearing
    unrelated debt.** The `member invite`, `api-key create|list|revoke` bullet
    is gone, and the `push` bullet remains.

A2. **Every prior sentinel is retargeted without weakening its invariant.**
    Every prior `goals/*.gates.sh` and `goals/*.next-task.sh` file no longer
    requires the member/API-key bullet and instead requires the `pull`, `push`,
    `sync` bullet when it needs a remaining-debt sentinel.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents member/API-key agent format.** Marked
    `### Agent Format — API Keys` and `### Agent Format — Membership`
    sections exist and include:

    ```
    vspec api-key create --name "<text>" --scopes read,write --format=agent
    vspec api-key list --format=agent
    vspec api-key revoke <id> --format=agent
    vspec member invite --email <email> --role editor --format=agent
    ```

    The section states that context stays at the default null values, create
    payloads expose `data.api_key.id` and `data.plaintext_token`, list payloads
    expose `data.api_keys` without a plaintext token field, revoke payloads
    expose `data.api_key.id`, member payloads expose `data.invitation.email`,
    write handlers copy `suggested_next_actions` from the API response, and
    list leaves `suggested_next_actions` empty.

### Tranche C — CLI Implementation

C1. **`member.ts` and `api-key.ts` are discovered by the same source of truth
    as Goal 7.** The gate runs
    `grep -rl 'format === "agent"' apps/cli/src/commands` and requires both
    command files to appear.

C2. **Every targeted handler builds an agent envelope when requested.** The gate
    extracts `inviteMember`, `createApiKey`, `listApiKeys`, and `revokeApiKey`
    and requires `format === "agent"` plus `buildAgentEnvelope` in each handler
    or in a local helper called by the handler.

C3. **Write handlers preserve guidance.** The member invite, API-key create,
    and API-key revoke handlers pass `body.suggested_next_actions` to
    `buildAgentEnvelope`.

C4. **API-key list keeps default guidance.** The list handler builds an agent
    envelope with the API body and does not synthesize `suggested_next_actions`.

C5. **The commands expose the format flag.** `MemberCommand.flags` and
    `ApiKeyCommand.flags` include `format: Flags.string()`.

### Tranche D — Unit Proof

D1. **Member/API-key has focused unit proof for agent and human output.** The
    file `apps/cli/tests/unit/member-api-key-agent-format.test.ts` contains
    test titles `agent member invite`, `agent api-key create`, `agent api-key
    list`, `agent api-key revoke`, and `human member and api-key output`.
    Agent tests parse stdout as one JSON object, assert `format_version`, assert
    the full default null context, assert the expected `data` paths, assert
    copied `suggested_next_actions` for write handlers, assert list defaults to
    empty `suggested_next_actions`, assert default empty warnings, and assert
    API-key list does not expose `plaintext_token`.

### Tranche E — Honest E2E Proof

E1. **Member/API-key has honest E2E proof.** The file
    `apps/cli/tests/e2e-cli-honest/member-api-key-agent-format.test.ts`
    contains test title `agent member and api-key admin lifecycle`, invokes
    `runCli([ "member", ... ])` and `runCli([ "api-key", ... ])` with
    `--format=agent`, uses `VSPEC_CONFIG_PATH`, does not call `fetch(`,
    captures `data.api_key.id` from the create envelope and passes it to
    revoke, parses JSON, asserts `format_version`, asserts the full default
    null context, asserts member invitation email, asserts list includes the
    created key, asserts list omits `plaintext_token`, and asserts revoke
    preserves the key id.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
    new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
    `goals/7-cli-spec-parity.gates.sh` contains no member/API-key agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/23-member-api-key-agent-format.md`
    passes.**

## Scope Guards

- No push agent branch.
- No project/workspace/status agent branches in Goal 23; Goal 24 supersedes
  this guard for local context commands.
- No lock release/renew implementation.
- No merge resolve implementation.
- No API response shape change.
- No change to the current `member invite --role` requirement.
- No prior goal gate may be weakened to pass this goal.
