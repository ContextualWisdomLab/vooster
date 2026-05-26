---
title: Spec ↔ implementation audit (docs vs apps)
created_at: 2026-05-24T11:00:00Z
resolved: true
priority: high
kind: snapshot
resolved_by:
  - 0ab6b0d
  - 632df72
  - 968b142
status_notes: |
  Gap A — CLOSED 2026-05-24 (commit `0ab6b0d`): UC-013 step edit now supports actor changes, rejects unknown actors, marks actor changes BREAKING, and wires CLI `--actor`; verified by `apps/api/tests/e2e/UC-013.test.ts`, `apps/cli/tests/unit/step-agent-format.test.ts`, `pnpm exec vitest run apps/api/tests`, and `bash scripts/completion-check.sh`.
  Gap C — CLOSED 2026-05-24 (commit `632df72`): UC-016 auto-branch sessions now create one session-held SEMANTIC lock per pinned use case; verified by `apps/api/tests/e2e/UC-016.test.ts`, `pnpm exec vitest run apps/api/tests`, and `bash scripts/completion-check.sh`.
  Cross-cutting reference docs (06/07/08/09) annotated with 🔵 Planned markers on 2026-05-24 — drift between target design and MVP surface is now explicit in-doc.
  Gap B — CLOSED 2026-05-27 (commit `968b142`): UC-022 SOFT lock acquisition now preserves existing locks, emits a SOFT_LOCK_COEXISTS warning naming active holders, allows multiple session-held SOFT locks to appear in `who`, and keeps single-lock callers pointed at the strongest lock. Verified by `apps/api/tests/e2e/UC-022.test.ts`, `apps/api/tests/unit/application/locks-edge.test.ts`, `apps/api/tests/unit/memory-lock-store.test.ts`, `pnpm exec vitest run apps/api/tests`, `bash scripts/check-db-consistency.sh`, `bash scripts/check-persistence.sh`, and `bash scripts/completion-check.sh`.
related:
  - docs/06-api-contract.md
  - docs/07-cli-spec.md
  - docs/08-file-format.md
  - docs/09-bootstrap.md
  - docs/05-data-model.md
---

# Spec ↔ implementation audit (docs vs apps)

## TL;DR

Product behavior (UC-001–035) is faithfully implemented and tested — 27/35
fully, 8 partial. The drift is almost entirely in the **cross-cutting reference
docs** (API contract, CLI spec, file format, bootstrap), which describe a larger
or older target design than the 5/30 MVP ships. This is "docs ahead of code,"
not "code violating spec." Those docs are now annotated with `🔵 Planned`.
Three items are genuine code gaps (A/B/C below).

## Method

Seven parallel read-only audits on 2026-05-24: API contract, CLI spec, data
model, file-format+bootstrap, and UC-001–012 / 013–024 / 025–035. Each compared
spec text against `apps/api/src/**`, `apps/cli/src/**`, Prisma schema, and the
`apps/{api,cli}/tests/e2e*` suites.

## Use cases — 🟢 faithful

27/35 fully implemented with API e2e tests covering main + every documented
extension by ID. 8 partial:

| UC                   | Gap                                                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UC-003 invite        | Email send is simulated via `delivery_status` flag (`apps/api/src/application/invitations.ts:102`), no real email port. Acceptable for MVP.                                                                                     |
| UC-013 edit-step     | **`actor_id` editing unimplemented** — see code gap **A**.                                                                                                                                                                      |
| UC-014 search        | Full-text `q` matches `title` only, not `trigger` (`apps/api/src/http/usecase-search-routes.ts:124`); `trigger_excerpt` hardcoded `""` (`usecase-search-results.ts:12`). No `--include-archived`.                               |
| UC-016 start-session | `--auto-branch` never creates SEMANTIC locks — see code gap **C**.                                                                                                                                                              |
| UC-022 lock          | SOFT lock semantics incomplete — see code gap **B**.                                                                                                                                                                            |
| UC-029 sync          | No CLI `.vspec/cache/pending-push.json` queue; `revision:` write-back non-atomic (`apps/cli/src/commands/sync-files.ts:7`).                                                                                                     |
| UC-030/031 export    | CLI write non-atomic (no temp-and-rename, `apps/cli/src/commands/export.ts:141`); overwrite-protection (6a/6b) only works because tests pass `existing_file_content` to the server — the real CLI never reads the on-disk file. |
| UC-033 ai-learn      | CLI is a thin network pass-through; no local `~/.vspec/cache/ai-guide-<version>`, so the documented offline-tolerance guarantee can't be met by the shipping CLI.                                                               |

