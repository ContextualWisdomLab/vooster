# Test Plan

_Append a section per UC before starting it. One bullet per test you intend to
write. This guides your TDD cycles within an iteration._

## Example

### UC-009

- **MAIN**: POST a valid use case → 201 with `key`, body matches input.
- **3a**: title is empty → 400, message includes "title".
- **5a**: primary_actor does not exist → 422.
- **7a**: title is duplicate → 422 with current UC's key in body.

### UC-001

- **MAIN**: complete GitHub signup callback with a desired workspace name/slug -> 201, sets a session cookie, returns user, workspace, OWNER membership, and `vspec project create`.
- **2a**: callback contains `error=access_denied` -> 400, clears OAuth state cookie, suggests `vspec login`, and leaves no account rows.
- **4a**: GitHub profile has no verified primary email -> 422, instructs the user to verify GitHub email, and leaves no user row.
- **6a**: requested workspace slug already exists -> 422, returns a suggested alternative slug, and rolls back user/workspace/membership creation.
- ***a**: GitHub token/profile/email fetch fails -> 502 with retry guidance and no partial state.

### UC-002

- **MAIN**: existing signed-up GitHub user completes login -> 200, sets a fresh session cookie, updates `last_login_at`, and returns memberships/workspaces.
- **4a**: GitHub identity has no existing vspec user -> 404, suggests signup via `vspec login`, and does not create a user or session.
- **3a**: callback contains `error=access_denied` during login -> 401, clears OAuth state cookie, and returns retry guidance.
- **6a**: existing user has zero workspace memberships -> 200 with `workspaces: []` and recommended next command `vspec workspace create`.
- ***a**: GitHub API is unreachable during login -> 502 with retry guidance and no session cookie.

### UC-004

- **MAIN**: authenticated workspace member posts valid project name/key/visibility -> 201 with project, `main` default branch owned by requester, and recommendation to create actors.
- **2a**: authenticated user who is not a workspace member posts to the workspace -> 403 with invitation guidance and no project.
- **3a**: key fails `^[A-Z][A-Z0-9]{1,7}$` -> 400 with regex and three example keys.
- **3b**: key already exists in the workspace -> 422 listing the existing project and suggesting `vspec project show <KEY>`.
- **6a**: branch insertion fails after project insert -> 500 with request id and no orphan project or branch.
- ***a**: workspace is archived before commit -> failure response and no project/branch.

### UC-005

- **MAIN**: authenticated project member posts valid actor data -> 201 with actor, aliases, revision version 1, and recommendation for stakeholders/goals.
- **3a**: non-archived actor name already exists in project -> 422 referencing existing actor id and suggesting edit/add-alias.
- **3b**: archived actor name already exists -> 409 suggesting actor restore or a different name.
- **4a**: invalid actor type -> 400 listing PRIMARY, SUPPORTING, and OFFSTAGE.
- **1a**: name `System` collides with canonical System actor -> 422 pointing to `vspec actor show System`.
- ***a**: read-only access -> 403 with contact-owner guidance and no actor/revision.

### UC-006

- **MAIN**: authenticated project member posts valid stakeholder data -> 201 with stakeholder, revision version 1, and recommendation to add stakeholder interests.
- **3a**: non-archived stakeholder name already exists in project -> 422 referencing existing stakeholder id and suggesting edit.
- **4a**: invalid stakeholder type -> 400 listing INTERNAL, EXTERNAL, and REGULATORY.
- **1a**: request attempts to attach a stakeholder to a step -> 400 explaining actors do and stakeholders care, suggesting actor creation.
- ***a**: project is archived before insert -> failure response and no stakeholder/revision.

### UC-007

- **MAIN**: authenticated project member creates a goal for an existing actor, then lists goals grouped by that actor with the initial revision.
- **3a**: referenced actor is missing or archived -> 422 naming the actor and suggesting actor list/create.
- **5a**: description is blank or whitespace -> 400 explaining goal descriptions must be verb phrases.
- **5b**: illegal status transition -> 422 listing the allowed transitions and leaves status unchanged.
- **6a**: rejecting a promoted goal -> 422 explaining the linked use case must be archived first.
- **6b**: near-duplicate goal for same actor -> still creates the goal with duplicate warning and `vspec goal show`.
- ***a**: project is archived before a mutating goal operation -> 409 and no goal/revision.

### UC-008

