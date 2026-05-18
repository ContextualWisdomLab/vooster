---
vspec_format: 1
type: usecase
id: UC-001
key: VSPEC-001
title: Sign up for a workspace
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: developer-pm
---

# Sign up for a workspace

> A new developer or product manager wants to start using vspec for the first time. They authenticate through GitHub OAuth and, in the same flow, create a workspace that will hold their projects. On success they have a User account, a Workspace, and an OWNER Membership tying the two together — enough state to immediately create a project and start authoring specs.

## Stakeholders and Interests

- **Developer / PM**: gets a usable account and an owned workspace in a single sitting, without manual provisioning. _(Protected by: Success Guarantee)_
- **Vooster**: every new account is backed by a verified GitHub identity (no anonymous workspaces), and partial signups never leak orphaned rows. _(Protected by: step 4 and Minimal Guarantee)_
- **Future Workspace Members**: the workspace they will later be invited into has a clearly identified Owner with auditable provenance. _(Protected by: step 6)_

## Preconditions

- The user has a GitHub account with a verified primary email.
- The user has installed the `vspec` CLI or reached the vspec sign-up web page.
- No existing vspec User row is bound to the same `github_id`.

## Trigger

The user invokes `vspec login` (which redirects to the GitHub device-flow start endpoint) or visits the web sign-up page.

## Main Success Scenario

1. **Developer / PM** initiates sign-up and provides a desired workspace name and slug.
2. **System** redirects the user to GitHub OAuth and waits for the callback.
3. **Developer / PM** authorizes the vspec OAuth application on GitHub.
4. **System** exchanges the OAuth code for a GitHub access token and fetches the user's GitHub profile and verified email.
5. **System** creates a new User row keyed by `github_id` and stores the profile.
6. **System** creates a new Workspace owned by the User and an OWNER Membership in a single transaction.
7. **System** issues a session cookie and returns the User, Workspace, and the recommended next command (`vspec project create`).

## Extensions

### 2a. User denies authorization on GitHub

- 2a1. **System** receives the OAuth callback with an `error=access_denied` parameter.
- 2a2. **System** discards any pending sign-up state and clears the OAuth state cookie.
- 2a3. **System** returns an actionable error pointing to `vspec login`.
- (Outcome: FAILURE — use case ends; no User or Workspace is created.)

### 4a. GitHub email is not verified

- 4a1. **System** detects that no verified primary email is returned by the GitHub API.
- 4a2. **System** aborts the sign-up and instructs the user to verify their email on GitHub.
- (Outcome: FAILURE — use case ends; no User row is created.)

### 6a. Workspace slug is already taken

- 6a1. **System** detects a uniqueness violation on `Workspace.slug`.
- 6a2. **System** rolls back the transaction and returns a 422 with a suggested alternative slug.
- 6a3. **Developer / PM** resubmits with a different slug.
- (Outcome: PARTIAL — rejoins main at step 5; User has been authenticated but not yet committed.)

### *a. Network failure to GitHub at any auth step

- *a1. **System** logs the upstream error and returns a 502 with `suggested_next_actions` pointing to retry.
- (Outcome: FAILURE — use case ends; no partial state persists.)

## Success Guarantee

A User row (uniquely keyed by `github_id`), a Workspace row (with the chosen slug), and an OWNER Membership linking them all exist. The user holds a valid session cookie and can immediately call any authenticated endpoint.

## Minimal Guarantee

On any failure the database contains no half-committed account: either all three rows (User, Workspace, Membership) exist or none do. No OAuth token or session is leaked to a half-provisioned user, and the OAuth state cookie is cleared.

## Notes

- API endpoints: `POST /v1/auth/github/start`, `GET /v1/auth/github/callback`, `POST /v1/workspaces`.
- CLI: `vspec login`, `vspec workspace create`.
- See UC-002 for the subsequent-login flow (where the User row already exists).
- See UC-004 for the immediate next step a successful signup user takes.
