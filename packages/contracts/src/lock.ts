import { z } from "zod";
import { suggestedNextActionSchema } from "./common.js";

export const lockTypeSchema = z.enum(["SOFT", "SEMANTIC", "HARD"]);

export const lockCreateRequestSchema = z.object({
  lock_type: lockTypeSchema,
  reason: z.string().min(1),
  target_id: z.string().min(1),
  target_type: z.literal("USECASE"),
  ttl_minutes: z.number().positive().default(30)
});

export const lockRenewRequestSchema = z.object({
  ttl_minutes: z.number().positive().default(30)
});

export const lockParamsSchema = z.object({
  lockId: z.string().min(1)
});

export const lockStoredResponseSchema = z.object({
  acquired_at: z.string(),
  auto_release: z.boolean(),
  expires_at: z.string(),
  held_by_session_id: z.string().nullable(),
  held_by_user_id: z.string(),
  holder: z.string(),
  id: z.string().optional(),
  lock_type: lockTypeSchema,
  mode: lockTypeSchema,
  reason: z.string(),
  target_id: z.string(),
  target_type: z.literal("USECASE"),
  usecase_id: z.string()
});

const lockWarningSchema = z.object({
  holders: z.array(z.string()),
  message: z.string(),
  type: z.literal("SOFT_LOCK_COEXISTS")
});

export const lockResponseSchema = z.object({
  lock: lockStoredResponseSchema,
  suggested_next_actions: z.array(suggestedNextActionSchema).optional(),
  warnings: z.array(lockWarningSchema).optional()
});

export type LockCreateRequest = z.infer<typeof lockCreateRequestSchema>;
export type LockRenewRequest = z.infer<typeof lockRenewRequestSchema>;
export type LockStoredResponse = z.infer<typeof lockStoredResponseSchema>;
export type LockResponse = z.infer<typeof lockResponseSchema>;
