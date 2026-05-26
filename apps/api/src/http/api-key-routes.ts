import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  apiKeyCreateRequestSchema,
  apiKeyListQuerySchema,
  apiKeyParamsSchema
} from "@vooster/contracts";
import {
  createApiKey as createApiKeyWorkflow,
  listApiKeys as listApiKeysWorkflow,
  revokeApiKey as revokeApiKeyWorkflow
} from "../application/api-keys.js";
import {
  sendCreateApiKeyResult,
  sendListApiKeysResult,
  sendRevokeApiKeyResult
} from "./api-key-results.js";
import { authenticatedUserId } from "./session-support.js";
import { problem } from "./signup-support.js";
import type { SignupState } from "./signup-types.js";
import type { ApiKeyStore } from "../ports/api-key-store.js";
import type { MembershipStore } from "../ports/membership-store.js";

export function registerApiKeyRoutes(
  app: FastifyInstance,
  state: SignupState,
  membershipStore: MembershipStore,
  apiKeyStore: ApiKeyStore
) {
  app.post("/v1/api-keys", (request, reply) =>
    createApiKey(request, reply, state, membershipStore, apiKeyStore)
  );
  app.get("/v1/api-keys", (request, reply) =>
    listApiKeys(request, reply, state, membershipStore, apiKeyStore)
  );
  app.delete("/v1/api-keys/:id", (request, reply) =>
    revokeApiKey(request, reply, state, membershipStore, apiKeyStore)
  );
}

async function createApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  apiKeyStore: ApiKeyStore
) {
  const parsed = apiKeyCreateRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid API key request"));
  }
  return sendCreateApiKeyResult(
    reply,
    await createApiKeyWorkflow(
      { apiKeyStore, membershipStore },
      {
        name: parsed.data.name,
        scopes: parsed.data.scopes,
        simulateResponseDrop: parsed.data.simulate_response_drop === true,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken),
        workspaceId: parsed.data.workspace_id
      }
    )
  );
}

async function listApiKeys(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  apiKeyStore: ApiKeyStore
) {
  const parsed = apiKeyListQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    return reply.code(400).send(problem(400, "Invalid API key list request"));
  }
  return sendListApiKeysResult(
    reply,
    await listApiKeysWorkflow(
      { apiKeyStore, membershipStore },
      {
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken),
        workspaceId: parsed.data.workspace_id
      }
    )
  );
}

async function revokeApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
  state: SignupState,
  membershipStore: MembershipStore,
  apiKeyStore: ApiKeyStore
) {
  const id = apiKeyParamsSchema.parse(request.params).id;
  return sendRevokeApiKeyResult(
    reply,
    await revokeApiKeyWorkflow(
      { apiKeyStore, membershipStore },
      {
        apiKeyId: id,
        userId: authenticatedUserId(request.headers.cookie, state.sessionsByToken)
      }
    )
  );
}