- **MAIN**: promote an identified goal -> creates a seeded BRIEF use case with first revision, updates the goal to PROMOTED, and returns next actions.
- **2a**: promote a goal that is already linked -> 409 pointing at the existing use case key.
- **2b**: promote a rejected goal -> failure with `vspec goal edit <id> --status in-design` guidance and no use case.
- **4a**: promoted title fails the verb-phrase heuristic -> still creates the use case with a title-edit warning.
- ***a**: simulated server error during use-case creation -> aborts without mutating goal or leaving a use case/revision.

### UC-009

- **MAIN**: authenticated member creates a use case from title and primary actor name -> 201 with defaults, sequential key, current revision, and authoring next actions.
- **2a**: non-verb title without force -> failure with rewrite suggestions and `--force`; with force -> creates the use case.
- **3b**: unknown primary actor -> 422 with actor list/create guidance and no use case.
- **5c**: simulated key collision -> retries allocation and succeeds with the next available key, or 409 after repeated failures.
- ***a**: unauthorized requester -> 403 with login/member role guidance and no use case/revision.

### UC-010

- **MAIN**: add a stakeholder interest to an existing use case -> creates the interest, appends a NON_BREAKING use case revision, returns updated stakeholder list and next missing role hint.
- **3a**: duplicate stakeholder interest -> 409 with existing interest text and edit guidance.
- **4a**: remove an existing stakeholder interest -> deletes it and appends a BREAKING use case revision.
- **5a**: removing the last interest -> succeeds with zero-interest warning and blocks later status transition out of DRAFT.
- ***a**: stakeholder name does not resolve -> failure with candidate names and stakeholder-create guidance.

### UC-011

- **MAIN**: create the MAIN_SUCCESS scenario, add two actor-named steps, and receive contiguous step numbers plus NON_BREAKING use case revisions.
- **2a**: creating a second MAIN_SUCCESS scenario -> 409 with the existing scenario id and scenario/step edit guidance.
- **3b**: empty step action -> 400 with no step; passive action -> 422 warning with active rewrite guidance; force -> persists the passive action.
- **5a**: step actor is unknown -> 422 listing known actors and `vspec actor create` guidance with no persisted step.
- **6a**: adding the tenth main step -> persists the step with an over-nine-steps warning.

### UC-012

- **MAIN**: add an EXTENSION scenario at an existing main step -> creates ordered extension with condition/outcome/parent step, appends NON_BREAKING use case revision, then accepts extension substeps.
- **2a**: invalid extension point syntax -> 400 with valid forms and examples, and no scenario/revision.
- **3b**: parent step number is out of range -> 422 with `vspec usecase show <KEY-NNN>` guidance and no scenario/revision.
- **4a**: extension point already exists -> 409 with existing condition and next free extension letter.
- **5a**: outcome omitted -> defaults to FAILURE and returns a warning to confirm or edit the outcome.

### UC-013

- **MAIN**: patch a step action with the current base revision -> updates the step, appends a BREAKING use case revision, and returns no affected sessions.
- **2a**: stale `base_revision` -> 409 with current revision id, structured diff, and `vspec usecase show <KEY-NNN>` guidance without changing the step.
- **3a**: empty action -> 400 with no write; passive action -> 422 with active rewrite guidance; force -> writes with BREAKING severity.
- **5a**: semantic lock by another holder -> notes-only edit succeeds as COSMETIC; action/actor change returns 409 with holder/reason/expires.
- **6a**: active sessions pinning this use case -> edit succeeds and returns affected session ids in the impact payload.
- ***a**: hard lock -> all edits return 409 with unlock/contact-holder guidance and no write.

### UC-014

- **MAIN**: authenticated member lists use cases with `q`, `status`, `level`, `actor_id`, `limit`, and `cursor` -> returns key-ordered previews, hides archived rows, and uses an opaque next cursor for the next page.
- **2a**: unknown `status` or `level` filter -> 400 listing valid values and no partial items.
- **2b**: `actor_id` does not resolve in the project -> 200 empty items with `vspec actor list` guidance.
- **4a**: malformed cursor -> 400 with the opaque-cursor message; cursor past the last row -> 200 empty page with `next_cursor: null`.
- ***a**: no rows match filters -> 200 empty items, `next_cursor: null`, and broadening-filter guidance.

### UC-015

