import type { TestServer } from "./server.js";

export type ApiKey = {
  created_at: string;
  created_by: string;
  id: string;
  name: string;
  revoked_at: null | string;
  scopes: string[];
  token_hash?: string;
  workspace_id: string;
};
export type ApiKeyResponse = {
  api_key: ApiKey;
  idempotent?: boolean;
  plaintext_token?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
};
export type ApiKeyListResponse = { api_keys: ApiKey[] };
export type ProblemResponse = {
  code?: string;
  suggested_next_actions: Array<{ command: string; reason: string }>;
  workspace_id?: string;
};

export function createApiKey(
  server: TestServer,
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

export function listApiKeys(server: TestServer, workspaceId: string, cookie: string) {
  return server.fetch(`/v1/api-keys?workspace_id=${workspaceId}`, {
    headers: { Cookie: cookie }
  });
}

export function revokeApiKey(server: TestServer, keyId: string, cookie: string) {
  return server.fetch(`/v1/api-keys/${keyId}`, {
    method: "DELETE",
    headers: { Cookie: cookie }
  });
}
