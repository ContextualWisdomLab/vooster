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