- **MAIN**: authenticated writer archives an active use case -> sets `archived_at`, appends an archive revision, reports affected session/lock counts, and hides it from default UC-014 listing.
- **2a**: archive is requested for an already archived use case -> 409 with existing `archived_at`, restore guidance, and no new revision.
- **3a**: active sessions pin this use case -> archive still succeeds and response lists affected session ids while pinned reads remain possible.
- **3b**: active HARD lock exists -> archive returns 409 with holder/expires and leaves `archived_at` and revisions unchanged.
- ***a**: restore an archived use case -> clears `archived_at`, appends a restore revision, and re-includes it in default UC-014 listing.
- ***b**: hard delete flag is supplied -> 400 explaining destructive deletion is post-MVP and pointing to archive.

### UC-016

- **MAIN**: authenticated project member starts a work session with pinned use case keys -> creates an ACTIVE session with pinned current revisions, writes `.vspec/session.json` metadata, and returns show/complete next actions.
- **3a**: requested pin is archived -> 422 with offending key and `vspec usecase restore <KEY>` guidance, no session.
- **3b**: requested pin is HARD-locked by another session -> 409 with holding session and `vspec who <KEY>` guidance, no session.
- **4a**: auto-branch branch-name collision -> appends a suffix, creates one ACTIVE agent branch, and starts the session on that branch.
- **4b**: auto-branch semantic lock acquisition fails -> rolls back branch, locks, and session, then returns 409 naming the conflicting session.
- **2a**: unrecognized `agent_type` -> stores `OTHER`, preserves the raw label in `agent_identifier`, returns a warning, and still starts the session.
- ***a**: transactional write fails mid-creation -> leaves no session, branch, or lock and returns retry guidance.

### UC-017

- **MAIN**: workspace member lists active sessions by workspace -> rows sorted by newest start with user, agent, intent, pinned keys, branch name, idle age, lock count, conflict markers, and conflict summary.
- **2a**: caller without workspace membership -> 403 with `vspec workspace list` guidance and no session disclosure.
- **4a**: active session heartbeat older than 30 minutes -> row is marked `ZOMBIE` and suggests `vspec session abandon <id>` without mutating state.
- **3a**: no sessions match the filter -> returns `total: 0`, empty rows, and `vspec session start --intent "..."` guidance.
- ***a**: watch endpoint requested -> streams the same snapshot as Server-Sent Events without mutating session, branch, or lock state.

### UC-018

- **MAIN**: session owner completes an active auto-branch session -> marks it COMPLETED, stamps `ended_at`, releases held locks, opens one OPEN merge request with impact/conflicts, clears session file metadata, and suggests `vspec merge show <id>`.
- **4a**: one held lock is already gone during release -> session still completes, remaining locks release, and response includes one warning for the failed lock release.
- **6a**: branch has conflicts versus main -> opens an OPEN merge request with populated conflicts and suggests `vspec merge resolve <id>`.
- **6b**: `no_merge` requested -> completes the session and releases locks without merge request, leaves branch ACTIVE, and suggests `vspec merge open <branch>`.
- **2a**: session is already COMPLETED or ABANDONED -> 409 with current status and `vspec session show <id>` guidance, no state change.
- ***a**: simulated transactional failure mid-completion -> session remains ACTIVE, locks remain held, no merge request is created, and response gives retry guidance.

### UC-019

- **MAIN**: authenticated project member creates a branch from main -> ACTIVE HUMAN-owned branch with immutable `base_revision_ids`, matching `head_revision_ids`, unique name, and checkout/edit next actions.
- **2a**: caller lacks editor role -> 403 with `vspec member list` guidance and no branch.
- **3a**: requested base branch is not `main` -> 422 with single-level-branch rule and `--from main` guidance, no branch.
- **5a**: branch name collides in project -> 422 with a de-collided suggested name, no branch.
- **4a**: main has open merge requests targeting it -> still creates branch and returns warnings listing in-flight merge request ids.
- ***a**: simulated snapshot transaction failure -> no branch row persists and response includes exit code 5 with retry guidance.

### UC-020

