import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState, StoredMembership } from "./signup-types.js";
import type { MembershipStore } from "../ports/membership-store.js";

type StoredApiKey = {
  created_at: string;
  created_by: string;
  id: string;
  name: string;
  revoked_at: null | string;
  scopes: Array<"read" | "write">;
  token_hash: string;
  workspace_id: string;
};

const apiKeysByState = new WeakMap<SignupState, Map<string, StoredApiKey>>();
const createSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).min(1),
  simulate_response_drop: z.boolean().optional(),
  workspace_id: z.string().min(1)
});
const listSchema = z.object({ workspace_id: z.string().min(1) });
const allowedScopes = ["read", "write"] as const;

export function registerApiKeyRoutes(
  app: FastifyInstance,
  state: SignupState,
  membershipStore: MembershipStore
) {
  app.post("/v1/api-keys", (request, reply) =>
    createApiKey(request, reply, state, membershipStore)
  );
  app.get("/v1/api-keys", (request, reply) =>
    listApiKeys(request, reply, state, membershipStore)
  );
  app.delete("/v1/api-keys/:id", (request, reply) =>
    revokeApiKey(request, reply, state, membershipStore)
  );
}

async function createApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore
) {
  const parsed = createSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid API key request"));
  }
  const offendingScope = parsed.data.scopes.find((scope) => !isAllowedScope(scope));
  if (offendingScope !== undefined) {
    return reply.code(422).send(
      problem(422, "Unsupported API key scope", {
        allowed_scopes: [...allowedScopes],
        offending_scope: offendingScope
      })
    );
  }
  const membership = await workspaceMembership(
    request,
    state,
    membershipStore,
    parsed.data.workspace_id
  );
  if (membership?.role !== "OWNER") {
    return reply.code(403).send(ownerRequiredProblem());
  }
  const token = `vsp_${randomUUID().replaceAll("-", "")}`;
  const apiKey: StoredApiKey = {
    created_at: new Date().toISOString(),
    created_by: membership.user_id,
    id: randomUUID(),
    name: parsed.data.name,
    revoked_at: null,
    scopes: parsed.data.scopes.filter(isAllowedScope),
    token_hash: `$argon2id$${randomUUID()}`,
    workspace_id: parsed.data.workspace_id
  };
  apiKeys(state).set(apiKey.id, apiKey);
  if (parsed.data.simulate_response_drop === true) {
    return reply.code(503).send(
      problem(503, "API key token was not delivered", {}, [
        {
          command: "vspec api-key revoke",
          reason: "Revoke the unviewable key before creating a replacement."
        }
      ])
    );
  }
  return reply.code(201).send({
    api_key: apiKey,
    plaintext_token: token,
    suggested_next_actions: [
      {
        command: "vspec api-key list",
        reason: "Confirm the key metadata; the token will not be shown again."
      }
    ]
  });
}

async function listApiKeys(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore
) {
  const parsed = listSchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid API key list request"));
  }
  if (
    await ownerMembership(request, state, membershipStore, parsed.data.workspace_id) ===
    undefined
  ) {
    return reply.code(403).send(problem(403, "Workspace owner role required"));
  }
  return reply.send({
    api_keys: [...apiKeys(state).values()]
      .filter((apiKey) => apiKey.workspace_id === parsed.data.workspace_id)
      .map(publicApiKey)
  });
}

async function revokeApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore
) {
  const id = z.object({ id: z.string().min(1) }).parse(request.params).id;
  const apiKey = apiKeys(state).get(id);
  if (
    apiKey === undefined ||
    await ownerMembership(request, state, membershipStore, apiKey.workspace_id) ===
      undefined
  ) {
    return reply.code(404).send(apiKeyNotFoundProblem());
  }
  const idempotent = apiKey.revoked_at !== null;
  apiKey.revoked_at = apiKey.revoked_at ?? new Date().toISOString();
  return reply.send({
    api_key: publicApiKey(apiKey),
    ...(idempotent ? { idempotent: true } : {}),
    suggested_next_actions: [
      { command: "vspec api-key list", reason: "Confirm the key revocation status." }
    ]
  });
}

function ownerMembership(
  request: FastifyRequest,
  state: SignupState,
  membershipStore: MembershipStore,
  workspaceId: string
): Promise<StoredMembership | undefined> {
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  return userId === undefined
    ? Promise.resolve(undefined)
    : membershipStore
        .membershipForWorkspace(workspaceId, userId)
        .then((membership) => (membership?.role === "OWNER" ? membership : undefined));
}

function workspaceMembership(
  request: FastifyRequest,
  state: SignupState,
  membershipStore: MembershipStore,
  workspaceId: string
): Promise<StoredMembership | undefined> {
  const userId = authenticatedUserId(request.headers.cookie, state.sessionsByToken);
  return userId === undefined
    ? Promise.resolve(undefined)
    : membershipStore.membershipForWorkspace(workspaceId, userId);
}

function ownerRequiredProblem() {
  return problem(
    403,
    "Workspace owner role required",
    {},
    [
      {
        command: "vspec member set-role",
        reason: "Ask a workspace owner to grant OWNER before issuing API keys."
      }
    ]
  );
}

function apiKeyNotFoundProblem() {
  return problem(404, "API key not found", { code: "api_key_not_found" }, []);
}

function publicApiKey(apiKey: StoredApiKey) {
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

function isAllowedScope(scope: string): scope is "read" | "write" {
  return allowedScopes.includes(scope as "read" | "write");
}

function apiKeys(state: SignupState) {
  const existing = apiKeysByState.get(state);
  if (existing !== undefined) {
    return existing;
  }
  const created = new Map<string, StoredApiKey>();
  apiKeysByState.set(state, created);
  return created;
}
