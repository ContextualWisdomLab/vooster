---
title: Agent-facing contract follow-ups (post spec-impl audit)
created_at: 2026-05-26T12:34:51Z
resolved: partial
priority: P2
resolved_by:
  - 8d27157
  - 5ce7ea5
  - 73dca0f
  - 97b766d
status_notes: |
  2026-06-03 re-verified: items 1-3 are CLOSED (suggested-command
  corrections, goal create --actor name alignment, single format_version: 1
  envelope). 4a/4c reason-only conversion stays deferred to a reviewed slice:
  making suggested_next_actions.command optional is contract-wide loosening
  across @vooster/contracts schemas, CLI printers, and tests. KEEP partial.
  Suggested-command corrections — CLOSED 2026-05-26 (commit 8d27157).
  Goal create `--actor` name alignment — CLOSED 2026-05-26 (commit 5ce7ea5);
    closes audit §A2 "Goals: requires --actor-id not --actor".
  Agent envelope `format_version` split (1 read / 2 mutation) — CLOSED
    2026-06-02 (cycle 260602-01): consolidated to a single `format_version: 1`.
    The mutation envelope (`apps/cli/src/domain/envelope.ts`) keeps its richer
    fields (status/error/affected_files/dry_run) as additive optional members
    of the v1 schema; `ENVELOPE_VERSION_V2` const removed. Acceptance signal met:
    `grep -rn "ENVELOPE_VERSION_V2\|format_version: 2\|: 2 as const" apps/cli/src`
    returns nothing. Gate `7.A2` updated (goal-design §5 case (b): invariant
    changed from read=1/mutation=2 to single v1, goal-7.md prose re-aligned in
    the same commit) and tests tightened to `format_version === 1`.
  Unroutable-suggestion follow-up sweep — `vspec workspace create` →
    `vspec login --workspace-name …` and `vspec api-key refresh` →
    `vspec api-key create` corrected this pass (commit 73dca0f).
  API suggests no-equivalent commands — `actor restore` cut pre-beta by 97b766d;
    `member set-role`/`member list` and `workspace list` remain OPEN (P2).
    2026-06-02 (cycle 260602-01) — measured blast radius before attempting
    option (b) "reason-only" and DEFERRED it (finding already says "after
    beta"): making `command` optional is not local. `suggestedNextActionSchema`
    (command required) is reused by 17 contract response schemas
    (`packages/contracts/src/{impact,doctor,usecase,invitation,branch,lock,
    change,common,api-key,goal,who,session,revision,comment,ai-guide,sync,
    merge}.ts`), and many CLI printers (ai-guide.ts:57, api-key.ts:130/194,
    change-output.ts:24, …) read `action.command` unconditionally — so option
    (b) is a contract-wide loosening + per-printer null-safety sweep + ~10 API
    sites + ~10 test updates, not the small change first estimated. Left OPEN/
    deferred: too cross-cutting to land safely in an unattended run; do it as a
    dedicated reviewed slice.
related:
  - docs/findings/2026-05-24T1100-spec-impl-audit.md
  - docs/06-api-contract.md
  - docs/07-cli-spec.md
---

# Agent-facing contract follow-ups (post spec-impl audit)

## TL;DR

A focused pass over the **agent-facing contract** (the `suggested_next_actions`
commands the API hands back, and the goal-create actor field) on top of the
2026-05-24 spec↔impl audit. Every suggested command was swept against the CLI
dispatcher: the **agent-breaking** ones with a runnable equivalent are now
**fixed** (item 1 + the follow-up sweep: goal `--actor`, `workspace create`,
`api-key refresh`); the remaining ones with **no** runnable equivalent (`member
set-role`/`list`, `workspace list`) and the envelope-version split are
**deferred** and recorded here. `actor restore` was cut because the existing
`actor create` suggestion gives agents a runnable recovery path. Domain model / endpoint-shape
drift is **not** re-litigated here — it lives in
`docs/findings/2026-05-24T1100-spec-impl-audit.md` (§A1, §A5).

## Closed in this pass

### 1. Untruthful `suggested_next_actions` — CLOSED (commit `8d27157`)

The API emitted next-step commands that don't exist or are malformed, so an AI
agent following them would fail. Each correct form already existed elsewhere in
the codebase; these were internal-inconsistency outliers (several pinned in
place by tests asserting the wrong string).

- `vspec actor define` → `vspec actor create` (`apps/api/src/http/project-results.ts:19`).
- `vspec scenario main` → `vspec scenario add <key> --type main-success` (`apps/api/src/http/goal-promotion-results.ts:63`).
- `vspec changes commit <id>` → `vspec change commit --preview-id <id>` (`apps/api/src/application/impact-analysis.ts:177`).
- `vspec unlock` → `vspec who <key>` (`apps/api/src/http/step-lock-support.ts:40,58`; `apps/api/src/http/change-preview-support.ts:49`). Required threading the use case into the step-edit lock results (`apps/api/src/application/step-editing.ts:52-53,100,106`) so the key is available.
- Dropped redundant/false `vspec lock list` from `who` output (`apps/api/src/application/who-is-working.ts`) — the response already lists the locks.

Acceptance signal: `grep -rn "actor define\|scenario main\|changes commit\|vspec unlock\|vspec lock list" apps/api/src apps/cli/src apps/api/tests apps/cli/tests` returns nothing. Full suite green (952 → see commit).

**Follow-up sweep (2026-05-26, this pass).** Item 1's grep was scoped to those
five strings and missed two more suggestions that also pointed at unroutable
commands but had a runnable equivalent to redirect to. Both corrected here
(commit `73dca0f`):

- `vspec workspace create` → `vspec login --workspace-name <name> --workspace-slug <slug>` (`apps/api/src/http/project-results.ts:62`, `apps/api/src/application/signup.ts:46,128`; tests `apps/api/tests/e2e/UC-002.test.ts:118`, `apps/api/tests/unit/application/signup.test.ts:168`). Workspace creation already exists via the login signup flags (`apps/cli/src/commands/login.ts:50,134`) — there is no separate `workspace create` command.
- `vspec api-key refresh` → `vspec api-key create` (`apps/api/src/http/sync-results.ts:28`; fixture `apps/api/tests/helpers/sync-fixtures.ts:195`, exercised by `apps/api/tests/e2e/UC-029.test.ts`). `api-key` routes only `create`/`list`/`revoke` — rotation is a fresh `create`.

The remaining unroutable suggestions have **no** runnable equivalent and stay
open — see item 4.

### 2. Goal create `--actor` by name — CLOSED (commit `5ce7ea5`)

`goal create` was the lone command requiring an actor _id_ while usecase
authoring, step add, and stakeholder interests resolve by name — forcing agents
to special-case goals. It now also accepts `--actor <name>` / `{ actor }`,
resolved via `ActorStore.findActorByName` (`apps/api/src/application/actor-goals.ts`),
keeping `--actor-id` / `actor_id` for back-compat (at least one required).
Closes the audit §A2 item "Goals: requires `--actor-id` not `--actor`".

## Open (deferred to post-beta)

### 3. Agent envelope `format_version` split — P2

The documented agent envelope is `format_version: 1`
(`docs/07-cli-spec.md:565`, `docs/usecases/UC-034-ai-fetch-spec.md:42,83`), and
read commands emit it via `apps/cli/src/agent-envelope.ts:1`
(`FORMAT_VERSION = 1`). But **mutation** commands emit a _different_
`format_version: 2` envelope (`apps/cli/src/domain/envelope.ts:1`
`ENVELOPE_VERSION_V2 = 2`, consumed in
`apps/cli/src/application/mutation-command.ts:3`) with extra
`status` / `error` / `affected_files` / `dry_run` fields.

The richer mutation envelope is _useful_ (an agent committing a change wants
`affected_files` and `dry_run`), but using `format_version` to encode a
read-vs-write distinction is wrong: that field denotes schema evolution, and the
extra fields are additive/optional, so they don't need a version bump.

**Recommendation:** consolidate to a single `format_version: 1` schema where the
mutation-only fields are optional additions, rather than two coexisting
versions. Touches every mutation command + tests, so defer until after beta.

**Acceptance signal:** `grep -rn "ENVELOPE_VERSION_V2\|format_version: 2\|: 2 as const" apps/cli/src` returns nothing, and both read and mutation agent output carry `format_version: 1`.

### 4. API suggests commands with no runnable equivalent — P2

The same sweep found three more unroutable-command classes that — unlike
workspace-create / api-key-refresh above — have **no** correct command to swap
in, so they cannot be mechanically fixed and are deferred.

**4a. `member set-role` / `member list`.** The API hands these back as
`suggested_next_actions` in permission-denied (403) contexts, but only
`member invite` is implemented (`apps/cli/src/commands/member.ts`; the audit
§07 lists `member list/set-role/remove` as 🔵 Planned). Sites:

- `apps/api/src/http/usecase-results.ts:65`
- `apps/api/src/http/revision-diff-routes.ts:103`
- `apps/api/src/http/invitation-problems.ts:19`
- `apps/api/src/http/invitation-results.ts:33`
- `apps/api/src/http/impact-results.ts:63`
- `apps/api/src/http/revision-history-results.ts:37`
- `apps/api/src/http/branch-results.ts:18`
- `apps/api/src/http/api-key-results.ts:79`

These were deliberately **not** corrected alongside item 1: they sit in 403
contexts where the recipient lacks the permission to run them anyway, they
point at _planned_ commands (not typos of existing ones), and they are pinned
by ~10 test assertions (e.g. `apps/api/tests/e2e/UC-009.test.ts:214`,
`UC-027.test.ts:224`, `apps/cli/tests/unit/member-api-key-agent-format.test.ts:64`).

**4b. `vspec actor restore` — CLOSED** (`apps/api/src/http/actor-results.ts:55`, test
`apps/api/tests/e2e/UC-005.test.ts:124`) — emitted on a 409 archived-name
collision (UC-005 ext 3b), but actors have no restore/un-archive command or
route (`actor` routes only create/list/show/edit/archive). **Decision: cut, not
build.** Actor `archive` earns its place — it removes an actor from the
primary-actor / step-doer pool (`apps/api/src/application/usecases.ts:98`,
`apps/api/src/application/scenario-authoring.ts:119`) while preserving
referential integrity for use cases that already reference it. But `restore`
exists only to reclaim an archived name, which "use a different name" already
solves. Resolution: the API no longer suggests `vspec actor restore`, and
UC-005 3b2 now recommends choosing a different name with `vspec actor create`.

**4c. `vspec workspace list`** (`apps/api/src/http/who-results.ts:35`,
`apps/api/src/http/session-list-results.ts:22`; tests
`apps/api/tests/e2e/UC-023.test.ts:240`, `apps/api/tests/e2e/UC-017.test.ts:214`)
— no `workspace list` command (`workspace` only routes `switch`). The
accessible workspaces are already returned by the login / session responses, so
this should be reason-only, not a command.

**Options (4a `member` commands):**

- (a) Implement `member list` / `member set-role` (post-MVP feature; carries authz design).
- (b) Strip the `command` field and make these reason-only advisory. Requires making `command` optional in `SuggestedNextAction` (`apps/cli/src/domain/envelope.ts:11`, `apps/cli/src/agent-envelope.ts:11`) and updating the asserting tests.

**Recommendation:** (b) after beta for 4a and 4c — a 403 advisory should not
advertise a command the caller cannot run; make them reason-only via the same
optional-`command` change. 4b (`actor restore`) is closed pre-beta with no new
command surface. Pre-MVP, leave 4a/4c as-is (no new command surface, no
envelope change yet).

**Acceptance signal:** no `suggested_next_actions` entry carries a `command`
that the CLI dispatcher (`apps/cli/src/index.ts`) cannot route.

## Decisions on file (sync-check triage, 2026-05-26)

1. **Untruthful suggestions** → correct to a runnable equivalent where one
   exists; otherwise reason-only or cut. Do not build new commands pre-MVP
   (item 1 done; follow-up sweep `workspace create` / `api-key refresh` done;
   item 4 `member`/`workspace list` reason-only deferred; `actor restore` cut).
2. **name vs id** → name-based is canonical; goal aligned to accept `--actor`
   while keeping `--actor-id` (item 2 done).
3. **Envelope v2** → document as-built now; consolidate to a single additive
   schema post-beta (item 3).
4. **Work product** → fix agent-breaking bugs now (Track 1/2); stale-but-clear
   docs patched directly (07 package name, 05 enum/String banner); deferred
   design debt recorded here. Domain/endpoint-shape drift stays in the
   2026-05-24 audit, not duplicated.