- **MAIN**: authenticated project member opens a merge for an ACTIVE branch whose head differs from unchanged main -> creates an auditable MR, computes FAST_FORWARD impact, advances main head revisions, marks MR/source branch MERGED, and suggests `vspec merge show <id>`.
- **4a**: source and main changed the same use case field differently -> returns an OPEN MR with structural conflict descriptors, leaves main unchanged, and suggests `vspec merge resolve <id>`.
- **4b**: target use case is HARD-locked by another session -> returns 409 with holding session and `vspec who <KEY>` guidance, keeps the MR OPEN, and leaves main unchanged.
- **4c**: source and main both added different extensions at the same extension point -> returns an OPEN MR with semantic conflict descriptors and leaves main unchanged.
- **5a**: caller forces `FAST_FORWARD` after main advanced from the branch base -> 422 suggesting `vspec merge open <branch> --strategy squash`, aborts before write, and leaves main unchanged.
- ***a**: simulated write-phase failure -> returns exit code 5 with retry guidance, leaves MR OPEN, source branch ACTIVE, and main head revisions unchanged.

### UC-021

- **MAIN**: authenticated project member resolves every OPEN MR conflict with `THEIRS`/`MINE`/`MANUAL` and current `base_revision` -> writes resolved main revisions, advances main heads, marks MR/source branch MERGED, and suggests `vspec usecase show <KEY>`.
- **2a**: supplied `base_revision` is stale -> 409 with current MR revision, refreshed conflicts, `vspec merge show <id>` guidance, and no state change.
- **3a**: a `MANUAL` resolution omits `value` -> 400 naming the offending entity/field, `vspec merge show <id>` guidance, and no merge.
- **3b**: resolution list does not cover every conflict -> 422 listing uncovered conflict keys, full-resolution guidance, and MR unchanged.
- **5a**: a HARD lock is acquired on a touched entity after MR open -> 409 with holding session and `vspec who <KEY>` guidance, MR stays OPEN, and main unchanged.
- ***a**: simulated resolution write failure -> exit code 5 with retry guidance, MR stays OPEN, source branch ACTIVE, and main unchanged.

### UC-022

- **MAIN**: authenticated project member locks an existing use case with type/reason/TTL and session header -> returns a finite lock row with holder user/session, auto-release flag, and renew/unlock next actions.
- **3a**: another session holds an active equal-or-higher competing lock -> `SEMANTIC`/`HARD` requests return 409 with holder user/session, expiry, `vspec who <KEY>` guidance, and no new lock.
- **1a**: renewing an expired lock -> returns 409 with reacquire guidance and does not extend the expired row.
- **1b**: renewing a lock owned by another user/session -> returns 403 and leaves the existing lock unchanged.
- **5a**: completing a session that owns an auto-release lock -> deletes that lock in the same completion response.
- ***a**: an expired lock exists on the target -> a fresh lock acquisition treats it as absent and succeeds.

### UC-023

- **MAIN**: authenticated member asks who is working on a use case with one active session, one active lock, and one open MR touching it -> returns all three lists with session/lock/MR summaries and lock/MR next actions.
- **2a**: queried use case id/key does not exist in the project -> 404 with canonical key-format/search guidance and no state disclosure.
- **2b**: queried use case is archived -> still returns the bundle with `archived: true` and restore guidance when active work exists.
- **4a**: no sessions, locks, or open MRs touch the use case -> returns empty lists and session-start guidance for that key.
- **3a**: an active session in the bundle has stale heartbeat -> marks that session `ZOMBIE` and suggests `vspec session abandon <id>`.
- ***a**: caller lacks workspace membership -> 403 without revealing whether the use case exists.

### UC-024

- **MAIN**: authenticated member lists use case revision history -> returns newest-first revision rows with revision id, entity type/id, author, timestamp, change summary, and history follow-up actions.
- **2a**: use case id/key is not found in the current project -> 404 with searched project key and `vspec usecase list` guidance.
- **2b**: caller lacks workspace access -> 403 with login/member-role guidance and no history disclosure.
- **5a**: history count exceeds `limit` -> returns only the requested rows, `truncated: true`, suppressed row count, and larger-limit/cursor guidance.
- ***a**: simulated server error while reading history -> returns exit code 5 and retry guidance without mutating revisions.

### UC-025

- **MAIN**: authenticated member compares two use case revisions with `format=json` -> returns entity-aware changes with path, change type, severity, revision ids, and summary counts plus revert/impact/merge follow-up actions.
- **2a**: either requested revision id is absent for the use case -> 404 naming the missing revision and use case key, suggests `vspec history <KEY-NNN>`, and returns no diff.
- **3a**: compared revisions resolve to different branches -> still returns changes with `cross_branch: true`, a warning naming both branches, and branch labels on each change.
- **4a**: comparing byte-identical revisions -> returns an empty `changes` array, zeroed summary, and a human note that the revisions match byte-for-byte.
- ***a**: caller lacks workspace membership -> 403 without revealing whether the use case or revisions exist and returns no diff.

