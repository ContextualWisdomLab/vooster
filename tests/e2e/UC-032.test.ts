import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startServer, type TestServer } from "../helpers/server.js";
import { signup } from "../helpers/uc-fixtures.js";

type ApiKey = {
  created_at: string;
  created_by: string;
  id: string;
  name: string;
  revoked_at: null | string;
  scopes: string[];
  token_hash?: string;
  workspace_id: string;
};
type ApiKeyResponse = {
  api_key: ApiKey;
  idempotent?: boolean;
  plaintext_token?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
type ApiKeyListResponse = { api_keys: ApiKey[] };

let server: TestServer;
beforeAll(async () => { server = await startServer(); });
afterAll(async () => { await server.stop(); });

describe("UC-032 - Issue and manage API keys", () => {
  test("MAIN: owner creates, lists, and revokes a scoped API key", async () => {
    const owner = await signup(server, "API Key Main", "api-key-main", "stub-api-key-main");

    const created = await createApiKey(owner.workspaceId, owner.cookie, {
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

    const listed = await listApiKeys(owner.workspaceId, owner.cookie);
    const listBody = (await listed.json()) as ApiKeyListResponse;
    expect(listBody.api_keys).toHaveLength(1);
    expect(listBody.api_keys[0]).not.toHaveProperty("plaintext_token");
    expect(listBody.api_keys[0]).not.toHaveProperty("token_hash");

    const revoked = await revokeApiKey(createBody.api_key.id, owner.cookie);
    expect(revoked.status).toBe(200);
    const revokeBody = (await revoked.json()) as ApiKeyResponse;
    expect(Date.parse(revokeBody.api_key.revoked_at ?? "")).not.toBeNaN();
  });

  test("2a: unsupported scope is rejected with allowed scope guidance", async () => {
    const owner = await signup(server, "API Key Scope", "api-key-scope", "stub-api-key-scope");

    const response = await createApiKey(owner.workspaceId, owner.cookie, {
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
    const listed = await listApiKeys(owner.workspaceId, owner.cookie);
    expect(((await listed.json()) as ApiKeyListResponse).api_keys).toEqual([]);
  });

  test("5a: lost create response leaves metadata only and requires reissue", async () => {
    const owner = await signup(server, "API Key Lost", "api-key-lost", "stub-api-key-lost");

    const dropped = await createApiKey(owner.workspaceId, owner.cookie, {
      name: "lost token",
      scopes: ["read"],
      simulate_response_drop: true
    });

    expect(dropped.status).toBe(503);
    const listed = await listApiKeys(owner.workspaceId, owner.cookie);
    const listBody = (await listed.json()) as ApiKeyListResponse;
    expect(listBody.api_keys).toHaveLength(1);
    expect(listBody.api_keys[0]).toMatchObject({ name: "lost token", revoked_at: null });
    expect(listBody.api_keys[0]).not.toHaveProperty("plaintext_token");

    await revokeApiKey(listBody.api_keys[0]?.id ?? "", owner.cookie);
    const reissued = await createApiKey(owner.workspaceId, owner.cookie, {
      name: "lost token replacement",
      scopes: ["read"]
    });
    expect(reissued.status).toBe(201);
    expect(((await reissued.json()) as ApiKeyResponse).plaintext_token).toMatch(/^vsp_/);
  });

  test("5b: revoking an already-revoked key is idempotent", async () => {
    const owner = await signup(server, "API Key Idempotent", "api-key-idempotent", "stub-api-key-idempotent");
    const created = await createApiKey(owner.workspaceId, owner.cookie, {
      name: "agent key",
      scopes: ["write"]
    });
    const key = ((await created.json()) as ApiKeyResponse).api_key;
    const first = (await (await revokeApiKey(key.id, owner.cookie)).json()) as ApiKeyResponse;

    const secondResponse = await revokeApiKey(key.id, owner.cookie);

    expect(secondResponse.status).toBe(200);
    const second = (await secondResponse.json()) as ApiKeyResponse;
    expect(second.api_key.revoked_at).toBe(first.api_key.revoked_at);
    expect(second.idempotent).toBe(true);
  });
});

function createApiKey(
  workspaceId: string,
  cookie: string,
  body: { name: string; scopes: string[]; simulate_response_drop?: boolean }
) {
  return server.fetch("/v1/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ workspace_id: workspaceId, ...body })
  });
}

function listApiKeys(workspaceId: string, cookie: string) {
  return server.fetch(`/v1/api-keys?workspace_id=${workspaceId}`, {
    headers: { Cookie: cookie }
  });
}

function revokeApiKey(keyId: string, cookie: string) {
  return server.fetch(`/v1/api-keys/${keyId}`, {
    method: "DELETE",
    headers: { Cookie: cookie }
  });
}
