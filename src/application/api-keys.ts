import { randomUUID } from "node:crypto";
import type { StoredApiKey } from "../http/api-key-types.js";
import type { StoredMembership } from "../http/signup-types.js";
import type { ApiKeyStore } from "../ports/api-key-store.js";
import type { MembershipStore } from "../ports/membership-store.js";

const allowedScopes = ["read", "write"] as const;
export type ApiKeyScope = typeof allowedScopes[number];

export type ApiKeyDeps = {
  apiKeyStore: ApiKeyStore;
  hashFactory?: () => string;
  idFactory?: () => string;
  membershipStore: MembershipStore;
  now?: () => Date;
  tokenFactory?: () => string;
};

export type PublicApiKey = Omit<StoredApiKey, "token_hash">;

export type CreateApiKeyInput = {
  name: string;
  scopes: string[];
  simulateResponseDrop: boolean;
  userId: string | undefined;
  workspaceId: string;
};

export type CreateApiKeyResult =
  | { apiKey: StoredApiKey; plaintextToken: string; status: "CREATED" }
  | { apiKey: StoredApiKey; status: "TOKEN_NOT_DELIVERED" }
  | { status: "OWNER_REQUIRED" }
  | { allowedScopes: ApiKeyScope[]; offendingScope: string; status: "UNSUPPORTED_SCOPE" };

export type ListApiKeysResult =
  | { apiKeys: PublicApiKey[]; status: "LISTED" }
  | { status: "OWNER_REQUIRED" };

export type RevokeApiKeyResult =
  | { apiKey: PublicApiKey; idempotent: boolean; status: "REVOKED" }
  | { status: "NOT_FOUND" };

export async function createApiKey(
  deps: ApiKeyDeps,
  input: CreateApiKeyInput
): Promise<CreateApiKeyResult> {
  const offendingScope = input.scopes.find((scope) => !isAllowedScope(scope));
  if (offendingScope !== undefined) {
    return {
      allowedScopes: [...allowedScopes],
      offendingScope,
      status: "UNSUPPORTED_SCOPE"
    };
  }
  const membership = await ownerMembership(deps.membershipStore, input.workspaceId, input.userId);
  if (membership === undefined) {
    return { status: "OWNER_REQUIRED" };
  }

  const token = tokenValue(deps);
  const apiKey: StoredApiKey = {
    created_at: now(deps).toISOString(),
    created_by: membership.user_id,
    id: id(deps),
    name: input.name,
    revoked_at: null,
    scopes: input.scopes.filter(isAllowedScope),
    token_hash: hashValue(deps),
    workspace_id: input.workspaceId
  };
  await deps.apiKeyStore.saveApiKey(apiKey);
  return input.simulateResponseDrop
    ? { apiKey, status: "TOKEN_NOT_DELIVERED" }
    : { apiKey, plaintextToken: token, status: "CREATED" };
}

export async function listApiKeys(
  deps: ApiKeyDeps,
  input: { userId: string | undefined; workspaceId: string }
): Promise<ListApiKeysResult> {
  if (await ownerMembership(deps.membershipStore, input.workspaceId, input.userId) === undefined) {
    return { status: "OWNER_REQUIRED" };
  }
  return {
    apiKeys: (await deps.apiKeyStore.listApiKeysForWorkspace(input.workspaceId)).map(publicApiKey),
    status: "LISTED"
  };
}

export async function revokeApiKey(
  deps: ApiKeyDeps,
  input: { apiKeyId: string; userId: string | undefined }
): Promise<RevokeApiKeyResult> {
  const apiKey = await deps.apiKeyStore.findApiKeyById(input.apiKeyId);
  if (
    apiKey === undefined ||
    await ownerMembership(deps.membershipStore, apiKey.workspace_id, input.userId) === undefined
  ) {
    return { status: "NOT_FOUND" };
  }

  const idempotent = apiKey.revoked_at !== null;
  apiKey.revoked_at = apiKey.revoked_at ?? now(deps).toISOString();
  await deps.apiKeyStore.updateApiKey(apiKey);
  return { apiKey: publicApiKey(apiKey), idempotent, status: "REVOKED" };
}

async function ownerMembership(
  membershipStore: MembershipStore,
  workspaceId: string,
  userId: string | undefined
): Promise<StoredMembership | undefined> {
  if (userId === undefined) {
    return undefined;
  }
  const membership = await membershipStore.membershipForWorkspace(workspaceId, userId);
  return membership?.role === "OWNER" ? membership : undefined;
}

export function publicApiKey(apiKey: StoredApiKey): PublicApiKey {
  return {
    created_at: apiKey.created_at,
    created_by: apiKey.created_by,
    id: apiKey.id,
    name: apiKey.name,
    revoked_at: apiKey.revoked_at,
    scopes: apiKey.scopes,
    workspace_id: apiKey.workspace_id
  };
}

function isAllowedScope(scope: string): scope is ApiKeyScope {
  return allowedScopes.includes(scope as ApiKeyScope);
}

function tokenValue(deps: ApiKeyDeps): string {
  return (deps.tokenFactory ?? (() => `vsp_${randomUUID().replaceAll("-", "")}`))();
}

function hashValue(deps: ApiKeyDeps): string {
  return (deps.hashFactory ?? (() => `$argon2id$${randomUUID()}`))();
}

function id(deps: ApiKeyDeps): string {
  return (deps.idFactory ?? randomUUID)();
}

function now(deps: ApiKeyDeps): Date {
  return (deps.now ?? (() => new Date()))();
}