### UC-026

- **MAIN**: authenticated member reverts a use case to an earlier revision -> appends a new forward revision with `parent_revision_id` set to the prior head, restores the target snapshot, advances the use case current revision, returns impact and history/session next actions.
- **2a**: requested target revision is absent or belongs to another use case -> 404 with the missing revision, expected entity id, `vspec history <KEY-NNN>` guidance, and no appended revision.
- **3a**: another session holds a HARD lock on the use case -> 409 with holder, reason, expiry, `vspec who <KEY-NNN>` guidance, and no appended revision.
- **4a**: revert would reintroduce a BREAKING change without `force` -> 409 listing breaking changes and affected active sessions, suggests rerunning with `--force --summary`, and writes nothing.
- **5a**: revert changes downstream Gherkin export -> succeeds with a `GHERKIN_DRIFT` warning while still appending the revert revision.
- ***a**: simulated write failure during revert -> returns exit code 5 with retry guidance and leaves revision history/current head unchanged.

### UC-027

- **MAIN**: authenticated member previews impact for the current use case head -> returns deterministic `ChangeImpact` with severity, affected sessions/branches/tests, confidence 1.0, input hash, and lock/session/commit next actions without writing revisions.
- **3a**: proposed-change path is missing/unreadable -> 400 naming the path, suggests verifying it or rerunning without `--proposed-change`, and mutates nothing.
- **3b**: proposed-change content fails file-format parsing -> 400 with first parser error and `vspec doctor <file>` guidance.
- **6a**: active sessions pin the touched use case -> severity rolls up to BREAKING and affected sessions include id, owner, agent type, and pinned revision.
- **4a**: same input hash is previewed twice -> second response is byte-identical for impact fields and marks `cached: true`.
- ***a**: caller lacks workspace membership -> 403 without disclosing the use case or affected sessions.

### UC-028

- **MAIN**: authenticated member adds, lists, edits, resolves, and deletes own use-case comment -> comment payload preserves markdown body, authorship, timestamps, target metadata, and next actions.
- **3a**: add/edit receives empty or whitespace-only body -> 422 `empty_body` with `--body "<text>"` guidance and no comment mutation.
- **3b**: target use case is missing or archived -> 404 with requested key/id and `vspec usecase list` guidance.
- **4a**: resolving an already resolved comment -> returns existing payload without changing `resolved_at`.
- **4b**: deleting another user's comment -> 403 `not_owner`, preserves the comment.
- **5b**: editing another user's comment -> 403 `not_owner`, preserves the body.
- ***a**: simulated server write failure -> returns exit code 5 with retry guidance and no inserted/removed comment.

### UC-003

- **MAIN**: workspace owner invites an editor by email, invitee accepts with matching GitHub email -> creates a single-use invitation with 7-day expiry, then marks it accepted and creates EDITOR membership.
- **2a**: EDITOR member attempts to invite an OWNER -> 403 with `--role editor` guidance and no invitation.
- **3a**: invite email already belongs to an active workspace member -> 422 with `vspec member set-role` guidance and no invitation.
- **3b**: non-expired invitation already exists for the email -> returns the existing invitation/token and resend guidance without duplicating it.
- **5a**: simulated email delivery failure -> persists the invitation as `delivery_failed`, returns admin guidance to correct/reinvite or copy the acceptance link.
- **6a**: invitee accepts an expired token -> 410 with fresh-invite guidance, marks invitation expired, and creates no membership.
- **6b**: invitee authenticates with a different verified GitHub email -> 422 email mismatch, preserves pending invitation, and creates no membership.

### UC-029

- **MAIN**: authenticated member pulls and pushes one use case markdown file -> pull returns canonical content with revision frontmatter; push with matching `base_revision` appends a server revision, returns `OK`, fresh revision, refreshed cache entry, and suggested next actions.
- **3a**: malformed local markdown in a push batch -> returns 400 listing offending path and line, suggests `vspec doctor <path>`, and appends no server revisions.
- **4a**: pushed file base revision is stale -> returns per-file `CONFLICT` with current revision and impact, conflict-marker content, unresolved cache entry, and diff/push guidance.
- **1a**: dry-run push -> computes the same per-file summary without appending a revision or cache update.
- **4b**: simulated network failure on push -> queues pending push metadata in the response, leaves files/server unchanged, and suggests retrying `vspec push`.
- ***a**: caller lacks workspace access -> returns exit code 3 with login/API-key guidance and does not advance any file revision.

