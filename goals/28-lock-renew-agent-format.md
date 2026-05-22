# Goal 28: Lock Renew Implementation and Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

The remaining lock debt is grouped as:

```
lock release
lock renew
```

Renew is the smaller slice because the API already exposes
`POST /v1/locks/:lockId/renew`, while release/unlock has no dedicated API route
or CLI implementation. This goal implements `vspec lock renew` by lock id,
updates the acquire guidance to emit that lock id, and adds the shared
`--format=agent` envelope.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-28-lock-renew-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is additive, with one required case (a) Retarget:

- **Retarget:** Prior gates and next-task shims use the
  `` `lock release` / `lock renew` `` findings bullet as the remaining-debt
  sentinel. This goal splits renew out, so those files are retargeted to
  `` `lock release` ``.
- **Retarget:** Goal 13.A1 positively required the combined lock release/renew
  literal. This goal keeps the invariant that unrelated lock release debt
  remains and changes only the sentinel literal.
- No prior invariant is loosened. The invariant remains "unrelated debt still
  exists"; only the sentinel literal changes.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The lock renew debt is removed without clearing unrelated debt.** The
    `` `lock release` / `lock renew` `` bullet is gone, and the
    `` `lock release` `` and `merge resolve` bullets remain.

A2. **Every prior findings sentinel is retargeted without weakening its
    invariant.** Every prior `goals/*.gates.sh` and `goals/*.next-task.sh` file
    no longer requires the combined `` `lock release` / `lock renew` `` bullet
    and instead requires `` `lock release` `` when it needs a remaining-debt
    sentinel.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents lock renew by lock id and agent format.**
    The lock synopsis includes:

    ```
    vspec lock renew <lock-id> [--ttl <minutes>]
    vspec lock renew <lock-id> --format=agent
    ```

    The section `### Agent Format - Lock Renew` states that `data.lock.id`,
    `data.lock.expires_at`, and `context.session_id` are exposed, current API
    renew response does not populate `suggested_next_actions`, the envelope's
    top-level `suggested_next_actions` is therefore an empty array, and
    `warnings` remains empty.

### Tranche C — CLI/API Implementation

C1. **The acquire guidance matches lock-id renew.** The API lock acquire
    guidance emits `vspec lock renew ${result.lock.id}`.

C2. **`lock renew` is routed without weakening acquire dispatch.** The CLI
    index routes `lock renew`, and the acquire dispatch still includes
    `this.argv[1] !== "renew"`.

C3. **`runLock` supports acquire and renew.** `runLock` accepts an action,
    routes `"renew"` through `/v1/locks/${lockId}/renew`, sends `ttl_minutes`,
    preserves optional `X-Vspec-Session`, and uses
    `body.suggested_next_actions ?? []`.

C4. **Renew builds an agent envelope when requested.** The lock command renew
    path requires `format === "agent"`, `buildAgentEnvelope`, `data: body`,
    `context: { session_id: ... }`, and copied suggested actions.

### Tranche D — Unit Proof

D1. **Lock renew has focused unit proof for agent and human output.** The file
    `apps/cli/tests/unit/lock-renew-agent-format.test.ts` contains test titles
    `agent lock renew`, `agent lock renew without session`, and
    `human lock renew`. Agent tests parse stdout with `JSON.parse(stdout)`,
    assert `format_version`, assert `data.lock.id`, assert
    `data.lock.lock_type`, assert `data.lock.target_id`, assert
    `data.lock.expires_at`, assert `data.lock.held_by_session_id`, assert
    `context.session_id`, assert empty `suggested_next_actions`, assert empty
    `warnings`, assert the URL contains `/v1/locks/` and `/renew`, assert
    `ttl_minutes`, assert `X-Vspec-Session` is present with a session, and
    assert `X-Vspec-Session` is absent without a session.

### Tranche E — Honest E2E Proof

E1. **Lock renew has honest E2E proof.** The file
    `apps/cli/tests/e2e-cli-honest/lock-renew-agent-format.test.ts` contains
    test title `agent lock renew`, invokes `runCli([ "lock", "renew", ... ])`
    with `--format=agent`, uses `VSPEC_CONFIG_PATH`, uses `seedViaCli`, does not
    call `fetch(`, parses JSON, asserts `format_version`, asserts
    `data.lock.id`, asserts `data.lock.expires_at`, asserts
    `context.session_id`, asserts empty `suggested_next_actions`, and proves the
    renewed expiry differs from the acquired expiry.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
    new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
    `goals/7-cli-spec-parity.gates.sh` contains no lock-renew entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/28-lock-renew-agent-format.md`
    passes.**

## Scope Guards

- No unlock or release implementation.
- No API route changes.
- No merge resolve implementation.
- No lock acquire behavior change beyond guidance using lock id.
- Do not remove the `&& this.argv[1] !== "renew"` acquire dispatch guard.
- No prior goal gate may be weakened to pass this goal.
