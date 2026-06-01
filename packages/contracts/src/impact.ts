import { z } from "zod";
import { suggestedNextActionSchema } from "./common.js";

export const impactPreviewRequestSchema = z.object({
  base_revision: z.string().min(1),
  entity_id: z.string().min(1),
  entity_type: z.literal("USECASE"),
  proposed_change_content: z.string().optional(),
  proposed_change_path: z.string().optional()
});

export const impactAffectedSessionSchema = z.object({
  agent_type: z.string(),
  id: z.string(),
  owner: z.string().optional(),
  pinned_revision: z.string().optional(),
  reason: z.string().optional()
});

export const impactSummarySchema = z.object({
  affected_branches: z.array(z.string()),
  affected_sessions: z.array(impactAffectedSessionSchema),
  affected_tests: z.array(z.string()),
  confidence: z.number(),
  input_hash: z.string(),
  severity: z.string()
});

export const impactPreviewResponseSchema = z.object({
  cached: z.boolean(),
  impact: impactSummarySchema,
  preview_id: z.string(),
  suggested_next_actions: z.array(suggestedNextActionSchema)
});

export type ImpactPreviewRequest = z.infer<typeof impactPreviewRequestSchema>;
export type ImpactAffectedSession = z.infer<typeof impactAffectedSessionSchema>;
export type ImpactSummary = z.infer<typeof impactSummarySchema>;
export type ImpactPreviewResponse = z.infer<typeof impactPreviewResponseSchema>;