### UC-030

- **MAIN**: authenticated reader exports a use case with main and extension scenarios -> 200 `text/plain`, deterministic Gherkin with `Feature`, `Background`, main scenario first, extension scenario second, actor-keyed Given/When/Then steps, and test-runner next action.
- **3a**: use case has no main success scenario or has zero steps -> 422 naming the missing required field, suggests `vspec doctor <KEY>` and `vspec scenario add ... --type main-success`, and writes no export.
- **6a**: requested output directory is missing or not writable -> 400 with exit code 6, path guidance, and no export payload.
- **6b**: output file already exists without force -> refuses overwrite, returns proposed diff summary, suggests `--force` or alternate output, and does not mutate server revisions.
- **2a**: requested revision id is stale or unknown -> 404 with `vspec history <KEY>` guidance and no export payload.
- ***a**: target use case is archived -> failure with restore guidance and no export payload.

### UC-031

- **MAIN**: authenticated reader exports a fully-dressed use case to markdown -> `text/markdown` with canonical frontmatter including revision, ordered sections, stakeholder interests, scenarios/steps, stable extension ordering, and export next actions.
- **4a**: FULLY_DRESSED use case is missing required export data -> 422 naming the missing field, `vspec doctor <KEY-NNN>` guidance, and no markdown payload.
- **6a**: `existing_file_content` is supplied without force -> 409 with proposed diff, force/alternate-path guidance, and no overwrite payload.
- **6b**: output directory is simulated as not writable -> 400 with exit code 6 and path/permission guidance.
- **5a**: multiple extensions share one parent step -> markdown orders `1a` before `1b`, then any-step `*a`, and response marks round-trip self-check passed.
- ***a**: requested revision id is missing -> 404 with `vspec history <KEY-NNN>` guidance and no markdown payload.

### UC-032

- **MAIN**: workspace owner creates a read/write API key, sees plaintext token once, list returns metadata only, bearer auth succeeds before revocation, revoke sets `revoked_at`, and bearer auth fails afterward.
- **2a**: create request includes unsupported `admin` scope -> 422 with offending scope and allowed `{read, write}`, leaving no key.
- **5a**: caller simulates dropped create response -> persisted metadata remains listable without plaintext token, admin revokes it, and a fresh create returns a different token.
- **5b**: revoking an already-revoked key -> returns 200 with unchanged `revoked_at` and idempotent marker.
- **2b**: EDITOR member attempts API key create -> 403 with `vspec member set-role` owner guidance and no key.
- ***a**: revoke key id from another workspace -> 404 without leaking the other workspace key.

### UC-033

- **MAIN**: unauthenticated caller requests the AI guide for the current CLI version -> 200 markdown covering sessions, pin/fetch/propose/commit workflow, `--format=agent`, forbidden actions, worked example, cache metadata, and suggested next actions for login/project list/session start.
- **1a**: `format=json` -> returns the same guide as structured JSON with version, sections, examples, and machine-readable suggested next actions.
- **3a**: simulated network failure with only a previous-version cached guide -> returns stale guide with a prominent warning and retry guidance.
- **2a**: cached guide version differs from requested CLI version -> force-refreshes from server and returns current-version cache metadata rather than stale content.
- ***a**: simulated network failure with no cached guide -> returns exit code 5 and public guide URL bootstrap without partial guidance.

### UC-034

- **MAIN**: authenticated caller fetches `format=agent` for an active use case -> JSON envelope with structured use case data, scenarios, steps, stakeholder interests, primary actor, context project/branch/session/revision/request id, safe next actions, empty warnings, and `format_version: 1`.
- **3a**: requested revision is missing for this use case -> 404 with requested revision id and `vspec history <KEY>` guidance.
- **3b**: active owned session pins this use case and a conflicting revision flag is supplied -> response uses pinned revision and warns that the flag was overridden.
- **4a**: active owned session does not pin this use case -> falls back to revision/head, warns about unpinned concurrent-edit risk, and suggests `vspec session pin <KEY>`.
- **2a**: unauthenticated caller -> 401 with `vspec login` and API-key creation guidance.
- ***a**: use case is archived -> 404 with `vspec usecase list --status=` guidance and no structured data envelope.

