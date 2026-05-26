import { describe, expect, test } from "vitest";
import {
  apiKeyCreateRequestSchema,
  apiKeyCreateResponseSchema,
  apiKeyListQuerySchema,
  apiKeyListResponseSchema,
  apiKeyParamsSchema,
  apiKeyRevokeResponseSchema
} from "../src/index.js";

describe("api key contracts", () => {
  test("parses create, list, and revoke request boundaries", () => {
    expect(
      apiKeyCreateRequestSchema.parse({
        name: "ci pipeline",
        scopes: ["read", "write"],
        workspace_id: "workspace-1"
      })
    ).toEqual({
      name: "ci pipeline",
      scopes: ["read", "write"],
      workspace_id: "workspace-1"
    });
    expect(
      apiKeyCreateRequestSchema.parse({
        name: "lost token",
        scopes: ["read"],
        simulate_response_drop: true,
        workspace_id: "workspace-1"
      }).simulate_response_drop
    ).toBe(true);
    expect(apiKeyListQuerySchema.parse({ workspace_id: "workspace-1" })).toEqual({
      workspace_id: "workspace-1"
    });
    expect(apiKeyParamsSchema.parse({ id: "key-1" })).toEqual({ id: "key-1" });
  });

  test("rejects malformed API key request boundaries", () => {
    expect(() =>
      apiKeyCreateRequestSchema.parse({
        name: "",
        scopes: [],
        workspace_id: "workspace-1"
      })
    ).toThrow();
    expect(() => apiKeyListQuerySchema.parse({})).toThrow();
    expect(() => apiKeyParamsSchema.parse({ id: "" })).toThrow();
  });

  test("parses create, list, and revoke success responses", () => {
    const created = apiKeyCreateResponseSchema.parse({
      api_key: apiKey({ token_hash: "$argon2id$hash" }),
      plaintext_token: "vsp_test_token",
      suggested_next_actions: [
        {
          command: "vspec api-key list",
          reason: "Confirm the key metadata; the token will not be shown again."
        }
      ]
    });
    expect(created.api_key.token_hash).toBe("$argon2id$hash");

    const listed = apiKeyListResponseSchema.parse({
      api_keys: [apiKey()]
    });
    expect(listed.api_keys[0]).not.toHaveProperty("token_hash");

    const revoked = apiKeyRevokeResponseSchema.parse({
      api_key: apiKey({ revoked_at: "2026-05-22T00:00:00.000Z" }),
      idempotent: true,
      suggested_next_actions: [
        {
          command: "vspec api-key list",
          reason: "Confirm the key revocation status."
        }
      ]
    });
    expect(revoked.idempotent).toBe(true);
  });
});

function apiKey(overrides: Record<string, unknown> = {}) {
  return {
    created_at: "2026-05-22T00:00:00.000Z",
    created_by: "user-1",
    id: "key-1",
    name: "ci pipeline",
    revoked_at: null,
    scopes: ["read", "write"],
    workspace_id: "workspace-1",
    ...overrides
  };
}
