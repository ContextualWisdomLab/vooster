import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  acceptInvitation,
  inviteMember,
  type AcceptanceResponse,
  type InvitationResponse,
  type ProblemResponse
} from "../helpers/invitation-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { signup } from "../helpers/uc-fixtures.js";

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-003 - Invite a member", () => {
  test("MAIN: owner invites an editor and invitee accepts with matching GitHub email", async () => {
    const owner = await signup(server, "Invite Main", "invite-main", "stub-invite-owner");
    const inviteeEmail = "stub-invitee@users.noreply.github.com";

    const invited = await inviteMember(server, owner.workspaceId, owner.cookie, inviteeEmail, "EDITOR");

    expect(invited.status).toBe(201);
    const inviteBody = (await invited.json()) as InvitationResponse;
    expect(inviteBody.invitation).toMatchObject({
      accepted_at: null,
      delivery_status: "SENT",
      email: inviteeEmail,
      role: "EDITOR",
      workspace_id: owner.workspaceId
    });
    expect(inviteBody.invitation.token).toHaveLength(36);
    expect(Date.parse(inviteBody.invitation.expires_at)).not.toBeNaN();
    expect(inviteBody.suggested_next_actions).toContainEqual({
      command: "vspec member list",
      reason: "Review pending and active workspace members."
    });

    const accepted = await acceptInvitation(server, inviteBody.invitation.token, "stub-invitee");

    expect(accepted.status).toBe(200);
    const acceptBody = (await accepted.json()) as AcceptanceResponse;
    expect(acceptBody.user.email).toBe(inviteeEmail);
    expect(acceptBody.membership).toMatchObject({
      role: "EDITOR",
      workspace_id: owner.workspaceId
    });
    expect(acceptBody.invitation.accepted_at).not.toBeNull();
  });

  test("2a: editor cannot invite an owner and gets editor-role guidance", async () => {
    const owner = await signup(server, "Invite Role", "invite-role", "stub-invite-role-owner");
    const editorInvite = await inviteMember(
      server,
      owner.workspaceId,
      owner.cookie,
      "stub-invite-editor@users.noreply.github.com",
      "EDITOR"
    );
    const editorInviteBody = (await editorInvite.json()) as InvitationResponse;
    const accepted = await acceptInvitation(server, editorInviteBody.invitation.token, "stub-invite-editor");
    const editorCookie = accepted.headers.get("set-cookie") ?? "";

    const response = await inviteMember(
      server,
      owner.workspaceId,
      editorCookie,
      "stub-invite-owner-target@users.noreply.github.com",
      "OWNER"
    );

    expect(response.status).toBe(403);
    const problem = (await response.json()) as ProblemResponse;
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec member invite --role editor",
      reason: "Invite the teammate as an editor or ask a workspace owner."
    });
  });

  test("3a: email for an active member is rejected with set-role guidance", async () => {
    const owner = await signup(server, "Invite Existing", "invite-existing", "stub-existing-owner");
    const memberEmail = "stub-existing-member@users.noreply.github.com";
    const invited = await inviteMember(server, owner.workspaceId, owner.cookie, memberEmail, "EDITOR");
    const inviteBody = (await invited.json()) as InvitationResponse;
    await acceptInvitation(server, inviteBody.invitation.token, "stub-existing-member");

    const response = await inviteMember(server, owner.workspaceId, owner.cookie, memberEmail, "OWNER");

    expect(response.status).toBe(422);
    const problem = (await response.json()) as ProblemResponse;
    expect(problem.code).toBe("already_member");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec member set-role",
      reason: "Change the existing member role instead of inviting again."
    });
  });

  test("3b: duplicate pending invite returns existing token with resend guidance", async () => {
    const owner = await signup(server, "Invite Duplicate", "invite-duplicate", "stub-duplicate-owner");
    const email = "stub-duplicate-invitee@users.noreply.github.com";
    const first = await inviteMember(server, owner.workspaceId, owner.cookie, email, "EDITOR");
    const firstBody = (await first.json()) as InvitationResponse;

    const second = await inviteMember(server, owner.workspaceId, owner.cookie, email, "EDITOR");

    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as InvitationResponse;
    expect(secondBody.invitation.token).toBe(firstBody.invitation.token);
    expect(secondBody.suggested_next_actions).toContainEqual({
      command: "vspec member invite --resend",
      reason: "Resend the existing invitation email."
    });
  });

  test("5a: delivery failure persists invitation with correction guidance", async () => {
    const owner = await signup(server, "Invite Delivery", "invite-delivery", "stub-delivery-owner");

    const response = await inviteMember(
      server,
      owner.workspaceId,
      owner.cookie,
      "stub-delivery-fail@users.noreply.github.com",
      "EDITOR",
      { simulate_delivery_failure: true }
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as InvitationResponse;
    expect(body.invitation.delivery_status).toBe("FAILED");
    expect(body.invitation.token).toHaveLength(36);
    expect(body.suggested_next_actions).toContainEqual({
      command: "vspec member invite --email <corrected>",
      reason: "Correct the address and send a new invitation."
    });
  });

  test("6a: expired token is rejected and creates no membership", async () => {
    const owner = await signup(server, "Invite Expired", "invite-expired", "stub-expired-owner");
    const email = "stub-expired-invitee@users.noreply.github.com";
    const invited = await inviteMember(server, owner.workspaceId, owner.cookie, email, "EDITOR", {
      simulate_expired: true
    });
    const inviteBody = (await invited.json()) as InvitationResponse;

    const expired = await acceptInvitation(server, inviteBody.invitation.token, "stub-expired-invitee");

    expect(expired.status).toBe(410);
    const problem = (await expired.json()) as ProblemResponse;
    expect(problem.code).toBe("invitation_expired");
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec member invite",
      reason: "Ask a workspace owner for a fresh invitation."
    });
    const freshInvite = await inviteMember(server, owner.workspaceId, owner.cookie, email, "EDITOR");
    expect(freshInvite.status).toBe(201);
  });

  test("6b: accepting with a different GitHub email is rejected without membership", async () => {
    const owner = await signup(server, "Invite Mismatch", "invite-mismatch", "stub-mismatch-owner");
    const email = "stub-expected-invitee@users.noreply.github.com";
    const invited = await inviteMember(server, owner.workspaceId, owner.cookie, email, "EDITOR");
    const inviteBody = (await invited.json()) as InvitationResponse;

    const mismatch = await acceptInvitation(server, inviteBody.invitation.token, "stub-other-invitee");

    expect(mismatch.status).toBe(422);
    const problem = (await mismatch.json()) as ProblemResponse;
    expect(problem.code).toBe("email_mismatch");
    const duplicate = await inviteMember(server, owner.workspaceId, owner.cookie, email, "EDITOR");
    const duplicateBody = (await duplicate.json()) as InvitationResponse;
    expect(duplicate.status).toBe(200);
    expect(duplicateBody.invitation.token).toBe(inviteBody.invitation.token);
  });
});
