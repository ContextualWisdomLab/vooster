import { describe, expect, test } from "vitest";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey
} from "../../../src/application/api-keys.js";
import type { StoredApiKey } from "../../../src/http/api-key-types.js";
import type { StoredMembership } from "../../../src/http/signup-types.js";
import type { ApiKeyStore } from "../../../src/ports/api-key-store.js";
import type { MembershipStore } from "../../../src/ports/membership-store.js";

describe("api keys application", () => {
  test("owner creates a scoped key with one-time plaintext token and stored hash", async () => {
    const savedKeys: StoredApiKey[] = [];

    const result = await createApiKey(
      depsFor({ savedKeys }),
      {
        name: "ci pipeline",
        scopes: ["read", "write"],
        simulateResponseDrop: false,
        userId: "user-1",
        workspaceId: "workspace-1"
      }
    );

    expect(result.status).toBe("CREATED");
    if (result.status !== "CREATED") {
      throw new Error("expected API key to be created");
    }
    expect(result.plaintextToken).toBe("vsp_tokenvalue");
    expect(result.apiKey).toEqual({
      created_at: "2026-05-20T00:00:00.000Z",
      created_by: "user-1",
      id: "id-1",
      name: "ci pipeline",
      revoked_at: null,
      scopes: ["read", "write"],
      token_hash: "$argon2id$hashvalue",
      workspace_id: "workspace-1"
    });
    expect(savedKeys).toEqual([result.apiKey]);
  });

  test("rejects non-owners and unsupported scopes without saving", async () => {
    const savedKeys: StoredApiKey[] = [];

    await expect(
      createApiKey(
        depsFor({ membership: membership({ role: "EDITOR" }), savedKeys }),
        createInput()
      )
    ).resolves.toEqual({ status: "OWNER_REQUIRED" });

    await expect(
      createApiKey(
        depsFor({ savedKeys }),
        createInput({ scopes: ["read", "admin"] })
      )
    ).resolves.toEqual({
      allowedScopes: ["read", "write"],
      offendingScope: "admin",
      status: "UNSUPPORTED_SCOPE"
    });

    expect(savedKeys).toEqual([]);
  });

  test("records response-drop failures after saving metadata only", async () => {
    const savedKeys: StoredApiKey[] = [];

    const result = await createApiKey(
      depsFor({ savedKeys }),
      createInput({ simulateResponseDrop: true })
    );

    expect(result.status).toBe("TOKEN_NOT_DELIVERED");
    if (result.status !== "TOKEN_NOT_DELIVERED") {
      throw new Error("expected dropped response result");
    }
    expect(result.apiKey).toEqual(savedKeys[0]);
    expect(result).not.toHaveProperty("plaintextToken");
  });

  test("lists public metadata only for owners", async () => {
    const apiKey = storedApiKey();

    const result = await listApiKeys(
      depsFor({ apiKeys: [apiKey] }),
      { userId: "user-1", workspaceId: "workspace-1" }
    );

    expect(result).toEqual({
      apiKeys: [
        {
          created_at: apiKey.created_at,
          created_by: apiKey.created_by,
          id: apiKey.id,
          name: apiKey.name,
          revoked_at: null,
          scopes: ["read"],
          workspace_id: "workspace-1"
        }
      ],
      status: "LISTED"
    });
    await expect(
      listApiKeys(depsFor({ membership: null }), {
        userId: "outsider",
        workspaceId: "workspace-1"
      })
    ).resolves.toEqual({ status: "OWNER_REQUIRED" });
  });

  test("revokes keys idempotently and hides missing or foreign keys", async () => {
    const updatedKeys: StoredApiKey[] = [];
    const active = storedApiKey();
    const revoked = storedApiKey({
      id: "api-key-revoked",
      revoked_at: "2026-05-19T00:00:00.000Z"
    });

    const first = await revokeApiKey(
      depsFor({ apiKeys: [active], updatedKeys }),
      { apiKeyId: active.id, userId: "user-1" }
    );
    expect(first.status).toBe("REVOKED");
    if (first.status !== "REVOKED") {
      throw new Error("expected active key to be revoked");
    }
    expect(first.idempotent).toBe(false);
    expect(first.apiKey.revoked_at).toBe("2026-05-20T00:00:00.000Z");
    expect(updatedKeys).toEqual([active]);

    await expect(
      revokeApiKey(depsFor({ apiKeys: [revoked] }), {
        apiKeyId: revoked.id,
        userId: "user-1"
      })
    ).resolves.toEqual({
      apiKey: {
        created_at: revoked.created_at,
        created_by: revoked.created_by,
        id: revoked.id,
        name: revoked.name,
        revoked_at: "2026-05-19T00:00:00.000Z",
        scopes: ["read"],
        workspace_id: "workspace-1"
      },
      idempotent: true,
      status: "REVOKED"
    });

    await expect(
      revokeApiKey(depsFor({ apiKeys: [] }), {
        apiKeyId: "missing",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "NOT_FOUND" });
    await expect(
      revokeApiKey(depsFor({ apiKeys: [storedApiKey({ workspace_id: "workspace-2" })] }), {
        apiKeyId: "api-key-1",
        userId: "user-1"
      })
    ).resolves.toEqual({ status: "NOT_FOUND" });
  });
});

function depsFor(
  options: {
    apiKeys?: StoredApiKey[];
    membership?: StoredMembership | null;
    savedKeys?: StoredApiKey[];
    updatedKeys?: StoredApiKey[];
  } = {}
) {
  return {
    apiKeyStore: apiKeyStore(
      options.apiKeys ?? [],
      options.savedKeys ?? [],
      options.updatedKeys ?? []
    ),
    hashFactory: () => "$argon2id$hashvalue",
    idFactory: () => "id-1",
    membershipStore: membershipStore(
      "membership" in options ? options.membership ?? null : membership()
    ),
    now: () => new Date("2026-05-20T00:00:00.000Z"),
    tokenFactory: () => "vsp_tokenvalue"
  };
}

function apiKeyStore(
  apiKeys: StoredApiKey[],
  savedKeys: StoredApiKey[],
  updatedKeys: StoredApiKey[]
): ApiKeyStore {
  return {
    findApiKeyById: (apiKeyId) => Promise.resolve(apiKeys.find((item) => item.id === apiKeyId)),
    listApiKeysForWorkspace: (workspaceId) =>
      Promise.resolve(apiKeys.filter((item) => item.workspace_id === workspaceId)),
    saveApiKey: (apiKey) => {
      savedKeys.push(apiKey);
      return Promise.resolve();
    },
    updateApiKey: (apiKey) => {
      updatedKeys.push(apiKey);
      return Promise.resolve();
    }
  };
}

function membershipStore(value: StoredMembership | null): MembershipStore {
  return {
    membershipForProject: () => Promise.resolve(undefined),
    membershipForWorkspace: (workspaceId, userId) =>
      Promise.resolve(value?.user_id === userId && value.workspace_id === workspaceId
        ? value
        : undefined),
    membershipsForUser: () => Promise.resolve([]),
    saveMembership: () => Promise.resolve()
  };
}

function createInput(
  overrides: Partial<Parameters<typeof createApiKey>[1]> = {}
): Parameters<typeof createApiKey>[1] {
  return {
    name: "ci pipeline",
    scopes: ["read"],
    simulateResponseDrop: false,
    userId: "user-1",
    workspaceId: "workspace-1",
    ...overrides
  };
}

function storedApiKey(overrides: Partial<StoredApiKey> = {}): StoredApiKey {
  return {
    created_at: "2026-05-19T00:00:00.000Z",
    created_by: "user-1",
    id: "api-key-1",
    name: "ci pipeline",
    revoked_at: null,
    scopes: ["read"],
    token_hash: "$argon2id$stored",
    workspace_id: "workspace-1",
    ...overrides
  };
}

function membership(overrides: Partial<StoredMembership> = {}): StoredMembership {
  return {
    id: "membership-1",
    role: "OWNER",
    user_id: "user-1",
    workspace_id: "workspace-1",
    ...overrides
  };
}