### UC-035

- **MAIN**: authenticated writer proposes a title patch against the known `base_revision` -> persists a 15-minute `ChangePreview` with preview id, rendered diff, NON_BREAKING impact, commit guidance, and no new revision.
- **4a**: proposed `base_revision` is stale -> 409 with `current_revision`, impact since the base, re-read/re-propose guidance, and no preview.
- ***a**: commit references an expired preview -> 410 with `vspec change propose` guidance and no revision.
- **7a**: commit omits or references an unknown `preview_id` -> 400 explaining commits require a still-valid preview and suggesting propose.
- **7b**: `auto_commit` is set for a NON_BREAKING/BREAKING preview -> returns the preview plus human-review warning and does not append a revision.
- **6a**: proposed change touches revisions pinned by other active sessions -> preview impact lists session id, owner, agent type, and pinned use case keys, with `vspec who <KEY-NNN>` coordination guidance.
- **2a**: another session holds a HARD lock -> 409 with holding session, `vspec who <KEY-NNN>` and owner unlock guidance, and no preview.

### Goal 1 Bootable

- **MAIN**: `npm start` listens on `$PORT` (default 3000), serves `GET /healthz` as `200 {"status":"ok"}`, and exits cleanly on `SIGTERM`.

### Goal 1 Persistence

- **MAIN**: signup persists user/workspace/membership through Prisma so a restarted server rejects a second signup with the same workspace slug.

### Goal 1 CLI