Recurring theme behind 029/030/031/033: **client-side filesystem guarantees are
documented and server-simulated in tests, but not wired into the actual CLI.**

## Cross-cutting reference docs — 🔴 drift (now annotated 🔵 Planned)

### 06 API contract

- ❌ Unimplemented endpoints (now 🔵 Planned): workspace CRUD (`POST/GET/GET:id/PATCH:id /v1/workspaces`, L67–78); `GET /v1/projects/:id` (L91); `GET /v1/usecases/:id/scenarios` (L202); `PATCH/DELETE /v1/scenarios/:id` (L204–206); `DELETE /v1/steps/:id` (L216); `GET /v1/revisions/:id` (L224); `GET /v1/sessions/:id`, `POST .../abandon`, `POST .../pin` (L259–273); `GET /v1/projects/:projectId/branches`, `GET /v1/branches/:id`, `POST /v1/branches/:id/preview-merge` (L285–289); `POST /v1/merges/:id/approve`, `.../abort` (L308–310); `GET /v1/locks`, `DELETE /v1/locks/:id` (L322–324); `GET /v1/openapi.json` (L433).
- ⚠️ Divergent (implemented, different shape): RFC 7807 `type` always `.../bad-request` + no `detail`/`instance` (`signup-support.ts:253`); `X-Vspec-Request-Id` never set on responses; no 429/rate-limiting; field renames (`primary_actor` vs `_id`, step `actor` vs `actor_id`, session `pins`/`no_merge` vs `pin_usecase_keys`/`merge`); impact response missing `severity`/`expires_at`; actors/stakeholders PATCH/DELETE nested under `/v1/projects/:projectId/...` instead of top-level.
- ➕ Undocumented (implemented): device-flow token, `GET/POST /v1/projects`, `GET /v1/doctor`, `POST /v1/ai-guide`, `/__test/...` harness routes.

### 07 CLI spec

- Package name: spec `@vooster/vspec-cli` vs actual `@vooster/cli`.
- ❌ 40+ unimplemented subcommands (now 🔵 Planned): `unlock`; `workspace create/list`; `project show`; `scenario list/edit/delete`; `step move/delete`; `session show/pin/unpin/abandon`; `branch list/checkout/diff/delete`; `merge preview/list/show/approve/abort`; `lock list`; `member list/set-role/remove`; `export project`; `help <command>`.
- ⚠️ Global flags `--profile/--project/--session/--branch/--quiet/--no-color` declared but not wired; real context flags are `--api-url/--project-id/--session-cookie/--workspace-id` (`apps/cli/src/flag-values.ts:26`). Self-teaching UX (emoji hints / soft-warning panels / rich `status`) and stable exit codes 3/4/5 are unimplemented outside `init`.

### 08 file format

- ❌ Unimplemented (now 🔵 Planned): round-trip parser (`gray-matter`/`marked` in deps but never imported in `apps/*/src`); all parsing rules; offline `vspec doctor <path>` (real impl calls remote `GET /v1/doctor`); actor/stakeholder/goal markdown files (only usecases produced).
- ⚠️ Layout differs: spec `specs/{actors,stakeholders,goals,usecases}/UC-NNN-<slug>.md` + `.vspec/{config,session,cache}` → actual flat `specs/<KEY>.md` + `.vspec/sync-state.json`; frontmatter `id` carries UUID (spec shows `UC-NNN`).

### 09 bootstrap

- Describes a **single-package** repo (`src/`, root `prisma/`, `@vooster/vspec-cli`, `bin`) → actual is a **pnpm monorepo** (`apps/{api,cli,www}`). Layout, `package.json`, and `prisma/` path contracts no longer hold. Now flagged 🔵 Planned/superseded at the top of the doc. CLI `vspec init` command itself is not described in doc 09.

### 05 data model — 🟡 (not Planned-marked; divergence, not unimplemented)

