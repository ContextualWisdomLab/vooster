import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKeyListResponse,
  type ApiKeyResponse,
  type ProblemResponse
} from "../helpers/api-key-fixtures.js";
import {
  acceptInvitation,
  inviteMember,
  type InvitationResponse
} from "../helpers/invitation-fixtures.js";
import { startServer, type TestServer } from "../helpers/server.js";
import { signup } from "../helpers/uc-fixtures.js";

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-032 - Issue and manage API keys", () => {
  test("MAIN: owner creates, lists, and revokes a scoped API key", async () => {
    const owner = await signup(server, "API Key Main", "api-key-main", "stub-api-key-main");

    const created = await createApiKey(server, owner.workspaceId, owner.cookie, {
      name: "ci pipeline",
      scopes: ["read", "write"]
    });

    expect(created.status).toBe(201);
    const createBody = (await created.json()) as ApiKeyResponse;
    expect(createBody.plaintext_token).toMatch(/^vsp_[A-Za-z0-9]{32,}$/);
    expect(createBody.api_key).toMatchObject({
      created_by: owner.userId,
      name: "ci pipeline",
      revoked_at: null,
      scopes: ["read", "write"],
      workspace_id: owner.workspaceId
    });
    expect(createBody.api_key.token_hash).toMatch(/^\$argon2id\$/);
    expect(createBody.suggested_next_actions).toContainEqual({
      command: "vspec api-key list",
      reason: "Confirm the key metadata; the token will not be shown again."
    });

    const listed = await listApiKeys(server, owner.workspaceId, owner.cookie);
    const listBody = (await listed.json()) as ApiKeyListResponse;
    expect(listBody.api_keys).toHaveLength(1);
    expect(listBody.api_keys[0]).not.toHaveProperty("plaintext_token");
    expect(listBody.api_keys[0]).not.toHaveProperty("token_hash");

    const revoked = await revokeApiKey(server, createBody.api_key.id, owner.cookie);
    expect(revoked.status).toBe(200);
    const revokeBody = (await revoked.json()) as ApiKeyResponse;
    expect(Date.parse(revokeBody.api_key.revoked_at ?? "")).not.toBeNaN();
  });

  test("2a: unsupported scope is rejected with allowed scope guidance", async () => {
    const owner = await signup(server, "API Key Scope", "api-key-scope", "stub-api-key-scope");

    const response = await createApiKey(server, owner.workspaceId, owner.cookie, {
      name: "admin job",
      scopes: ["read", "admin"]
    });

    expect(response.status).toBe(422);
    const problem = (await response.json()) as {
      allowed_scopes: string[];
      offending_scope: string;
    };
    expect(problem.offending_scope).toBe("admin");
    expect(problem.allowed_scopes).toEqual(["read", "write"]);
    const listed = await listApiKeys(server, owner.workspaceId, owner.cookie);
    expect(((await listed.json()) as ApiKeyListResponse).api_keys).toEqual([]);
  });

  test("5a: lost create response leaves metadata only and requires reissue", async () => {
    const owner = await signup(server, "API Key Lost", "api-key-lost", "stub-api-key-lost");

    const dropped = await createApiKey(server, owner.workspaceId, owner.cookie, {
      name: "lost token",
      scopes: ["read"],
      simulate_response_drop: true
    });

    expect(dropped.status).toBe(503);
    const listed = await listApiKeys(server, owner.workspaceId, owner.cookie);
    const listBody = (await listed.json()) as ApiKeyListResponse;
    expect(listBody.api_keys).toHaveLength(1);
    expect(listBody.api_keys[0]).toMatchObject({ name: "lost token", revoked_at: null });
    expect(listBody.api_keys[0]).not.toHaveProperty("plaintext_token");

    await revokeApiKey(server, listBody.api_keys[0]?.id ?? "", owner.cookie);
    const reissued = await createApiKey(server, owner.workspaceId, owner.cookie, {
      name: "lost token replacement",
      scopes: ["read"]
    });
    expect(reissued.status).toBe(201);
    expect(((await reissued.json()) as ApiKeyResponse).plaintext_token).toMatch(/^vsp_/);
  });

  test("5b: revoking an already-revoked key is idempotent", async () => {
    const owner = await signup(server, "API Key Idempotent", "api-key-idempotent", "stub-api-key-idempotent");
    const created = await createApiKey(server, owner.workspaceId, owner.cookie, {
      name: "agent key",
      scopes: ["write"]
    });
    const key = ((await created.json()) as ApiKeyResponse).api_key;
    const first = (await (await revokeApiKey(server, key.id, owner.cookie)).json()) as ApiKeyResponse;

    const secondResponse = await revokeApiKey(server, key.id, owner.cookie);

    expect(secondResponse.status).toBe(200);
    const second = (await secondResponse.json()) as ApiKeyResponse;
    expect(second.api_key.revoked_at).toBe(first.api_key.revoked_at);
    expect(second.idempotent).toBe(true);
  });

  test("2b: editor cannot create API keys and gets owner-role guidance", async () => {
    const owner = await signup(server, "API Key Editor", "api-key-editor", "stub-api-key-editor-owner");
    const invited = await inviteMember(
      server,
      owner.workspaceId,
      owner.cookie,
      "stub-api-key-editor@users.noreply.github.com",
      "EDITOR"
    );
    const inviteBody = (await invited.json()) as InvitationResponse;
    const accepted = await acceptInvitation(server, inviteBody.invitation.token, "stub-api-key-editor");
    const editorCookie = accepted.headers.get("set-cookie") ?? "";

    const response = await createApiKey(server, owner.workspaceId, editorCookie, {
      name: "editor key",
      scopes: ["read"]
    });

    expect(response.status).toBe(403);
    const problem = (await response.json()) as ProblemResponse;
    expect(problem.suggested_next_actions).toContainEqual({
      command: "vspec member set-role",
      reason: "Ask a workspace owner to grant OWNER before issuing API keys."
    });
  });

  test("*a: revoking another workspace key returns non-leaky 404", async () => {
    const ownerA = await signup(server, "API Key Workspace A", "api-key-workspace-a", "stub-api-key-workspace-a");
    const ownerB = await signup(server, "API Key Workspace B", "api-key-workspace-b", "stub-api-key-workspace-b");
    const created = await createApiKey(server, ownerA.workspaceId, ownerA.cookie, {
      name: "foreign key",
      scopes: ["read"]
    });
    const key = ((await created.json()) as ApiKeyResponse).api_key;

    const response = await revokeApiKey(server, key.id, ownerB.cookie);

    expect(response.status).toBe(404);
    const problem = (await response.json()) as ProblemResponse;
    expect(problem.code).toBe("api_key_not_found");
    expect(problem.workspace_id).toBeUndefined();
  });
});