- **SCAFFOLD**: `node bin/run.js --help` exits 0 through an oclif root command exposed by package `bin.vspec`.
- **UC-001 MAIN**: `vspec login --workspace-name <n> --workspace-slug <s>` calls the real API, completes stub GitHub signup, and prints the created workspace plus `vspec project create`.
- **UC-002 MAIN**: after signup, `vspec login --github-code <existing>` calls the real API login flow and prints the returning user plus workspace membership.
- **UC-003 MAIN**: after owner signup, `vspec member invite --email <addr> --role EDITOR` calls the real API and prints the pending invitation plus `vspec member list`.
- **UC-004 MAIN**: after signup, `vspec project create --name <n> --key <KEY>` calls the real API and prints the project, main branch, and `vspec actor define`.
- **UC-005 MAIN**: after project setup, `vspec actor create --name <n> --type PRIMARY` calls the real API and prints the actor, revision version, and `vspec stakeholder create`.
- **UC-006 MAIN**: after project setup, `vspec stakeholder create --name <n> --type INTERNAL` calls the real API and prints the stakeholder, revision version, and `vspec usecase add-stakeholder`.
- **UC-007 MAIN**: after project and actor setup, `vspec goal create --actor-id <id> --description <text>` calls the real API, prints the goal and revision, and `vspec goal list --actor-id <id>` prints the grouped actor goals.
- **UC-008 MAIN**: after project, actor, and goal setup, `vspec goal promote <goal-id>` calls the real API and prints the new use case key, seeded title, revision version, promoted goal status, and suggested next actions.
- **UC-009 MAIN**: after project and actor setup, `vspec usecase create --title <text> --primary-actor <name>` calls the real API and prints the new use case key, title, defaults, revision version, and suggested next actions.
- **UC-010 MAIN**: after project, actor, stakeholder, and use case setup, `vspec usecase add-stakeholder <usecase-id> --stakeholder <name> --interest <text>` calls the real API and prints the added interest, revision severity/version, updated stakeholder list, and missing-role hint.
- **UC-011 MAIN**: after a use case has a stakeholder interest, `vspec scenario add <usecase-id> --type main-success` creates the main scenario, then `vspec step add <scenario-id> --actor <name> --action <text>` appends a numbered step and prints the resulting scenario.
- **UC-012 MAIN**: after a use case has a main scenario step, `vspec scenario add <usecase-id> --type extension --at <point> --condition <text> --outcome <value>` creates the extension, then `vspec step add <scenario-id>` appends an extension substep.
- **UC-013 MAIN**: after a main step exists, `vspec step edit <step-id> --action <text> --base-revision <revision-id>` calls the real API and prints the updated step plus breaking revision metadata and affected sessions.
- **UC-014 MAIN**: after project setup with multiple use cases, `vspec usecase list --q <text> --status <status> --level <level> --actor-id <id> --limit <n>` calls the real API and prints matching previews plus the next cursor.
- **UC-015 MAIN**: after project and use case setup, `vspec usecase archive <usecase-id>` calls the real API, prints the archived use case key, archive timestamp, revision summary, affected counts, and default list no longer shows the use case.
- **UC-016 MAIN**: after project and use case setup, `vspec session start --intent <text> --pin <key> --agent-type CODEX` calls the real API, creates an active session for the pinned use case, and prints the session id, intent, agent identity, pinned revision count, session file path, and suggested next actions.
- **UC-017 MAIN**: after a workspace has an active pinned session, `vspec session list --workspace-id <id>` calls the real API and prints the session id, status, agent identity, intent, pinned keys, branch name, idle seconds, lock count, conflict marker count, and total summary.
- **UC-018 MAIN**: after an active branch-backed session holds a lock, `vspec session complete <session-id> --summary <text>` calls the real API, marks the session completed, prints the released lock id, merge request details, cleared session file, and suggested merge review command.
- **UC-019 MAIN**: after project and use case setup, `vspec branch create <name> --from main --project-id <id>` calls the real API, creates an active human branch with a base/head revision snapshot, and prints branch metadata plus checkout/edit next actions.
- **UC-020 MAIN**: after a branch has advanced from main, `vspec merge open <branch-id> --into main` calls the real API, fast-forwards the clean merge, and prints merge request status, strategy, conflict count, impact count, source branch status, and merge review next action.
- **UC-021 MAIN**: after a structural merge conflict is open, `vspec merge resolve <merge-id> --base-revision <id> --entity-id <usecase-id> --field title --strategy theirs` calls the real API, merges the MR, prints new revision and main head counts, source branch status, and use case review next action.
- **UC-022 MAIN**: after project and use case setup, `vspec lock <usecase-id> --type semantic --reason <text> --ttl <minutes> --session <id>` calls the real API, creates a finite semantic use case lock held by the session, and prints lock metadata plus renew/unlock next actions.
- **UC-023 MAIN**: after a use case has an active pinned session, semantic lock, and open merge request, `vspec who <usecase-id>` calls the real API and prints session, lock, merge request, and suggested coordination actions.
- **UC-024 MAIN**: after a use case has stakeholder, scenario, and step revisions, `vspec history <usecase-id> --limit <n>` calls the real API and prints use case identity, limit/truncation metadata, newest-first revision rows, and suggested review/diff actions.
- **UC-025 MAIN**: after a use case has two step revisions, `vspec diff <usecase-id> <from-revision> <to-revision> --format human` calls the real API and prints use case identity, revision pair, summary counts, structural change rows, and suggested revert/impact/merge actions.
- **UC-026 MAIN**: after a use case has advanced from its original revision, `vspec revert <usecase-id> --to <revision> --summary <text>` calls the real API, appends a forward revert revision, and prints restored use case state, revision metadata, impact, and history/session next actions.
- **UC-027 MAIN**: after a use case has a current head revision, `vspec impact <usecase-id>` resolves the latest revision through history, calls the real preview API, and prints preview id, cache status, severity, confidence, affected entities, input hash, and suggested lock/session/commit actions.
- **UC-028 MAIN**: after project and use case setup, `vspec comment add|list|edit|resolve|delete` calls the real comment APIs and prints affected comment payloads, list counts, ownership-visible fields, and suggested list/usecase next actions.
- **UC-029 MAIN**: after project and use case setup, `vspec pull` writes canonical markdown under a temp `specs/` root, then `vspec push` reads the edited file, calls the real sync push API, updates the local `revision:` frontmatter, prints per-file status/cache/actions, and appends a server revision.
- **UC-030 MAIN**: after a use case has main and extension scenarios with steps, `vspec export gherkin <usecase-id> --output <path>` calls the real Gherkin export API, writes the feature file locally, and prints export path/byte count.
- **UC-031 MAIN**: after a use case has stakeholder, main, and extension content, `vspec export markdown <usecase-id> --output <path>` calls the real markdown export API, writes canonical markdown locally, and prints export path/byte count.
- **UC-032 MAIN**: after owner signup, `vspec api-key create`, `vspec api-key list`, and `vspec api-key revoke <id>` call the real API-key APIs, show the plaintext token only on create, list metadata without token material, and print revocation metadata.
- **UC-033 MAIN**: `vspec ai-guide --api-url <server>` calls the public AI guide endpoint, prints the markdown crash course sections, and includes the suggested next commands for login, project listing, and session start.