- Deliberate MVP pattern: Prisma stores all `Json`/`String[]`/enum as `String` (schema.prisma:18) — not noted in spec.
- Domain-type drift worth tracking: `Revision.entity_type` enum 4 of 7 values (`apps/api/src/domain/entities/revision.ts:8`, missing SCENARIO/STEP/STAKEHOLDER_INTEREST), missing `content_hash`/`author_id`; `MergeRequest.status` introduces `CLOSED`, drops APPROVED/REJECTED/ABORTED; `Lock.target_type` 1 of 3 values + duplicate `holder`/`mode`/`usecase_id`. Undocumented entities `ApiKey`, `Invitation`.

## Code gaps (genuine, spec-worthy) — CLOSED

These three were real behavior gaps where the spec was right and the code was
incomplete at audit time; all are now closed.

**A — UC-013 step `actor_id` editing — MEDIUM.**
`stepPatchSchema` accepts only `action/base_revision/force/notes`
(`apps/api/src/http/step-routes.ts:18`); `editStep` mutates only `action/notes`
(`apps/api/src/application/step-editing.ts:96`); CLI declares an `actor` flag but
never sends it (`apps/cli/src/commands/step.ts`). Fix threads an `ActorStore`
into `editStep` to resolve actor name → id (mirror the step-add path), adds an
`UNKNOWN_ACTOR` result, sets BREAKING severity on actor change, wires the CLI
body, and adds tests. ~4 source files + 2 test files; localized.

**B — UC-022 SOFT lock semantics — CLOSED 2026-05-27 (commit `968b142`).**
Spec: "SOFT always succeeds but emits a warning if any other lock exists."
`blockingLock` already never blocks SOFT (`locks.ts:121`), but `acquireLock`
deletes any existing lock before saving (`locks.ts:~55-66`), so a SOFT acquire
silently destroys another holder's lock instead of coexisting + warning.

Re-scoped MEDIUM (not LARGE): the lock-store port **already exposes
`listLocksForUseCase` (array) and `listLocksHeldBySession`**
(`apps/api/src/ports/lock-store.ts`), so the multi-lock read path exists — the
remaining work is the schema uniqueness, the SOFT acquire path, and caller
tolerance.

### Decisions locked (user-approved 2026-05-27)

- **D1 — coexistence.** Multiple SOFT locks may coexist on the same target,
  **one per holder**. HARD stays exclusive; SEMANTIC behavior unchanged.
