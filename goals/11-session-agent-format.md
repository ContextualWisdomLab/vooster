# Goal 11: Session Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goals 7, 9, and 10 established the shared `buildAgentEnvelope` shape and proved
the first project/actor/stakeholder/goal/usecase write paths. The next remaining
agent-facing debt in `docs/findings/2026-05-21T1856-cli-spec-gaps.md` is session context:

```
session start
session list
session complete
```

These commands are how coding agents announce work, inspect active work, and
close a session. They need the same `--format=agent` JSON envelope as the prior
CLI surfaces, with real response data and explicit context behavior.

The CLI does not change the API response contract in this goal. The envelope
uses the existing API response as `data`. For `session start` and
`session complete`, `context.session_id` is copied from `data.session.id`. For
`session list`, context remains the shared default null context because the
command returns a collection, not one active session.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is additive.

- No prior gate is retargeted.
- No prior invariant is loosened.
- No prior goal is superseded.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding a branch in `session.ts` makes those checks
  cover this command file automatically.
- Goal 9/10 cache inputs already include CLI sources and honest CLI tests; no
  prior gate retargeting is needed.

## The Goal

All conditions below hold. Gates enumerate the declared verb sets; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The session agent-format debt is removed from
`docs/findings/2026-05-21T1856-cli-spec-gaps.md`, without clearing unrelated debt.** The
bullet containing `session start`, `session complete`, and `session list`
is gone. The next unrelated `lock` debt remains. Goal 12 supersedes the
original guard that `branch create` remain.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents session agent format.** A marked section
named `### Agent Format for Sessions` exists under the Sessions section and
includes examples for:

    ```
    vspec session start --format=agent
    vspec session list --format=agent
    vspec session complete <id> --format=agent
    ```

    The section states that `context.session_id` is populated for start and
    complete, and default null context is used for list.

### Tranche C — Handler-Level Agent Branches

C1. **`apps/cli/src/commands/session.ts` is discovered by the same source of
truth as Goal 7.** The gate runs
`grep -rl 'format === "agent"' apps/cli/src/commands` and requires
`apps/cli/src/commands/session.ts` to appear.

C2. **Every implemented session handler builds an agent envelope when
`--format=agent` is requested.** Source of truth:

    ```
    session start     -> apps/cli/src/commands/session.ts:startSession
    session list      -> apps/cli/src/commands/session.ts:listSessions
    session complete  -> apps/cli/src/commands/session.ts:completeSession
    ```

    The gate extracts each function body and requires both
    `format === "agent"` and `buildAgentEnvelope` inside that function.

C3. **The session dispatcher routes exactly the implemented session verbs.**
`apps/cli/src/index.ts` routes `session start`, `session list`, and
`session complete`, and no other `session` subcommand. If a future session
subcommand is wired, this goal must be widened or followed by another
explicit goal.

### Tranche D — Unit Proof

D1. **Every implemented session verb has a distinct unit proof.** The file
`apps/cli/tests/unit/session-agent-format.test.ts` contains distinct test
titles of the form `agent session <action>` for `start`, `list`, and
`complete`; each invokes the command with `--format=agent`, parses JSON,
asserts `format_version`, asserts the envelope keys, and asserts these real
data/context keys:

    - start: `data.session.id`, `data.session.project_id`,
      `data.session.started_at`, `data.session.status`, `data.session_file.path`,
      and `context.session_id`
    - list: `data.sessions`, `data.total`, `data.summary.total_conflicts`
    - complete: `data.session.id`, `data.session.ended_at`,
      `data.session.status`, `data.released_lock_ids`, `data.session_file.path`,
      and `context.session_id`

D2. **The default human output keeps a smoke proof.** The same unit file has
distinct `human session <action>` tests for `start`, `list`, and
`complete` so adding agent format does not silently remove the existing
renderer path.

### Tranche E — Honest E2E Proof

E1. **Every implemented session verb has a distinct honest E2E proof.** The
file `apps/cli/tests/e2e-cli-honest/session-agent-format.test.ts` contains
distinct `agent session <action>` test titles, invokes `runCli([ ... ])`
with exact `session`/action tokens and `--format=agent`, uses
`VSPEC_CONFIG_PATH`, does not call `fetch(`, parses JSON, asserts
`format_version`, and asserts the same data/context keys as D1.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
`goals/7-cli-spec-parity.gates.sh` contains no session-agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/11-session-agent-format.md` passes.**

## Scope Guards

- No `session show`, `session pin`, `session unpin`, or `session abandon` work
  in this goal.
- No branch, lock, step, scenario, change, merge, history, impact, comment,
  admin, pull/push/sync, project/workspace/status agent-envelope work.
- No API response shape change.
- No prior goal gate may be weakened to pass this goal.

## Recommended Order

1. Add RED unit tests for session agent envelopes and human smoke output.
2. Add the missing session `format` flag and agent branches.
3. Add the honest E2E proof.
4. Update `docs/07-cli-spec.md` and `docs/findings/2026-05-21T1856-cli-spec-gaps.md`.
5. Run `bash goals/11-session-agent-format.gates.sh`, then
   `bash scripts/active-check.sh`.
