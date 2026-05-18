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

### UC-016

- **MAIN**: authenticated project member starts a work session with pinned use case keys -> creates an ACTIVE session with pinned current revisions, writes `.vspec/session.json` metadata, and returns show/complete next actions.
- **3a**: requested pin is archived -> 422 with offending key and `vspec usecase restore <KEY>` guidance, no session.
- **3b**: requested pin is HARD-locked by another session -> 409 with holding session and `vspec who <KEY>` guidance, no session.
- **4a**: auto-branch branch-name collision -> appends a suffix, creates one ACTIVE agent branch, and starts the session on that branch.
- **4b**: auto-branch semantic lock acquisition fails -> rolls back branch, locks, and session, then returns 409 naming the conflicting session.
- **2a**: unrecognized `agent_type` -> stores `OTHER`, preserves the raw label in `agent_identifier`, returns a warning, and still starts the session.
- ***a**: transactional write fails mid-creation -> leaves no session, branch, or lock and returns retry guidance.