- **D2 — SOFT acquire is spec-faithful (refined from the brief's matrix).**
  A SOFT acquire **always succeeds** and **never deletes** an existing lock.
  If any other lock exists on the target, the result carries a **warning
  naming the existing holder(s)**. HARD/SEMANTIC acquires keep their current
  `blockingLock` behavior unchanged. _(This matches the cited spec — "SOFT
  always succeeds but warns" — and is simpler/safer than rejecting SOFT when a
  HARD exists, which the spec does not say.)_
- **D3 — schema.** Change the Prisma
  `@@unique([target_type, target_id, lock_type])` (`schema.prisma:344`) to key
  on the holder as well so multiple SOFT locks coexist — recommended
  `@@unique([target_type, target_id, lock_type, held_by_user_id])` (confirm the
  actual holder column; domain `Lock` carries `held_by_user_id`). This still
  prevents one holder from double-locking the same target+type.
- **D4 — port & callers.** Use the existing `listLocksForUseCase` instead of
  `findLockForUseCase` on the SOFT path. In `acquireLock`, drop the
  delete-before-save for SOFT; save the new SOFT lock and collect any existing
  locks into the warning. Audit callers (`step-editing`, `work-session-start`,
  `who-is-working`, `session-completion`) to tolerate a **list** of SOFT locks
  rather than assuming one.

### Build spec (decision-free; mechanical TDD)

1. RED: extend `apps/api/tests/e2e/UC-022.test.ts` (or the locks integration
   test) with: actor A SOFT-locks UC-X → success, no warning. Actor B
   SOFT-locks UC-X → success **+ warning naming A**; **both** locks persist
   (regression against the silent-delete bug); `who` reports both A and B as
   SOFT holders of UC-X.
2. GREEN: D3 migration → D4 `acquireLock` SOFT path → caller tolerance.
3. REFACTOR: dedupe the existing-holder lookup; keep HARD/SEMANTIC paths byte-
   for-byte unchanged.

When A, B, and C are all green, flip this finding's status_notes Gap B line to
CLOSED; per the Acceptance signal below, the snapshot's `resolved` may flip to
`true` (A/C already closed).

**C — UC-016 auto-branch SEMANTIC locks — SMALL.**
Success Guarantee: `--auto-branch` creates one SEMANTIC `Lock` per pinned use
case. `createAutoBranch` writes only the branch (`work-session-start.ts:212`);
the semantic-conflict check exists but no lock is ever created. Fix adds a lock
per pinned usecase (session-held) after branch creation; release already exists
on session complete (UC-018 tested). Localized to `work-session-start.ts` +
tests.

## Acceptance signal

- Docs: `grep -c '🔵 Planned' docs/06-api-contract.md docs/07-cli-spec.md docs/08-file-format.md docs/09-bootstrap.md` is non-zero for each.
- Gap A: a UC-013 e2e case asserting an actor change produces a BREAKING revision and rejects an unknown actor.
- Gap C: a UC-016 e2e case asserting `--auto-branch` over N pins creates N SEMANTIC locks held by the session.
- Gap B: a UC-022 e2e case asserts SOFT locks coexist, the second acquire warns about the first holder, and `who` reports both SOFT holders.

## Resolution

- `0ab6b0d` closed Gap A: UC-013 step actor editing.
- `632df72` closed Gap C: UC-016 auto-branch SEMANTIC locks.
- `968b142` closed Gap B: UC-022 SOFT lock coexistence and warning semantics.
  The implementation uses `listLocksForUseCase` on acquire, preserves existing
  SOFT locks, emits `SOFT_LOCK_COEXISTS`, updates the Prisma uniqueness key to
  include the session/user holder columns, and makes single-lock store lookups
  prefer stronger locks so legacy callers do not miss HARD/SEMANTIC blockers.

---

# Appendix — full divergence enumeration

The summary above lists what is **unimplemented** (now `🔵 Planned`). This
appendix preserves the complete long-tail of `⚠️ DIVERGENT` (implemented, but
shape differs from spec) and `➕ UNDOCUMENTED` (implemented, not in spec) items
from the 2026-05-24 audit, with file:line evidence, so they survive past the
volatile agent reports.

## A1. 06 API contract — divergent shapes

Cross-cutting:

- **RFC 7807**: `problem()` (`apps/api/src/http/signup-support.ts:253`) always emits `type: "https://vspec.dev/errors/bad-request"` regardless of status (spec promises status-specific URIs like `.../errors/conflict`); omits `detail` and `instance`. Affects every error response.
- **`X-Vspec-Request-Id`**: never set on responses; only read inbound (`apps/api/src/http/usecase-agent-routes.ts:104`). Spec L12 says "All responses include".
- **429 / rate limiting**: absent everywhere (spec L414).

Per-endpoint:

- **Actors/Stakeholders PATCH/DELETE**: spec top-level `/v1/actors/:id`, `/v1/stakeholders/:id` (L109-111, L123-125) → impl nests under project: `apps/api/src/http/actor-routes.ts:45,48`, `stakeholder-routes.ts:54,57`. Actor create adds `aliases`/`description` (`actor-routes.ts:19`).
- **UseCase create** (L149-166 vs `usecase-routes.ts:21`): field is `primary_actor` (name) not `primary_actor_id`; `trigger`/`preconditions`/`success_guarantee`/`minimal_guarantee`/`format` NOT accepted; adds `force`, `simulate_key_collision_once`.
- **UseCase PATCH** (L176-178): `usecase-update-routes.ts:16` accepts only `{status, archived_at: null}` — `base_revision` neither required nor accepted.
- **Goal PATCH** (L139): `goal-routes.ts` accepts only `status`.
- **Scenario create** (L196-199): `parent_step_number` not accepted; schema is `{type, extension_point, condition, outcome}` (`scenario-routes.ts:23`).
- **Step create** (L208-212): impl `POST /v1/scenarios/:id/steps` uses `{actor (name), action, force}` — no `step_number`, no `is_system_step`, `actor_id`→`actor` (`scenario-routes.ts:29`).
- **Stakeholder-interest add** (L184-188): impl uses `stakeholder` (name) not `stakeholder_id` (`stakeholder-interest-routes.ts:21`); DELETE param `:stakeholderInterestId` vs spec `:siId` (L190).
- **Session create** (L242-255): impl uses `pins` (required, min 1) not `pin_usecase_keys`; agent identifier from `X-Vspec-Agent` header, no `agent_identifier` body (`session-routes.ts:24`).
- **Session list** (L257): impl additionally **requires** `workspace_id` (`session-list-routes.ts:19`).
- **Session complete** (L261-265): impl uses `{summary, no_merge}` not `{summary, merge}` (`session-complete-routes.ts:15`).
- **Branch create** (L279-282): impl drops `owner_type` (`branch-routes.ts:16`).
- **Merge open** (L296-300): impl uses `target: z.literal("main")` not `target_branch_id`; strategy enum `FAST_FORWARD|SQUASH` (`merge-routes.ts:16`).
- **Merge resolve** (L302-306): resolution objects use `field`; request adds **required** `base_revision` not in spec (`merge-resolve-routes.ts:15`).
- **Lock create** (L319): impl enum `SOFT|SEMANTIC|HARD`; `target_type` locked to `z.literal("USECASE")` (`lock-routes.ts:15`).
- **Impact preview** (L334-343): request uses `proposed_change_content`/`proposed_change_path` not `changes:{fields,scenarios}` (`impact-routes.ts:19`); response `{preview_id, impact, cached, suggested_next_actions}` — **missing `severity` and `expires_at`** (`impact-results.ts:19`).
- **Revision history** (L222): impl supports `project_id` + `limit`; no `branch`, no `cursor` pagination (`revision-history-routes.ts:13`).
- **UseCase diff** (L234): impl makes `from` AND `to` **required** (`min(1)`), adds undocumented `format` query (`revision-diff-routes.ts:17`).
- **API key create** (L48-53): request adds **required** `workspace_id`; response `{api_key, plaintext_token}` not `{id, name, token}` (`api-key-results.ts:14`); list returns `{api_keys}` not `{items}`.
- **Gherkin export** (L356): impl ignores `?format=feature` query (`gherkin-export-routes.ts`); `text/plain` matches.
- **Status codes**: spec table (L401-415) lists 429 (unused); impl uses **410 Gone** (change-commit expiry `change-commit-routes.ts:73`, invitation-accept expiry `invitation-routes.ts:91`) and **503** (api-key `TOKEN_NOT_DELIVERED` `api-key-results.ts:26`) — neither in the table.

### A1b. 06 — undocumented endpoints (implemented, not in spec)

`POST /v1/auth/github/token` (`auth-device-routes.ts:34`); `GET /v1/projects` (`project-routes.ts:36`); `POST /v1/projects` (`:37`); `DELETE /v1/projects/:projectId` (`:46`); `GET /v1/projects/:projectId/actors/:actorId` (`actor-routes.ts:39`); `GET /v1/projects/:projectId/stakeholders/:stakeholderId` (`stakeholder-routes.ts:39`); `GET /v1/goals/:goalId` (`goal-routes.ts:54`); `POST /v1/locks/:lockId/renew` (`lock-routes.ts:36`); `GET /v1/sessions/watch` SSE (`session-list-routes.ts:57`); `POST /v1/invitations/:token/accept` (`invitation-routes.ts:37`); `GET /v1/doctor` (`doctor-routes.ts:37`); `POST /v1/ai-guide` (`ai-guide-routes.ts:22`); `/__test/...` harness routes.

## A2. 07 CLI spec — divergent shapes

- **Package**: `@vooster/cli` not `@vooster/vspec-cli` (`apps/cli/package.json:2`).
- **Global flags**: `--profile`/`--quiet`/`--no-color` not declared at all; `--project`/`--session`/`--branch` declared but not consumed. Real context resolution (`apps/cli/src/flag-values.ts:3,26-48`) uses only `api-url`, `project-id`, `session-cookie`, `workspace-id`.
- **Actors**: `create` **requires** `--type` (`actor-flags.ts:43`); no `--human` flag (`is_human:true` hardcoded `actor.ts:155`); show/edit/archive treat positional as id only (`actor.ts:93,110,133`); alias edit uses `--aliases` CSV not `--add-alias`.
- **Stakeholders**: `create` **requires** `--type` (`stakeholder-flags.ts:42`); show/edit/archive id-only.
- **Goals**: requires `--actor-id` not `--actor`; **requires** `--level` and `--priority` (`goal-flags.ts:55-56`); `goal list` supports `--actor-id` only, no `--status` (`goal.ts:153-176`).
- **Use Cases**: `create` ignores `--level`, no `--from` (`usecase.ts:152-166`); `usecase set` allows only `--field status` (`usecase-flags.ts:144-147`); show id-only.
- **Scenarios**: `scenario add` **requires** `--condition` AND `--at` for extension (`scenario.ts:194,201`).
- **Steps**: `step edit` **requires** `--action` and `--base-revision` (`step.ts:225-227`).
- **Sessions**: `session start` **requires** `--pin` (`session-flags.ts:58`); `session list` has no `--mine`/`--workspace`, requires `workspace-id` context (`session-flags.ts:64-72`); hardcoded header `X-Vspec-Agent: "codex-cli"` regardless of `--agent-type` (`session.ts:98`).
- **Merges**: `merge open` takes a branch **ID** positional (`merge.ts:191`); `merge resolve` **requires** `--base-revision`, `--entity-id`, `--field`, and a required `--strategy` (`merge.ts:200-210`).
- **Doctor**: uses `--usecase` flag not a positional (`doctor.ts:31,76`); raw JSON output (`doctor.ts:67`), not the emoji checklist.
- **ai-guide**: supports `--format json|markdown` only (not human|json|agent).
- **Exit codes**: only `init` sets 2/6 (`init.ts:78,123,172,184`); all others throw generic `Error` → exit 1. Documented stable 3/4/5 unimplemented outside `init`.

### A2b. 07 — undocumented flags (implemented, not in spec)

`login --workspace-name/--workspace-slug` (`login.ts:48-51,128-137`); `project create --visibility` (`project.ts:74,216`); `session start --branch-name/--workspace-id` (`session.ts:30-41`); `merge resolve --entity-id/--field/--value/--base-revision` (`merge.ts:60-66`); `usecase --cursor/--protection-mechanism` (`usecase.ts:47,56`); `export --revision/--force` (`export.ts:36-38`); universal `--api-url/--session-cookie/--project-id/--workspace-id/--root/--dry-run` on most commands; `ai-guide --format json` + `--api-url`.

## A3. 08 file format — divergent shapes & undocumented

Divergent:

- **Directory layout**: flat `specs/<KEY>.md` (`apps/api/src/http/sync-files.ts:296`), no `actors/`/`stakeholders/`/`goals/` subtrees, no actor/stakeholder/goal files emitted.
- **`.vspec/`**: only `sync-state.json` (`{"cursor":""}`) on disk; `config.json` created by CLI; no `session.json`/`cache/`.
- **`id` frontmatter**: emits internal UUID, human id in `key` (`markdown-renderer.ts:53`).
- **Filename**: `<key>.md`, no slug, not `UC-NNN-<slug>.md` (`sync-files.ts:296`).
- **Extension outcome line**: ASCII hyphen + hardcoded `use case ends.` suffix regardless of outcome (`markdown-renderer.ts:142`); spec uses em-dash + per-outcome suffix.
- **Conflict marker trailer**: only `>>>>>>> remote (${current_revision_id})` — no author/timestamp (`sync-files.ts:261`).
- **`primary_actor`** omitted from conflict/sync-stub frontmatter (`sync-files.ts:292`, `sync-markdown.ts:45`); **`frequency`** never emitted.
- **`vspec sync`**: `runSync` only branches push/pull (default pull); no combined sync, no refuse-on-markers (`apps/cli/src/commands/sync.ts:88-94`).

Undocumented:

- Full **Gherkin export** format (`gherkin-export.ts`, `gherkin-renderer.ts`, `export.ts:71-86`) — doc 08 has no `Feature:` format.
- Push response `dry_run`, `impact:{entity_id, severity}`, `SyncCacheEntry[]`, `suggestedNextActions` (`sync-files.ts:25-59,114-127,236-248`).
- `simulate_network_failure` flag (`sync-files.ts:104-112`, `sync-routes.ts:138`).

## A4. 09 bootstrap — divergent (superseded by monorepo)

- No root `src/`/`tests/`; code under `apps/api/src`, `apps/cli/src`; tests under `apps/api/tests`.
- Prisma at `apps/api/prisma/schema.prisma`, no root `prisma/`.
- Root `package.json` name `vooster`, no `bin`, scripts differ (`dev` targets `apps/api/src/index.ts`; no `dogfood`/`prisma:*`/`start:*`).
- `tsconfig` `build` emits via plain `tsc` (no `tsconfig.build.json` flow as specified).
- CLI `vspec init` (binds repo to project, writes `.vspec/config.json`) is undocumented in doc 09.
- Third app `@vooster/www` (Astro) not in doc 09 layout.

## A5. 05 data model — full divergence

Prisma `String` substitutions (deliberate MVP pattern, undocumented in spec): `Workspace.settings` (schema:52), `Actor.aliases` (:110), `UseCase.preconditions` (:164), `Revision.snapshot` (:241), `SpecBranch.base_revision_ids`/`head_revision_ids` (:267-268), `MergeRequest.impact`/`conflicts` (:294-295), `WorkSession.pinned_revisions` (:314), and all enum fields.

Domain-type drift (entity files under `apps/api/src/domain/entities/`):

- **Workspace**: `archived_at` undocumented (schema:53, `workspace.ts:7`); domain omits `settings`/`created_at`/`updated_at`.
- **Project**: `default_branch_id` non-null in `project.ts:7` vs nullable spec/Prisma (schema:83); omits `description`/`created_at`/`updated_at`.
- **User**: `name`/`avatar_url` non-null (`user.ts:5-6`) vs nullable (schema:30-31); omits `created_at`.
- **Actor**: `description` non-null (`actor.ts:6`) vs nullable (schema:108).
- **Stakeholder**: `description` non-null (`stakeholder.ts:6`) vs nullable (schema:127).
- **UseCase**: omits `format`/`trigger`/`preconditions`/`success_guarantee`/`minimal_guarantee`/`frequency` (Prisma:160-167); `format:"BRIEF"` only (`use-case.ts:7`) vs 3 values; `status:"DRAFT"` only (`:11`) vs 4; `current_revision_id` spec-required vs Prisma-nullable (schema:170); Prisma `format @default("FULLY_DRESSED")` (:160).
- **StakeholderInterest**: `protection_mechanism` non-null (`stakeholder-interest.ts:6`) vs nullable (schema:225).
- **Revision**: `severity` undocumented (schema:245, `revision.ts:15`); `entity_type` enum 4 of 7 (`revision.ts:8`, missing SCENARIO/STEP/STAKEHOLDER_INTEREST); omits `content_hash`/`author_id` (Prisma:239,243); `branch_id` required spec/Prisma (schema:238) vs optional domain (`revision.ts:13`).
- **SpecBranch**: omits `purpose` (spec L226)/`created_at`; `status` optional (`spec-branch.ts:11`) vs required.
- **MergeRequest**: omits `reviewed_by`/`created_at` (Prisma:297-298); status `CLOSED|MERGED|OPEN` (`merge-request.ts:12`) vs `OPEN|APPROVED|REJECTED|MERGED|ABORTED`; `source_branch_id` required spec/Prisma (:290) vs nullable domain (`merge-request.ts:11`); `current_revision_id` undocumented (`:4`); `created_by` optional in domain.
- **WorkSession**: `last_activity_at` undocumented (schema:318, `work-session.ts:16`); `pinned_revision_id` (`:17`) + `usecase_id` (`:22`) undocumented.
- **Lock**: `target_type` 1 of 3 (`lock.ts:13`); `holder`/`mode`/`usecase_id` undocumented duplicates of `held_by_user_id`/`lock_type`/`target_id` (`lock.ts:7,10,14`); Prisma `@@unique([target_type,target_id,lock_type])` (schema:344).
- **Comment**: `updated_at` undocumented (schema:361, `comment.ts:11`); Prisma `@@index([target_type,target_id])` (:366).

Undocumented entities (not in the 16-entity index):

- **ApiKey** (schema:373-389 + `api-key.ts`). Internal mismatch: Prisma `user_id`/`key_hash`/`expires_at`/`last_used_at` vs domain `created_by`/`token_hash` and no expiry fields.
- **Invitation** (`invitation.ts`, domain only — no Prisma model): `delivery_status`/`token`/`expires_at`/`accepted_at`/`role`.
