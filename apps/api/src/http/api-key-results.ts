import type { FastifyReply } from "fastify";
import {
  apiKeyCreateResponseSchema,
  apiKeyListResponseSchema,
  apiKeyRevokeResponseSchema
} from "@vooster/contracts";
import type {
  CreateApiKeyResult,
  ListApiKeysResult,
  RevokeApiKeyResult
} from "../application/api-keys.js";
import { problem } from "./signup-support.js";

export function sendCreateApiKeyResult(
  reply: FastifyReply,
  result: CreateApiKeyResult
) {
  switch (result.status) {
    case "CREATED":
      return reply.code(201).send(createApiKeyResponse(result));
    case "TOKEN_NOT_DELIVERED":
      return reply.code(503).send(
        problem(503, "API key token was not delivered", {}, [
          {
            command: "vspec api-key revoke",
            reason: "Revoke the unviewable key before creating a replacement."
          }
        ])
      );
    case "OWNER_REQUIRED":
      return reply.code(403).send(ownerRequiredProblem());
    case "UNSUPPORTED_SCOPE":
      return reply.code(422).send(
        problem(422, "Unsupported API key scope", {
          allowed_scopes: result.allowedScopes,
          offending_scope: result.offendingScope
        })
      );
  }
}

export function sendListApiKeysResult(reply: FastifyReply, result: ListApiKeysResult) {
  switch (result.status) {
    case "LISTED":
      return reply.send(apiKeyListResponseSchema.parse({ api_keys: result.apiKeys }));
    case "OWNER_REQUIRED":
      return reply.code(403).send(problem(403, "Workspace owner role required"));
  }
}

export function sendRevokeApiKeyResult(
  reply: FastifyReply,
  result: RevokeApiKeyResult
) {
  switch (result.status) {
    case "REVOKED":
      return reply.send(revokeApiKeyResponse(result));
    case "NOT_FOUND":
      return reply.code(404).send(apiKeyNotFoundProblem());
  }
}

function ownerRequiredProblem() {
  return problem(403, "Workspace owner role required", {}, [
    {
      command: "vspec member set-role",
      reason: "Ask a workspace owner to grant OWNER before issuing API keys."
    }
  ]);
}

function createApiKeyResponse(
  result: Extract<CreateApiKeyResult, { status: "CREATED" }>
) {
  return apiKeyCreateResponseSchema.parse({
    api_key: result.apiKey,
    plaintext_token: result.plaintextToken,
    suggested_next_actions: [
      {
        command: "vspec api-key list",
        reason: "Confirm the key metadata; the token will not be shown again."
      }
    ]
  });
}

function revokeApiKeyResponse(
  result: Extract<RevokeApiKeyResult, { status: "REVOKED" }>
) {
  return apiKeyRevokeResponseSchema.parse({
    api_key: result.apiKey,
    ...(result.idempotent ? { idempotent: true } : {}),
    suggested_next_actions: [
      {
        command: "vspec api-key list",
        reason: "Confirm the key revocation status."
      }
    ]
  });
}

function apiKeyNotFoundProblem() {
  return problem(404, "API key not found", { code: "api_key_not_found" }, []);
}
