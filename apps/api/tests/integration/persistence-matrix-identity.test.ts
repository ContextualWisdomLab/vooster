import { afterEach, describe, expect, test } from "vitest";

import {
  acceptInvitation,
  archiveWorkspace,
  bootServer,
  cookieFrom,
  createApiKey,
  createInvitation,
  createInvitationResponse,
  createProjectResponse,
  createTestDatabaseRegistry,
  listApiKeys,
  login,
  loginWithWorkspaces,
  signupWorkspace,
  signupWorkspaceWithSlug
} from "./persistence-matrix-helpers.js";

const registry = createTestDatabaseRegistry();

describe("Goal 2 persistence matrix — identity cluster", () => {
  afterEach(async () => {
    await registry.teardownAll();
  });

  test("Membership survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const owner = await signupWorkspace(first.url, "membership-owner");
    await signupWorkspace(first.url, "membership-invitee");
    const invitation = await createInvitation(
      first.url,
      owner.sessionCookie,
      owner.workspaceId,
      "membership-invitee@users.noreply.github.com"
    );
    await acceptInvitation(first.url, invitation.token, "membership-invitee");

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await loginWithWorkspaces(second.url, "membership-invitee");

    await second.stop();

    expect(loggedIn.workspaces.map((workspace) => workspace.id)).toContain(
      owner.workspaceId
    );
  }, 90_000);

  test("User survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const owner = await signupWorkspace(first.url, "user-owner");
    const invitation = await createInvitation(
      first.url,
      owner.sessionCookie,
      owner.workspaceId,
      "fresh-invitee@users.noreply.github.com"
    );
    await acceptInvitation(first.url, invitation.token, "fresh-invitee");

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await loginWithWorkspaces(second.url, "fresh-invitee");

    await second.stop();

    expect(loggedIn.workspaces.map((workspace) => workspace.id)).toContain(
      owner.workspaceId
    );
  }, 90_000);

  test("Workspace archive survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "workspace-archive-owner");
    await archiveWorkspace(first.url, signup.workspaceId);

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "workspace-archive-owner");
    const created = await createProjectResponse(
      second.url,
      loggedIn.sessionCookie,
      signup.workspaceId,
      "Archived Workspace Project",
      "WARC"
    );

    await second.stop();

    expect(created.status).toBe(409);
    const createdBody = (await created.json()) as { title?: unknown };
    expect(createdBody.title).toEqual(expect.stringMatching(/workspace.*archived/i));
  }, 90_000);

  test("Workspace lookup survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "workspace-lookup-owner");

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "workspace-lookup-owner");
    const invitation = await createInvitationResponse(
      second.url,
      loggedIn.sessionCookie,
      signup.workspaceId,
      "workspace-lookup-invitee@users.noreply.github.com"
    );

    await second.stop();

    expect(invitation.status).toBe(201);
    const invitationBody = (await invitation.json()) as {
      invitation?: { workspace_id?: unknown };
    };
    expect(invitationBody.invitation?.workspace_id).toBe(signup.workspaceId);
  }, 90_000);

  test("Workspace slug namespace survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    await signupWorkspaceWithSlug(first.url, "workspace-slug-owner", "persisted-slug");
    await signupWorkspaceWithSlug(
      first.url,
      "workspace-slug-owner-2",
      "persisted-slug-2"
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const start = await fetch(`${second.url}/v1/auth/github/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workspace: {
          name: "Duplicate Persisted Slug",
          slug: "persisted-slug"
        }
      })
    });
    const oauthCookie = cookieFrom(start, "vspec_oauth_state");
    const { state } = (await start.json()) as { state: string };
    const callback = await fetch(
      `${second.url}/v1/auth/github/callback?code=workspace-slug-owner-3&state=${state}`,
      { headers: { cookie: oauthCookie } }
    );

    await second.stop();

    expect(callback.status).toBe(422);
    const callbackBody = (await callback.json()) as {
      suggested_alternative_slug?: unknown;
      title?: unknown;
    };
    expect(callbackBody.title).toEqual(expect.stringMatching(/workspace slug.*taken/i));
    expect(callbackBody.suggested_alternative_slug).toBe("persisted-slug-3");
  }, 90_000);

  test("ApiKey survives a server restart", async () => {
    const databaseUrl = await registry.allocate();
    const first = await bootServer(databaseUrl);
    const signup = await signupWorkspace(first.url, "api-key-owner");
    const apiKey = await createApiKey(
      first.url,
      signup.sessionCookie,
      signup.workspaceId,
      "restart key"
    );

    await first.stop();

    const second = await bootServer(databaseUrl);
    const loggedIn = await login(second.url, "api-key-owner");
    const listed = await listApiKeys(
      second.url,
      loggedIn.sessionCookie,
      signup.workspaceId
    );

    await second.stop();

    expect(listed.status).toBe(200);
    const listedBody = (await listed.json()) as {
      api_keys?: Array<{
        id?: unknown;
        name?: unknown;
        plaintext_token?: unknown;
        token_hash?: unknown;
        workspace_id?: unknown;
      }>;
    };
    const persisted = (listedBody.api_keys ?? []).find(
      (entry) => entry.id === apiKey.id
    );
    expect(persisted).toMatchObject({
      id: apiKey.id,
      name: "restart key",
      workspace_id: signup.workspaceId
    });
    expect(persisted).not.toHaveProperty("plaintext_token");
    expect(persisted).not.toHaveProperty("token_hash");
  }, 90_000);
});
