import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok")
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const suggestedNextActionSchema = z.object({
  command: z.string(),
  reason: z.string()
});

export type SuggestedNextAction = z.infer<typeof suggestedNextActionSchema>;

export const apiErrorCodeSchema = z.enum([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "REVISION_STALE",
  "LOCK_HELD",
  "RATE_LIMITED",
  "BAD_REQUEST",
  "SCHEMA_INVALID",
  "TITLE_NOT_VERB_PHRASE",
  "PRIMARY_ACTOR_NOT_AVAILABLE",
  "STAKEHOLDER_ALREADY_ATTACHED",
  "INTERNAL"
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
