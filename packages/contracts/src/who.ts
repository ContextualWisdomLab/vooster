import { z } from "zod";
import { suggestedNextActionSchema } from "./common.js";

export const whoParamsSchema = z.object({
  usecaseId: z.string().min(1)
});

const whoLockSchema = z.looseObject({
  expires_at: z.string(),
  held_by_session_id: z.string().nullable(),
  held_by_user_id: z.string(),
  id: z.string(),
  lock_type: z.string()
});

const whoMergeRequestSchema = z.looseObject({
  conflict_count: z.number(),
  id: z.string(),
  source_branch_id: z.string().nullable(),
  status: z.string()
});

const whoSessionSchema = z.looseObject({
  agent_type: z.string().optional(),
  id: z.string(),
  intent: z.string().optional(),
  markers: z.array(z.string()).default([]),
  started_at: z.string().optional(),
  user_id: z.string().optional()
});

const whoUsecaseSchema = z.looseObject({
  id: z.string().optional(),
  key: z.string()
});

export const whoResponseSchema = z.object({
  archived: z.boolean().optional(),
  locks: z.array(whoLockSchema),
  merge_requests: z.array(whoMergeRequestSchema),
  sessions: z.array(whoSessionSchema),
  suggested_next_actions: z.array(suggestedNextActionSchema),
  usecase: whoUsecaseSchema
});

export type WhoResponse = z.infer<typeof whoResponseSchema>;
