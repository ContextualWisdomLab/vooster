---
vspec_format: 1
type: usecase
id: UC-002
key: VSPEC-002
title: Log in
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Log in

> A returning user re-authenticates so they can resume work. Because vspec uses GitHub as the sole identity provider, this is a thin OAuth round-trip that resolves the existing User row, refreshes the `last_login_at` timestamp, and sets a session cookie. No workspace is created; if the user is a member of zero workspaces, the response says so explicitly and points to UC-001.

## Stakeholders and Interests

- **Developer / PM**: regains an authenticated session in seconds and is told exactly what to do next based on workspace membership. _(Protected by: step 6)_
- **Vooster**: each login event is bound to a verified GitHub identity, `last_login_at` is updated for audit, and no shadow User row is created for someone who has not signed up. _(Protected by: step 4 and Minimal Guarantee)_
- **Workspace Admins**: members' login activity is recorded so admins can see stale accounts. _(Protected by: step 5)_

## Preconditions

- A User row already exists for this `github_id` (i.e., UC-001 has previously completed).
- The user is not currently holding a valid session cookie, or explicitly wants a fresh one.

## Trigger

The user invokes `vspec login` from the CLI or follows the "Log in" link on the web UI.

## Main Success Scenario

1. **Developer / PM** initiates the login flow.
2. **System** redirects the user to GitHub OAuth and waits for the callback.
3. **Developer / PM** authorizes (or, if already authorized, GitHub auto-redirects).
4. **System** exchanges the OAuth code for a GitHub access token and fetches the GitHub user id.
5. **System** looks up the existing User by `github_id` and updates `last_login_at`.
6. **System** issues a session cookie, returns the User payload, and lists workspaces the user belongs to.

## Extensions

### 4a. No vspec User exists for this GitHub identity

- 4a1. **System** detects that the `github_id` is unknown.
- 4a2. **System** returns a 404 with `suggested_next_actions` pointing to `vspec login` followed by the sign-up branch.
- 4a3. **Developer / PM** restarts the flow via UC-001.
- (Outcome: FAILURE — use case ends; no session is created and no User row is inserted.)

### 3a. User denies authorization on GitHub

- 3a1. **System** receives `error=access_denied` on the callback.
- 3a2. **System** clears any state cookie and returns a 401 with a retry hint.
- (Outcome: FAILURE — use case ends.)

### 6a. User belongs to zero workspaces

- 6a1. **System** completes login normally but observes the workspaces list is empty.
- 6a2. **System** sets a flag in the response (`workspaces: []`) and recommends `vspec workspace create`.
- (Outcome: SUCCESS — use case ends; user is logged in but must create or be invited to a workspace before doing useful work.)

### \*a. GitHub API is unreachable

- \*a1. **System** logs the upstream timeout and returns a 502 with a retry hint.
- (Outcome: FAILURE — use case ends; no session cookie is set.)

## Success Guarantee

The user holds a fresh session cookie tied to their existing User row. `User.last_login_at` reflects the current time. The response enumerates the workspaces the user is a member of, with their role in each.

## Minimal Guarantee

On failure no session cookie is set, no new User row is created, and `last_login_at` is not modified. The OAuth state cookie is cleared so a retry starts from a clean state.

## Notes

- API endpoints: `POST /v1/auth/github/start`, `GET /v1/auth/github/callback`.
- CLI: `vspec login`, `vspec logout`, `vspec status`.
- Contrast with UC-001: this use case never creates User or Workspace rows.
- See UC-016 for starting a work session after login.
