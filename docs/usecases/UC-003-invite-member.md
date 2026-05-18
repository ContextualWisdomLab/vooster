---
vspec_format: 1
type: usecase
id: UC-003
key: VSPEC-003
title: Invite a member
level: USER_GOAL
format: FULLY_DRESSED
status: DRAFT
priority: P0
scope: vspec
primary_actor: workspace-admin
---

# Invite a member

> A workspace owner invites a teammate to collaborate. The invite is addressed by email, scoped to a chosen role (OWNER or EDITOR), and remains pending until the invitee accepts via the link in the email. Until then no Membership row exists; the invitation itself carries no implicit access. Acceptance is GitHub-OAuth-gated, so the eventual Membership is always bound to a verified identity.

## Stakeholders and Interests

- **Workspace Admin**: can extend access to a teammate with one command and see the invite state without ambiguity. _(Protected by: step 5 and Success Guarantee)_
- **Invitee**: only receives access after explicitly consenting via GitHub, and the role they receive matches what was offered. _(Protected by: step 6 and Minimal Guarantee)_
- **Vooster**: invitations cannot be used to bypass GitHub auth or to escalate privileges, and pending invites expire so stale state does not accumulate. _(Protected by: step 4 and step 7)_
- **Existing Workspace Members**: cannot be silently demoted or replaced by an invite flow; only OWNERs can issue OWNER-role invites. _(Protected by: step 2)_

## Preconditions

- The inviting user is authenticated and holds an OWNER Membership on the target workspace.
- The target workspace is not at its plan member cap.
- The invitee's email address is syntactically valid.

## Trigger

The admin invokes `vspec member invite --email <addr> --role <editor|owner>` or submits the invite form in the workspace settings page.

## Main Success Scenario

1. **Workspace Admin** submits the invitee's email and the desired role.
2. **System** verifies the requester holds OWNER role on the workspace (OWNER role required to invite OWNERs).
3. **System** checks that no active Membership and no non-expired Invitation already exist for that email on this workspace.
4. **System** creates an Invitation row with a single-use token, the chosen role, and a 7-day expiry.
5. **System** sends an invite email containing the acceptance link.
6. **Invitee** opens the link, authenticates via GitHub OAuth (signing up if needed), and confirms acceptance.
7. **System** atomically marks the Invitation as accepted and creates a Membership with the offered role.

## Extensions

### 2a. Requester is an EDITOR attempting to invite an OWNER

- 2a1. **System** denies the request with 403 and recommends `--role editor` instead.
- (Outcome: FAILURE — use case ends; no Invitation is created.)

### 3a. Email already maps to an active Membership

- 3a1. **System** returns a 422 explaining the user is already a member.
- 3a2. **System** suggests `vspec member set-role` if a role change was intended.
- (Outcome: FAILURE — use case ends.)

### 3b. A non-expired Invitation already exists for that email

- 3b1. **System** returns the existing Invitation rather than duplicating it.
- 3b2. **System** offers to resend the original email.
- (Outcome: SUCCESS — use case ends; idempotent.)

### 5a. Email provider rejects delivery

- 5a1. **System** marks the Invitation as `delivery_failed` and notifies the admin.
- 5a2. **Workspace Admin** corrects the address and re-invites, or copies the acceptance link directly from the admin UI.
- (Outcome: PARTIAL — Invitation persists; rejoins main at step 6 once delivery succeeds or link is shared out-of-band.)

### 6a. Invitee accepts after the token has expired

- 6a1. **System** rejects the acceptance with a 410 Gone.
- 6a2. **System** advises the invitee to request a fresh invite from the admin.
- (Outcome: FAILURE — use case ends; Invitation stays in `expired` state and no Membership is created.)

### 6b. Invitee authenticates with a GitHub account whose verified email differs from the invited address

- 6b1. **System** rejects acceptance and explains the mismatch.
- (Outcome: FAILURE — use case ends; no Membership is created.)

## Success Guarantee

A Membership exists with the user_id resolved from the GitHub login, the workspace_id of the target workspace, and the role offered in the invitation. The Invitation row is marked accepted and its token is unusable. The invitee can immediately authenticate and use the workspace.

## Minimal Guarantee

Until the invitee completes step 6 no Membership exists and no workspace data is exposed. A failed acceptance never leaves the Invitation in a half-consumed state — it is either still pending, expired, or fully accepted. Tokens are single-use and cryptographically random.

## Notes

- API endpoint: `POST /v1/workspaces/:id/invitations`.
- CLI: `vspec member invite`, `vspec member list`, `vspec member set-role`, `vspec member remove`.
- Invitations are a thin entity (token + email + role + expiry) and are not part of the 16 MVP domain entities — they live in the auth layer.
