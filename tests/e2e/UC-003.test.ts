import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
import { signup } from "../helpers/uc-fixtures.js";

type Invitation = {
  accepted_at: null | string;
  delivery_status: "SENT" | "FAILED";
  email: string;
  expires_at: string;
  id: string;
  role: "EDITOR" | "OWNER";
  token: string;
  workspace_id: string;
};
type InvitationResponse = {
  invitation: Invitation;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
type AcceptanceResponse = {
  invitation: Invitation;
  membership: { role: "EDITOR" | "OWNER"; user_id: string; workspace_id: string };
  user: { email: string; id: string };
};
type ProblemResponse = {
  code?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-003 - Invite a member", () => {
  test("MAIN: owner invites an editor and invitee accepts with matching GitHub email", async () => {
    const owner = await signup(server, "Invite Main", "invite-main", "stub-invite-owner");
    const inviteeEmail = "stub-invitee@users.noreply.github.com";

    const invited = await inviteMember(owner.workspaceId, owner.cookie, inviteeEmail, "EDITOR");

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

    const accepted = await acceptInvitation(inviteBody.invitation.token, "stub-invitee");

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
      owner.workspaceId,
      owner.cookie,
      "stub-invite-editor@users.noreply.github.com",
      "EDITOR"
    );
    const editorInviteBody = (await editorInvite.json()) as InvitationResponse;
    const accepted = await acceptInvitation(editorInviteBody.invitation.token, "stub-invite-editor");
    const editorCookie = accepted.headers.get("set-cookie") ?? "";

    const response = await inviteMember(
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
    const invited = await inviteMember(owner.workspaceId, owner.cookie, memberEmail, "EDITOR");
    const inviteBody = (await invited.json()) as InvitationResponse;
    await acceptInvitation(inviteBody.invitation.token, "stub-existing-member");

    const response = await inviteMember(owner.workspaceId, owner.cookie, memberEmail, "OWNER");

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
    const first = await inviteMember(owner.workspaceId, owner.cookie, email, "EDITOR");
    const firstBody = (await first.json()) as InvitationResponse;

    const second = await inviteMember(owner.workspaceId, owner.cookie, email, "EDITOR");

    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as InvitationResponse;
    expect(secondBody.invitation.token).toBe(firstBody.invitation.token);
    expect(secondBody.suggested_next_actions).toContainEqual({
      command: "vspec member invite --resend",
      reason: "Resend the existing invitation email."
    });
  });
});

function inviteMember(
  workspaceId: string,
  cookie: string,
  email: string,
  role: "EDITOR" | "OWNER"
) {
  return server.fetch(`/v1/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ email, role })
  });
}

function acceptInvitation(token: string, code: string) {
  return server.fetch(`/v1/invitations/${token}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
}
