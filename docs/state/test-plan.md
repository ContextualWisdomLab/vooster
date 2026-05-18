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
