# Goal 24: Local Context Agent Format

> 이 goal을 active로 잡은 에이전트는 먼저
> `guidelines/goal-iteration.md`를 읽어 iteration 프로토콜을 확인할 것.

## Why This Goal Exists

Goal 23 moved member/API-key admin verbs out of the agent-format findings
queue. The next small local slice is:

```
status
workspace switch
project switch
```

These commands read or mutate only the local CLI config. They are useful to
agents because they reveal and change the active workspace/project context
without a server dependency.

The findings queue currently groups `project create` and `project switch`
together. `project create` already has a partial agent branch but is server-side
and has config-write semantics that deserve a separate goal. This goal narrows
that findings bullet to `project create`, removes `workspace switch` and
`status`, and leaves unrelated sync, merge, lock renewal, and project-create
debt queued. Goal 25 later removes the project-create debt and retargets this
goal's remaining-debt sentinel to `push`.

## Advisor Feedback

This goal incorporates Claude headless feedback recorded at
`.state/harness/advisor/goal-24-local-context-agent-format-feedback.md`.

## Self-Audit (per `docs/goal-design.md §5`)

This goal is mostly additive, with one explicit supersession. It does not
retarget prior sentinels because prior agent-format goals already use the
unrelated `pull` / `push` / `sync` bullet as their remaining-debt marker.

- **Supersedes:** Goal 22 and Goal 23 scope guards kept
  project/workspace/status agent branches out of their slices. This goal
  intentionally replaces that stale guard for the local context commands.
- No prior invariant is loosened.
- Goal 7's grep-based envelope gates discover command files that contain
  `format === "agent"`, so adding branches in `status.ts`, `workspace.ts`, and
  `project.ts` makes those checks cover these command files automatically.

## The Goal

All conditions below hold. Gates enumerate the declared checks; one example
cannot satisfy the goal.

### Tranche A — Findings Debt

A1. **The local-context agent-format debt is removed without clearing unrelated
debt.** The `project create` / `project switch` bullet is removed, the
`workspace switch` bullet is gone, the `status` bullet is gone, and the
`push` bullet remains. Goal 25 supersedes this goal's
temporary project-create sentinel.

### Tranche B — CLI Spec

B1. **`docs/07-cli-spec.md` documents local context agent format.** A marked
`### Agent Format — Local Context` section exists and includes:

    ```
    vspec status --format=agent
    vspec workspace switch <slug> --format=agent
    vspec project switch <key> --format=agent
    ```

    The section states that context stays at the default null values,
    `status` exposes `data.config.current_project_key`,
    `workspace switch` exposes `data.workspace.slug` and
    `data.config.current_workspace_slug`, and `project switch` exposes
    `data.project.key`.

### Tranche C — CLI Implementation

C1. **`status.ts`, `workspace.ts`, and `project.ts` are discovered by the same
source of truth as Goal 7.** The gate runs
`grep -rl 'format === "agent"' apps/cli/src/commands` and requires all
three command files to appear.

C2. **Every targeted handler builds an agent envelope when requested.** The gate
extracts `runStatus`, `runWorkspace`, and `switchProject` and requires
`format === "agent"` plus `buildAgentEnvelope` in each handler or in a
local helper called by the handler.

C3. **Switch handlers mutate config before returning agent output.** The
workspace and project switch handlers call `writeConfig` before writing the
agent envelope.

C4. **Local commands expose the format flag.** `StatusCommand.flags` and
`WorkspaceCommand.flags` include `format: Flags.string()`, and
`ProjectCommand.flags` continues to include `format: Flags.string()`.

### Tranche D — Unit Proof

D1. **Local context has focused unit proof for agent and human output.** The
file `apps/cli/tests/unit/local-context-agent-format.test.ts` contains test
titles `agent status`, `agent workspace switch`, `agent project switch`,
and `human local context output`. Agent tests isolate config with
`VSPEC_CONFIG_PATH`, parse stdout as one JSON object, assert
`format_version`, assert the full default null context, assert
`data.config.current_project_key`, assert `data.workspace.slug`, assert
`data.config.current_workspace_slug`, assert `data.project.key`, and assert
default empty `suggested_next_actions` and `warnings`.

### Tranche E — Honest E2E Proof

E1. **Local context has honest E2E proof.** The file
`apps/cli/tests/e2e-cli-honest/local-context-agent-format.test.ts`
contains test title `agent local context lifecycle`, invokes
`runCli([ "status", ... ])`, `runCli([ "workspace", "switch", ... ])`, and
`runCli([ "project", "switch", ... ])` with `--format=agent`, uses
`VSPEC_CONFIG_PATH`, does not call `fetch(`, parses JSON, asserts
`format_version`, asserts the full default null context, asserts config
effects using follow-up `status --format=agent`, and asserts both
`current_workspace_id` and `current_workspace_slug` for workspace switch.

E2. **The honest proof is verb-level and does not widen Goal 7's UC set.** The
new honest file is not named `UC-*.test.ts`, and `HONEST_UC_SET` in
`goals/7-cli-spec-parity.gates.sh` contains no local-context agent entry.

### Tranche F — Rigor

F1. **`scripts/check-gate-rigor.sh goals/24-local-context-agent-format.md`
passes.**

## Scope Guards

- No `project create` behavior change in Goal 24; Goal 25 supersedes this
  guard for `project create --format=agent`.
- No push agent branch.
- No lock release/renew implementation.
- No merge resolve implementation.
- No API response shape change.
- No prior goal gate may be weakened to pass this goal.
