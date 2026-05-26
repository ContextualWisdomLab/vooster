import { z } from "zod";
import { suggestedNextActionSchema } from "./common.js";

export const apiKeyCreateRequestSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).min(1),
  simulate_response_drop: z.boolean().optional(),
  workspace_id: z.string().min(1)
});

export const apiKeyListQuerySchema = z.object({
  workspace_id: z.string().min(1)
});

export const apiKeyParamsSchema = z.object({
  id: z.string().min(1)
});

export const apiKeyPublicResponseSchema = z.object({
  created_at: z.string(),
  created_by: z.string(),
  id: z.string(),
  name: z.string(),
  revoked_at: z.string().nullable(),
  scopes: z.array(z.string()),
  workspace_id: z.string()
});

export const apiKeyStoredResponseSchema = apiKeyPublicResponseSchema.extend({
  token_hash: z.string()
});

export const apiKeyCreateResponseSchema = z.object({
  api_key: apiKeyStoredResponseSchema,
  plaintext_token: z.string(),
  suggested_next_actions: z.array(suggestedNextActionSchema)
});

export const apiKeyListResponseSchema = z.object({
  api_keys: z.array(apiKeyPublicResponseSchema)
});

export const apiKeyRevokeResponseSchema = z.object({
  api_key: apiKeyPublicResponseSchema,
  idempotent: z.boolean().optional(),
  suggested_next_actions: z.array(suggestedNextActionSchema)
});

export type ApiKeyCreateRequest = z.infer<typeof apiKeyCreateRequestSchema>;
export type ApiKeyListQuery = z.infer<typeof apiKeyListQuerySchema>;
export type ApiKeyPublicResponse = z.infer<typeof apiKeyPublicResponseSchema>;
export type ApiKeyCreateResponse = z.infer<typeof apiKeyCreateResponseSchema>;
export type ApiKeyListResponse = z.infer<typeof apiKeyListResponseSchema>;
export type ApiKeyRevokeResponse = z.infer<typeof apiKeyRevokeResponseSchema>;
