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
