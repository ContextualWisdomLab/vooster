# Goal 25: Project Create Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 24 moved the local context commands out of the agent-format findings
queue. The next implemented slice is:

```
project create
```

`project create` already has a partial agent branch, but it remains queued
because it lacks focused proof and documentation. The current agent branch also
returns before the human path's local config update, so `project create
--format=agent` creates the project without making it the active project in the
CLI config.

This goal closes that behavior gap without changing the API response shape or
synthesizing guidance from `recommended_next_command`.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-25-project-create-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is mostly additive, with one required case (a) Retarget:

- **Retarget:** Goal 24 used the `project create` findings bullet as the
  remaining-debt sentinel. This goal removes that bullet, so Goal 24 gate and
  next-task files are retargeted to the next unrelated sentinel, `pull` /
  `push` / `sync`.
- No prior invariant is loosened. The invariant remains "unrelated debt still
  exists"; only the sentinel literal changes.
- No prior goal is superseded.
- Goal 7 already discovers `project.ts` through existing agent branches, so the
  implementation work here is focused on proving and fixing the project-create
  contract.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The project-create agent-format debt is removed without clearing
    unrelated debt.** The `project create` bullet is gone, and the `pull`,
    `push`, `sync` bullet remains.

A2. **Goal 24's sentinel is retargeted without weakening its invariant.** Goal
    24 gate and next-task files no longer require the `project create` bullet
    and instead require the `push` bullet.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents project-create agent format.** A marked
    `### Agent Format — Project Create` section exists and includes:

    ```
    vspec project create --name <n> --key <k> --format=agent
    ```

    The section states that context stays at the default null values, the
    command updates the local active project config before returning, the
    payload exposes `data.project.id`, `data.project.key`,
    `data.default_branch.name`, and `data.recommended_next_command`, and
    `suggested_next_actions` remains empty because the API returns
    `recommended_next_command`.

### Tranche C — CLI Implementation

C1. **`project.ts` remains discovered by the same source of truth as Goal 7.**
    The gate runs `grep -rl 'format === "agent"' apps/cli/src/commands` and
    requires `apps/cli/src/commands/project.ts` to appear.

C2. **`createProject` builds an agent envelope when requested.** The gate
    extracts `createProject` from `apps/cli/src/commands/project.ts` and
    requires `format === "agent"` plus `buildAgentEnvelope` in the handler or
    in a local helper called by the handler.

C3. **The project-create agent branch keeps API guidance as data.** The
    implementation does not synthesize `suggested_next_actions` from
    `recommended_next_command`.

### Tranche D — Unit Proof

D1. **Project create has focused unit proof for agent and human output.** The
    file `apps/cli/tests/unit/project-create-agent-format.test.ts` contains
    test titles `agent project create` and `human project create output`. The
    agent test isolates config with `VSPEC_CONFIG_PATH`, parses stdout as one
    JSON object, asserts `format_version`, asserts the full default null
    context, asserts `data.project.id`, `data.project.key`,
    `data.default_branch.name`, `data.recommended_next_command`, asserts
    default empty `suggested_next_actions` and `warnings`, and asserts
    `readConfig().current_project_id` and `readConfig().current_project_key`
    match the created project.

### Tranche E — Honest E2E Proof

E1. **Project create has honest E2E proof.** The file
    `apps/cli/tests/e2e-cli-honest/project-create-agent-format.test.ts`
    contains test title `agent project create updates active project`, invokes
    `runCli([ "project", "create", ... ])` with `--format=agent`, uses
    `VSPEC_CONFIG_PATH`, does not call `fetch(`, parses JSON, asserts
    `format_version`, asserts the full default null context, asserts
    `data.project.id`, asserts the deterministic new project key, asserts
    `data.default_branch.name`, asserts `data.recommended_next_command`, then
    invokes `runCli([ "status", "--format=agent" ])` and asserts
    `data.config.current_project_key` equals the created project key.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
    new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
    `goals/7-cli-spec-parity.gates.sh` contains no project-create agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/25-project-create-agent-format.md`
    passes.**

## Scope Guards

- No push agent branch.
- No lock release/renew implementation.
- No merge resolve implementation.
- No API response shape change.
- No synthetic `suggested_next_actions` for project create.
- No prior goal gate may be weakened to pass this goal.
