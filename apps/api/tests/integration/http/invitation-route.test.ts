import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createProject, type ProjectSetup } from "../../helpers/uc-fixtures.js";
import { startServer, type TestServer } from "../../helpers/server.js";

let server: TestServer;
let owner: ProjectSetup;

type InvitationResponse = {
  invitation: { accepted_at: null | string; token: string };
};

async function createInvitation(
  setup: ProjectSetup,
  body: Record<string, unknown>
): Promise<Response> {
  return server.fetch(`/v1/workspaces/${setup.workspaceId}/invitations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: setup.cookie },
    body: JSON.stringify({ role: "EDITOR", ...body })
  });
}

describe("invitation routes integration", () => {
  beforeEach(async () => {
    server = await startServer();
    owner = await createProject(server, "Invite Owner", "invite-owner", "invite-owner");
  });

  afterEach(async () => {
    await server.stop();
  });

  test("rejects malformed invitation create requests through real routing", async () => {
    const response = await createInvitation(owner, { email: "not-email" });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      title: "Invalid invitation request"
    });
  });

  test("rejects acceptance of an unknown invitation token through real routing", async () => {
    const response = await server.fetch("/v1/invitations/token-missing/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "reader" })
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ title: "Invitation not found" });
  });

  test("rejects acceptance of an expired invitation through real routing", async () => {
    const created = await createInvitation(owner, {
      email: "reader@users.noreply.github.com",
      simulate_expired: true
    });
    expect(created.status).toBe(201);
    const token = ((await created.json()) as InvitationResponse).invitation.token;

    const response = await server.fetch(`/v1/invitations/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "reader" })
    });

    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ code: "invitation_expired" });
  });

  test("accepts an invitation and establishes a session through real routing", async () => {
    const created = await createInvitation(owner, {
      email: "reader@users.noreply.github.com"
    });
    expect(created.status).toBe(201);
    const token = ((await created.json()) as InvitationResponse).invitation.token;

    const response = await server.fetch(`/v1/invitations/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "reader" })
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      invitation: { accepted_at: null | string };
      membership: { role: string; user_id: string; workspace_id: string };
      user: { github_id: string; id: string };
    };
    expect(body.user.github_id).toBe("reader");
    expect(body.membership).toMatchObject({
      role: "EDITOR",
      user_id: body.user.id,
      workspace_id: owner.workspaceId
    });
    expect(typeof body.invitation.accepted_at).toBe("string");
    expect(response.headers.get("set-cookie")).toContain("vspec_session=");
  });

  test("accepts an invitation that resolves to an existing GitHub user through real routing", async () => {
    const existing = await createProject(
      server,
      "Existing Reader",
      "existing-reader",
      "existing-reader"
    );
    const created = await createInvitation(owner, {
      email: "existing-reader@users.noreply.github.com"
    });
    const token = ((await created.json()) as InvitationResponse).invitation.token;

    const response = await server.fetch(`/v1/invitations/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "existing-reader" })
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      membership: { user_id: string; workspace_id: string };
      user: { github_id: string; id: string };
    };
    expect(body.user.id).toBe(existing.userId);
    expect(body.membership).toMatchObject({
      user_id: existing.userId,
      workspace_id: owner.workspaceId
    });
  });
});
